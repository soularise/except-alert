import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { and, count, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { controllerJobs, events } from '@/lib/db/schema'
import { sendTenantAlertNotifications } from '@/lib/notifications'
import {
  controllerJobConfigSchemas,
  type ControllerJobType,
  type CronDeadlineConfig,
  type DeadLetterConfig,
  type HealthPingConfig,
} from '@/lib/controller-jobs'

export type ControllerRunStatus = 'ok' | 'alert' | 'error'

export type ControllerRunResult = {
  status: ControllerRunStatus
  outcome: string
  evaluatedAt: string
  durationMs: number
  details: Record<string, unknown>
}

type ClaimedControllerJob = {
  id: string
  tenantId: string
  name: string
  type: string
  config: unknown
  cronExpr: string
  timezone: string
  lastStatus: string
  lastAlertedAt: Date | null
  alertStartedAt: Date | null
}

type SchedulerOptions = {
  now?: Date
  limit?: number
  leaseMs?: number
  concurrency?: number
  jobTimeoutMs?: number
}

type SchedulerCounts = {
  claimed: number
  evaluated: number
  alerted: number
  errored: number
  skipped: number
}

type ControllerProcessResult = {
  evaluated: boolean
  status: ControllerRunStatus | null
  result: ControllerRunResult | null
}

type ControllerDb = Pick<typeof db, 'select' | 'insert' | 'update'>

const DEFAULT_BATCH_LIMIT = 25
const DEFAULT_LEASE_MS = 60_000
const DEFAULT_CONTROLLER_CONCURRENCY = 5
const DEFAULT_JOB_TIMEOUT_MS = 30_000
const DEFAULT_REPEAT_COOLDOWN_MS = 60 * 60_000
const MAX_CRON_SEARCH_MINUTES = 366 * 24 * 60

export async function runControllerScheduler(options: SchedulerOptions = {}) {
  const now = options.now ?? new Date()
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS
  const concurrency = sanitizePositiveInteger(options.concurrency, DEFAULT_CONTROLLER_CONCURRENCY)
  const jobTimeoutMs = sanitizePositiveInteger(options.jobTimeoutMs, DEFAULT_JOB_TIMEOUT_MS)
  const jobs = await claimDueControllerJobs({ now, limit, leaseMs })

  const counts: SchedulerCounts = {
    claimed: jobs.length,
    evaluated: 0,
    alerted: 0,
    errored: 0,
    skipped: 0,
  }

  await processControllerJobsWithConcurrency(jobs, now, jobTimeoutMs, concurrency, counts)

  return counts
}

export async function runControllerJobNow(
  tenantId: string,
  jobId: string,
  options: SchedulerOptions = {}
) {
  const now = options.now ?? new Date()
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS
  const jobTimeoutMs = sanitizePositiveInteger(options.jobTimeoutMs, DEFAULT_JOB_TIMEOUT_MS)
  const [job] = await claimControllerJobById({ tenantId, jobId, now, leaseMs })

  if (!job) {
    return {
      claimed: false,
      evaluated: false,
      result: null,
    }
  }

  const processed = await processControllerJob(job, now, jobTimeoutMs)
  return {
    claimed: true,
    evaluated: processed.evaluated,
    result: processed.result,
  }
}

async function processControllerJob(
  job: ClaimedControllerJob,
  now: Date,
  jobTimeoutMs: number
): Promise<ControllerProcessResult> {
  const startedAt = Date.now()
  const result = await evaluateControllerJobWithTimeout(job, now, startedAt, jobTimeoutMs)

  try {
    const transition = buildControllerTransition(job, result, now)
    const insertedEvent = await db.transaction(async (tx) => {
      const event = await recordControllerTransition(tx, job, result, transition, now)
      await finishControllerJob(tx, job, result, transition, now)
      return event
    })

    if (insertedEvent) {
      const delivery = await sendTenantAlertNotifications(
        job.tenantId,
        controllerNotificationMessage(job, result, insertedEvent.transition)
      )
      if (delivery.failed.length > 0) {
        console.error('[controller] Alert delivery failed:', delivery.failed)
      }
    }

    return {
      evaluated: true,
      status: result.status,
      result,
    }
  } catch (err) {
    console.error('[controller] Failed to record controller result:', {
      jobId: job.id,
      message: err instanceof Error ? err.message : 'Unknown controller record error',
    })
    await releaseControllerJobLease(job.id).catch((releaseErr) =>
      console.error('[controller] Failed to release controller lease:', {
        jobId: job.id,
        message: releaseErr instanceof Error ? releaseErr.message : 'Unknown lease release error',
      })
    )
    return {
      evaluated: false,
      status: null,
      result,
    }
  }
}

async function releaseControllerJobLease(jobId: string) {
  await db
    .update(controllerJobs)
    .set({ leaseExpiresAt: null, updatedAt: new Date() })
    .where(eq(controllerJobs.id, jobId))
}

async function processControllerJobsWithConcurrency(
  jobs: ClaimedControllerJob[],
  now: Date,
  jobTimeoutMs: number,
  concurrency: number,
  counts: SchedulerCounts
) {
  const queue = [...jobs]
  const workerCount = Math.min(concurrency, queue.length)

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) continue

      const processed = await processControllerJob(job, now, jobTimeoutMs)
      if (processed.evaluated) {
        counts.evaluated += 1
        if (processed.status === 'alert') counts.alerted += 1
        if (processed.status === 'error') counts.errored += 1
      } else {
        counts.skipped += 1
      }
    }
  }))
}

