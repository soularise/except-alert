import { and, count, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { controllerJobs, events } from '@/lib/db/schema'
import {
  controllerJobConfigSchemas,
  type ControllerJobType,
  type CronDeadlineConfig,
  type DeadLetterConfig,
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
}

type SchedulerCounts = {
  claimed: number
  evaluated: number
  alerted: number
  errored: number
  skipped: number
}

const DEFAULT_BATCH_LIMIT = 25
const DEFAULT_LEASE_MS = 60_000

export async function runControllerScheduler(options: SchedulerOptions = {}) {
  const now = options.now ?? new Date()
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS
  const jobs = await claimDueControllerJobs({ now, limit, leaseMs })

  const counts: SchedulerCounts = {
    claimed: jobs.length,
    evaluated: 0,
    alerted: 0,
    errored: 0,
    skipped: 0,
  }

  for (const job of jobs) {
    const startedAt = Date.now()
    let result: ControllerRunResult

    try {
      result = await evaluateControllerJob(job, now, startedAt)
    } catch (err) {
      result = buildRunResult({
        status: 'error',
        outcome: 'evaluation_exception',
        now,
        startedAt,
        details: {
          message: err instanceof Error ? err.message : 'Unknown controller evaluation error',
        },
      })
    }

    const transition = await recordControllerTransition(job, result, now)
    await finishControllerJob(job, result, transition, now)
    counts.evaluated += 1
    if (result.status === 'alert') counts.alerted += 1
    if (result.status === 'error') counts.errored += 1
  }

  return counts
}

export async function claimDueControllerJobs({
  now,
  limit,
  leaseMs,
}: Required<SchedulerOptions>) {
  const leaseExpiresAt = new Date(now.getTime() + leaseMs)
  const nowIso = now.toISOString()
  const leaseExpiresAtIso = leaseExpiresAt.toISOString()
  const result = await db.execute(sql`
    WITH due AS (
      SELECT id
      FROM controller_jobs
      WHERE enabled = true
        AND next_run_at <= ${nowIso}::timestamptz
        AND (lease_expires_at IS NULL OR lease_expires_at <= ${nowIso}::timestamptz)
      ORDER BY next_run_at ASC
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

  return Array.from(result as unknown as ClaimedControllerJob[]).map((job) => ({
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
    return buildRunResult({
      status: 'error',
      outcome: 'health_ping_deferred',
      now,
      startedAt,
      details: { reason: 'Network health checks are intentionally deferred.' },
    })
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
  job: ClaimedControllerJob,
  result: ControllerRunResult,
  transition: ControllerTransition,
  now: Date
) {
  await db
    .update(controllerJobs)
    .set({
      leaseExpiresAt: null,
      lastRunAt: now,
      lastStatus: result.status,
      lastResult: result,
      lastAlertedAt: transition.lastAlertedAt,
      alertStartedAt: transition.alertStartedAt,
      nextRunAt: nextRunAfter(now, job.cronExpr),
      updatedAt: now,
    })
    .where(eq(controllerJobs.id, job.id))
}

type ControllerTransition = {
  alertStartedAt: Date | null
  lastAlertedAt: Date | null
}

async function recordControllerTransition(
  job: ClaimedControllerJob,
  result: ControllerRunResult,
  now: Date
): Promise<ControllerTransition> {
  const previousStatus = job.lastStatus

  if (result.status === 'ok') {
    if (previousStatus === 'alert' || previousStatus === 'error') {
      await insertControllerEvent(job, result, 'recovery', now)
    }
    return { alertStartedAt: null, lastAlertedAt: job.lastAlertedAt }
  }

  if (result.status === 'alert') {
    if (previousStatus !== 'alert') {
      await insertControllerEvent(job, result, 'alert', now)
      return {
        alertStartedAt: job.alertStartedAt ?? now,
        lastAlertedAt: now,
      }
    }
    return {
      alertStartedAt: job.alertStartedAt ?? now,
      lastAlertedAt: job.lastAlertedAt,
    }
  }

  if (previousStatus !== 'error') {
    await insertControllerEvent(job, result, 'error', now)
    return {
      alertStartedAt: job.alertStartedAt ?? now,
      lastAlertedAt: now,
    }
  }

  return {
    alertStartedAt: job.alertStartedAt ?? now,
    lastAlertedAt: job.lastAlertedAt,
  }
}

async function insertControllerEvent(
  job: ClaimedControllerJob,
  result: ControllerRunResult,
  transition: 'alert' | 'error' | 'recovery',
  now: Date
) {
  const hookId = controllerEventHookId(job, transition, now)
  const [existing] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.tenantId, job.tenantId), eq(events.hookId, hookId)))
    .limit(1)

  if (existing) return

  await db.insert(events).values({
    tenantId: job.tenantId,
    hookId,
    source: 'controller',
    severity: controllerEventSeverity(transition),
    title: controllerEventTitle(job, transition),
    description: controllerEventDescription(result, transition),
    category: `controller.${job.type}`,
    tags: {
      controller: true,
      controllerJobId: job.id,
      controllerJobName: job.name,
      transition,
      outcome: result.outcome,
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
}

function controllerEventHookId(
  job: ClaimedControllerJob,
  transition: 'alert' | 'error' | 'recovery',
  now: Date
) {
  const periodStart = job.alertStartedAt ?? job.lastAlertedAt ?? now
  return `controller-${job.id}-${transition}-${periodStart.toISOString().replace(/[^0-9A-Za-z]/g, '')}`
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

export function nextRunAfter(now: Date, cronExpr: string) {
  const minuteField = cronExpr.trim().split(/\s+/)[0]
  const intervalMatch = minuteField.match(/^\*\/(\d+)$/)
  const intervalMinutes = intervalMatch ? Number(intervalMatch[1]) : 5
  const safeIntervalMinutes = Number.isInteger(intervalMinutes) && intervalMinutes > 0
    ? intervalMinutes
    : 5

  return new Date(now.getTime() + safeIntervalMinutes * 60_000)
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
