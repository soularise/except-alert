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

    await finishControllerJob(job, result, now)
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
  const result = await db.execute(sql`
    WITH due AS (
      SELECT id
      FROM controller_jobs
      WHERE enabled = true
        AND next_run_at <= ${now}
        AND (lease_expires_at IS NULL OR lease_expires_at <= ${now})
      ORDER BY next_run_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE controller_jobs
    SET lease_expires_at = ${leaseExpiresAt},
        updated_at = ${now}
    FROM due
    WHERE controller_jobs.id = due.id
    RETURNING
      controller_jobs.id,
      controller_jobs.tenant_id AS "tenantId",
      controller_jobs.name,
      controller_jobs.type,
      controller_jobs.config,
      controller_jobs.cron_expr AS "cronExpr",
      controller_jobs.timezone
  `)

  return Array.from(result as unknown as ClaimedControllerJob[])
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
  now: Date
) {
  await db
    .update(controllerJobs)
    .set({
      leaseExpiresAt: null,
      lastRunAt: now,
      lastStatus: result.status,
      lastResult: result,
      nextRunAt: nextRunAfter(now, job.cronExpr),
      updatedAt: now,
    })
    .where(eq(controllerJobs.id, job.id))
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