async function evaluateControllerJobWithTimeout(
  job: ClaimedControllerJob,
  now: Date,
  startedAt: number,
  jobTimeoutMs: number
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      evaluateControllerJob(job, now, startedAt),
      new Promise<ControllerRunResult>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve(buildRunResult({
            status: 'error',
            outcome: 'evaluation_timeout',
            now,
            startedAt,
            details: { timeoutMs: jobTimeoutMs },
          }))
        }, jobTimeoutMs)
      }),
    ])
  } catch (err) {
    return buildRunResult({
      status: 'error',
      outcome: 'evaluation_exception',
      now,
      startedAt,
      details: {
        message: err instanceof Error ? err.message : 'Unknown controller evaluation error',
      },
    })
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function claimDueControllerJobs({
  now,
  limit,
  leaseMs,
}: Required<Pick<SchedulerOptions, 'now' | 'limit' | 'leaseMs'>>) {
  const leaseExpiresAt = new Date(now.getTime() + leaseMs)
  const nowIso = now.toISOString()
  const leaseExpiresAtIso = leaseExpiresAt.toISOString()
  const result = await db.execute(sql`
    WITH due AS (
      SELECT controller_jobs.id
      FROM controller_jobs
      INNER JOIN tenants ON tenants.id = controller_jobs.tenant_id
      WHERE controller_jobs.enabled = true
        AND tenants.plan <> 'free'
        AND controller_jobs.next_run_at <= ${nowIso}::timestamptz
        AND (controller_jobs.lease_expires_at IS NULL OR controller_jobs.lease_expires_at <= ${nowIso}::timestamptz)
      ORDER BY controller_jobs.next_run_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE controller_jobs
    SET lease_expires_at = ${leaseExpiresAtIso}::timestamptz,
        updated_at = ${nowIso}::timestamptz
    FROM due
    WHERE controller_jobs.id = due.id
    RETURNING
      controller_jobs.id,
      controller_jobs.tenant_id AS "tenantId",
      controller_jobs.name,
      controller_jobs.type,
      controller_jobs.config,
      controller_jobs.cron_expr AS "cronExpr",
      controller_jobs.timezone,
      controller_jobs.last_status AS "lastStatus",
      controller_jobs.last_alerted_at AS "lastAlertedAt",
      controller_jobs.alert_started_at AS "alertStartedAt"
  `)

  return normalizeClaimedControllerJobs(result)
}

async function claimControllerJobById({
  tenantId,
  jobId,
  now,
  leaseMs,
}: {
  tenantId: string
  jobId: string
  now: Date
  leaseMs: number
}) {
  const leaseExpiresAt = new Date(now.getTime() + leaseMs)
  const nowIso = now.toISOString()
  const leaseExpiresAtIso = leaseExpiresAt.toISOString()
  const result = await db.execute(sql`
    WITH requested AS (
      SELECT controller_jobs.id
      FROM controller_jobs
      INNER JOIN tenants ON tenants.id = controller_jobs.tenant_id
      WHERE controller_jobs.id = ${jobId}::uuid
        AND controller_jobs.tenant_id = ${tenantId}::uuid
        AND tenants.plan <> 'free'
        AND controller_jobs.enabled = true
        AND (controller_jobs.lease_expires_at IS NULL OR controller_jobs.lease_expires_at <= ${nowIso}::timestamptz)
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE controller_jobs
    SET lease_expires_at = ${leaseExpiresAtIso}::timestamptz,
        updated_at = ${nowIso}::timestamptz
    FROM requested
    WHERE controller_jobs.id = requested.id
    RETURNING
      controller_jobs.id,
      controller_jobs.tenant_id AS "tenantId",
      controller_jobs.name,
      controller_jobs.type,
      controller_jobs.config,
      controller_jobs.cron_expr AS "cronExpr",
      controller_jobs.timezone,
      controller_jobs.last_status AS "lastStatus",
      controller_jobs.last_alerted_at AS "lastAlertedAt",
      controller_jobs.alert_started_at AS "alertStartedAt"
  `)

  return normalizeClaimedControllerJobs(result)
}

function normalizeClaimedControllerJobs(result: unknown) {
  return Array.from(result as ClaimedControllerJob[]).map((job) => ({
    ...job,
    lastAlertedAt: dateFromDb(job.lastAlertedAt),
    alertStartedAt: dateFromDb(job.alertStartedAt),
  }))
}

async function evaluateControllerJob(
  job: ClaimedControllerJob,
  now: Date,
  startedAt: number
): Promise<ControllerRunResult> {
  if (!isControllerJobType(job.type)) {
    return buildRunResult({
      status: 'error',
      outcome: 'invalid_job_type',
      now,
      startedAt,
      details: { type: job.type },
    })
  }

  if (job.type === 'health_ping') {
    const parsed = controllerJobConfigSchemas.health_ping.safeParse(job.config)
    if (!parsed.success) return invalidConfigResult(now, startedAt, parsed.error.message)
    return evaluateHealthPing(parsed.data, now, startedAt)
  }

  if (job.type === 'deviation') {
    return buildRunResult({
      status: 'error',
      outcome: 'deviation_deferred',
      now,
      startedAt,
      details: { reason: 'Deviation evaluation needs completed baseline buckets.' },
    })
  }

  if (job.type === 'dead_letter') {
    const parsed = controllerJobConfigSchemas.dead_letter.safeParse(job.config)
    if (!parsed.success) return invalidConfigResult(now, startedAt, parsed.error.message)
    return evaluateDeadLetter(job.tenantId, parsed.data, now, startedAt)
  }

  const parsed = controllerJobConfigSchemas.cron_deadline.safeParse(job.config)
  if (!parsed.success) return invalidConfigResult(now, startedAt, parsed.error.message)
  return evaluateCronDeadline(job.tenantId, parsed.data, now, startedAt)
}

async function evaluateDeadLetter(
  tenantId: string,
  config: DeadLetterConfig,
  now: Date,
  startedAt: number
) {
  const windowStart = new Date(now.getTime() - config.maximumSilenceHours * 60 * 60_000)
  const eventCount = await countProviderEvents(tenantId, config.providerId, windowStart)
  const status = eventCount === 0 ? 'alert' : 'ok'

  return buildRunResult({
    status,
    outcome: eventCount === 0 ? 'provider_silent' : 'provider_active',
    now,
    startedAt,
    details: {
      providerId: config.providerId,
      eventCount,
      maximumSilenceHours: config.maximumSilenceHours,
      windowStart: windowStart.toISOString(),
    },
  })
}

async function evaluateHealthPing(config: HealthPingConfig, now: Date, startedAt: number) {
  let parsedUrl: URL
  let target: HealthPingTarget
  try {
    parsedUrl = validateHealthPingUrl(config.url)
    target = await resolvePublicHealthPingTarget(parsedUrl.hostname)
  } catch (err) {
    return buildRunResult({
      status: 'error',
      outcome: 'health_ping_target_blocked',
      now,
      startedAt,
      details: { message: err instanceof Error ? err.message : 'Invalid health ping target' },
    })
  }

  try {
    const response = await requestHealthPing(parsedUrl, target, config.timeoutMs)

    const status = response.status === config.expectedStatus ? 'ok' : 'alert'
    return buildRunResult({
      status,
      outcome: status === 'ok' ? 'health_ping_ok' : 'health_ping_status_mismatch',
      now,
      startedAt,
      details: {
        url: redactUrl(parsedUrl),
        expectedStatus: config.expectedStatus,
        actualStatus: response.status,
      },
    })
  } catch (err) {
    return buildRunResult({
      status: 'alert',
      outcome: 'health_ping_request_failed',
      now,
      startedAt,
      details: {
        url: redactUrl(parsedUrl),
        expectedStatus: config.expectedStatus,
        message: err instanceof Error ? err.message : 'Unknown health ping request error',
      },
    })
  }
}

async function evaluateCronDeadline(
  tenantId: string,
  config: CronDeadlineConfig,
  now: Date,
  startedAt: number
) {
  const windowStart = new Date(now.getTime() - config.windowHours * 60 * 60_000)
  const eventCount = await countProviderEvents(tenantId, config.providerId, windowStart)
  const status = eventCount >= config.minimumEvents ? 'ok' : 'alert'

  return buildRunResult({
    status,
    outcome: status === 'ok' ? 'minimum_met' : 'minimum_missed',
    now,
    startedAt,
    details: {
      providerId: config.providerId,
      eventCount,
      minimumEvents: config.minimumEvents,
      windowHours: config.windowHours,
      windowStart: windowStart.toISOString(),
    },
  })
}

async function countProviderEvents(tenantId: string, providerId: string, since: Date) {
  const [result] = await db
    .select({ value: count() })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        eq(events.source, providerId),
        gte(events.receivedAt, since)
      )
    )

  return result?.value ?? 0
}

async function finishControllerJob(
  tx: ControllerDb,
  job: ClaimedControllerJob,
  result: ControllerRunResult,
  transition: ControllerTransition,
  now: Date
) {
  await tx
    .update(controllerJobs)
    .set({
      leaseExpiresAt: null,
      lastRunAt: now,
      lastStatus: result.status,
      lastResult: result,
      lastAlertedAt: transition.lastAlertedAt,
      alertStartedAt: transition.alertStartedAt,
      nextRunAt: nextRunAfter(now, job.cronExpr, job.timezone),
      updatedAt: now,
    })
    .where(eq(controllerJobs.id, job.id))
}

type ControllerTransition = {
  alertStartedAt: Date | null
  lastAlertedAt: Date | null
  eventTransition: 'alert' | 'error' | 'recovery' | null
  cooldownBucket: number | null
}

function buildControllerTransition(
  job: ClaimedControllerJob,
  result: ControllerRunResult,
  now: Date
): ControllerTransition {
  const previousStatus = job.lastStatus

  if (result.status === 'ok') {
    return {
      alertStartedAt: null,
      lastAlertedAt: job.lastAlertedAt,
      eventTransition: previousStatus === 'alert' || previousStatus === 'error' ? 'recovery' : null,
      cooldownBucket: null,
    }
  }

  const alertStartedAt = job.alertStartedAt ?? now
  const cooldownBucket = cooldownBucketFor(alertStartedAt, now)
  const cooldownExpired = !job.lastAlertedAt ||
    now.getTime() - job.lastAlertedAt.getTime() >= DEFAULT_REPEAT_COOLDOWN_MS

  if (result.status === 'alert') {
    const shouldNotify = previousStatus !== 'alert' || cooldownExpired
    return {
      alertStartedAt,
      lastAlertedAt: shouldNotify ? now : job.lastAlertedAt,
      eventTransition: shouldNotify ? 'alert' : null,
      cooldownBucket: shouldNotify ? cooldownBucket : null,
    }
  }

  const shouldNotify = previousStatus !== 'error' || cooldownExpired
  return {
    alertStartedAt,
    lastAlertedAt: shouldNotify ? now : job.lastAlertedAt,
    eventTransition: shouldNotify ? 'error' : null,
    cooldownBucket: shouldNotify ? cooldownBucket : null,
  }
}

async function recordControllerTransition(
  tx: ControllerDb,
  job: ClaimedControllerJob,
  result: ControllerRunResult,
  transition: ControllerTransition,
  now: Date
) {
  if (!transition.eventTransition) return null
  const inserted = await insertControllerEvent(tx, job, result, transition, now)
  return inserted ? { transition: transition.eventTransition } : null
}

async function insertControllerEvent(
  tx: ControllerDb,
  job: ClaimedControllerJob,
  result: ControllerRunResult,
  transition: ControllerTransition,
  now: Date
) {
  if (!transition.eventTransition) return false

  const hookId = controllerEventHookId(job, transition, now)
  const [existing] = await tx
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.tenantId, job.tenantId), eq(events.hookId, hookId)))
    .limit(1)

  if (existing) return false

  await tx.insert(events).values({
    tenantId: job.tenantId,
    hookId,
    source: 'controller',
    severity: controllerEventSeverity(transition.eventTransition),
    title: controllerEventTitle(job, transition.eventTransition),
    description: controllerEventDescription(result, transition.eventTransition),
    category: `controller.${job.type}`,
    tags: {
      controller: true,
      controllerJobId: job.id,
      controllerJobName: job.name,
      transition: transition.eventTransition,
      outcome: result.outcome,
      cooldownBucket: transition.cooldownBucket,
    },
    payload: {
      job: {
        id: job.id,
        name: job.name,
        type: job.type,
      },
      result,
    },
    occurredAt: now,
    receivedAt: now,
    status: 'open',
  })
  return true
}

function controllerEventHookId(
  job: ClaimedControllerJob,
  transition: ControllerTransition,
  now: Date
) {
  const periodStart = transition.alertStartedAt ?? job.alertStartedAt ?? job.lastAlertedAt ?? now
  const bucket = transition.cooldownBucket ?? 0
  return `controller-${job.id}-${transition.eventTransition}-${periodStart.toISOString().replace(/[^0-9A-Za-z]/g, '')}-${bucket}`
}

function controllerEventSeverity(transition: 'alert' | 'error' | 'recovery') {
  if (transition === 'error') return 'error'
  if (transition === 'recovery') return 'info'
  return 'warning'
}

function controllerEventTitle(
  job: ClaimedControllerJob,
  transition: 'alert' | 'error' | 'recovery'
) {
  if (transition === 'recovery') return `${job.name} recovered`
  if (transition === 'error') return `${job.name} controller error`
  return `${job.name} needs attention`
}

function controllerEventDescription(
  result: ControllerRunResult,
  transition: 'alert' | 'error' | 'recovery'
) {
  if (transition === 'recovery') return 'Controller job returned to ok.'
  if (transition === 'error') return `Controller job failed: ${result.outcome}.`
  return `Controller job reported ${result.outcome}.`
}

function controllerNotificationMessage(
  job: ClaimedControllerJob,
  result: ControllerRunResult,
  transition: 'alert' | 'error' | 'recovery'
) {
  const heading = transition === 'recovery'
    ? 'ExceptAlert controller recovered'
    : transition === 'error'
      ? 'ExceptAlert controller error'
      : 'ExceptAlert controller alert'

  return [
    heading,
    `Job: ${job.name}`,
    `Type: ${job.type}`,
    `Outcome: ${result.outcome}`,
    `Evaluated: ${result.evaluatedAt}`,
  ].join('\n')
}

function cooldownBucketFor(alertStartedAt: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - alertStartedAt.getTime()) / DEFAULT_REPEAT_COOLDOWN_MS))
}

function sanitizePositiveInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && value !== undefined && value > 0 ? value : fallback
}

function invalidConfigResult(now: Date, startedAt: number, message: string) {
  return buildRunResult({
    status: 'error',
    outcome: 'invalid_config',
    now,
    startedAt,
    details: { message },
  })
}

function buildRunResult(input: {
  status: ControllerRunStatus
  outcome: string
  now: Date
  startedAt: number
  details: Record<string, unknown>
}): ControllerRunResult {
  return {
    status: input.status,
    outcome: input.outcome,
    evaluatedAt: input.now.toISOString(),
    durationMs: Math.max(0, Date.now() - input.startedAt),
    details: input.details,
  }
}

export function nextRunAfter(now: Date, cronExpr: string, timezone = 'UTC') {
  let schedule: CronSchedule
  try {
    schedule = parseCronSchedule(cronExpr)
  } catch {
    return new Date(now.getTime() + 5 * 60_000)
  }
  const safeTimezone = isRuntimeTimeZone(timezone) ? timezone : 'UTC'
  let cursor = new Date(Math.floor(now.getTime() / 60_000) * 60_000 + 60_000)

  for (let i = 0; i < MAX_CRON_SEARCH_MINUTES; i += 1) {
    if (cronMatches(cursor, schedule, safeTimezone)) return cursor
    cursor = new Date(cursor.getTime() + 60_000)
  }

  return new Date(now.getTime() + 5 * 60_000)
}

type CronSchedule = {
  minute: Set<number>
  hour: Set<number>
  dayOfMonth: Set<number>
  month: Set<number>
  dayOfWeek: Set<number>
  dayOfMonthRestricted: boolean
  dayOfWeekRestricted: boolean
}

function parseCronSchedule(cronExpr: string): CronSchedule {
  const fields = cronExpr.trim().split(/\s+/)
  if (fields.length !== 5) throw new Error('Cron expression must have five fields')

  return {
    minute: parseCronField(fields[0], 0, 59),
    hour: parseCronField(fields[1], 0, 23),
    dayOfMonth: parseCronField(fields[2], 1, 31),
    month: parseCronField(fields[3], 1, 12),
    dayOfWeek: parseCronField(fields[4], 0, 7, true),
    dayOfMonthRestricted: fields[2] !== '*',
    dayOfWeekRestricted: fields[4] !== '*',
  }
}

function parseCronField(field: string, min: number, max: number, normalizeSevenToZero = false) {
  const values = new Set<number>()

  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/')
    const step = stepPart ? Number(stepPart) : 1
    if (!rangePart || !Number.isInteger(step) || step <= 0) {
      throw new Error('Invalid cron field')
    }

    let start: number
    let end: number
    if (rangePart === '*') {
      start = min
      end = max
    } else if (rangePart.includes('-')) {
      const [rawStart, rawEnd] = rangePart.split('-')
      start = Number(rawStart)
      end = Number(rawEnd)
    } else {
      start = Number(rangePart)
      end = stepPart ? max : start
    }

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < min ||
      end > max ||
      start > end
    ) {
      throw new Error('Invalid cron range')
    }

    for (let value = start; value <= end; value += step) {
      values.add(normalizeSevenToZero && value === 7 ? 0 : value)
    }
  }

  return values
}

function cronMatches(date: Date, schedule: CronSchedule, timezone: string) {
  const parts = zonedDateParts(date, timezone)
  const dayOfWeekMatches = schedule.dayOfWeek.has(parts.dayOfWeek)
  const dayOfMonthMatches = schedule.dayOfMonth.has(parts.day)
  const dayMatches = schedule.dayOfMonthRestricted && schedule.dayOfWeekRestricted
    ? dayOfMonthMatches || dayOfWeekMatches
    : dayOfMonthMatches && dayOfWeekMatches

  return schedule.minute.has(parts.minute) &&
    schedule.hour.has(parts.hour) &&
    schedule.month.has(parts.month) &&
    dayMatches
}

function zonedDateParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>

  const dayOfWeek = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    dayOfWeek,
  }
}

function isRuntimeTimeZone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

type HealthPingTarget = {
  address: string
  family: 4 | 6
}

function validateHealthPingUrl(value: string) {
  const parsed = new URL(value)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Health ping URL must use HTTP or HTTPS')
  }
  if (parsed.username || parsed.password) {
    throw new Error('Health ping URL must not include credentials')
  }
  return parsed
}

async function resolvePublicHealthPingTarget(hostname: string): Promise<HealthPingTarget> {
  const normalizedHostname = normalizeUrlHostname(hostname)
  const literalVersion = net.isIP(normalizedHostname)
  if (literalVersion) {
    if (isBlockedIp(normalizedHostname, literalVersion)) {
      throw new Error('Health ping URL resolves to a prohibited address')
    }
    return { address: normalizedHostname, family: literalVersion as 4 | 6 }
  }

  const addresses = await lookup(normalizedHostname, { all: true, verbatim: false })
  if (addresses.length === 0) {
    throw new Error('Health ping hostname did not resolve')
  }

  for (const address of addresses) {
    if (isBlockedIp(address.address, address.family)) {
      throw new Error('Health ping URL resolves to a prohibited address')
    }
  }

  const target = addresses[0]
  return { address: target.address, family: target.family as 4 | 6 }
}

function requestHealthPing(url: URL, target: HealthPingTarget, timeoutMs: number) {
  const client = url.protocol === 'https:' ? https : http
  const requestPath = `${url.pathname || '/'}${url.search}`
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
  const hostHeader = url.port ? `${url.hostname}:${url.port}` : url.hostname

  return new Promise<{ status: number }>((resolve, reject) => {
    const req = client.request({
      method: 'GET',
      host: target.address,
      port,
      path: requestPath,
      family: target.family,
      headers: { Host: hostHeader },
      servername: normalizeUrlHostname(url.hostname),
      timeout: timeoutMs,
    }, (res) => {
      resolve({ status: res.statusCode ?? 0 })
      res.destroy()
    })

    req.once('timeout', () => {
      req.destroy(new Error('Health ping request timed out'))
    })
    req.once('error', reject)
    req.end()
  })
}

function isBlockedIp(address: string, family: number) {
  if (family === 4) return isBlockedIpv4(address)
  if (family === 6) return isBlockedIpv6(address)
  return true
}

function isBlockedIpv4(address: string) {
  const parts = address.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts
  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase()
  if (normalized.startsWith('::ffff:')) {
    const embeddedIpv4 = normalized.slice('::ffff:'.length)
    if (net.isIP(embeddedIpv4) === 4) return isBlockedIpv4(embeddedIpv4)
    const mappedIpv4 = ipv4FromIpv6Hextets(embeddedIpv4)
    return mappedIpv4 ? isBlockedIpv4(mappedIpv4) : true
  }

  return normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff')
}

function ipv4FromIpv6Hextets(value: string) {
  const parts = value.split(':')
  if (parts.length !== 2) return null
  if (parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null

  const words = parts.map((part) => Number.parseInt(part, 16))
  if (words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff)) {
    return null
  }

  return [
    words[0] >> 8,
    words[0] & 0xff,
    words[1] >> 8,
    words[1] & 0xff,
  ].join('.')
}

function redactUrl(url: URL) {
  return `${url.protocol}//${url.host}${url.pathname}`
}

function normalizeUrlHostname(hostname: string) {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname
}

function isControllerJobType(type: string): type is ControllerJobType {
  return type === 'health_ping' ||
    type === 'dead_letter' ||
    type === 'cron_deadline' ||
    type === 'deviation'
}

function dateFromDb(value: Date | string | null) {
  if (value === null || value instanceof Date) return value
  return new Date(value)
}
