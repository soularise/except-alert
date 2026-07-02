import type { InferSelectModel } from 'drizzle-orm'
import type { controllerJobs } from './db/schema'

type ControllerJob = InferSelectModel<typeof controllerJobs>

export function sanitizeControllerJob<T extends ControllerJob>(job: T): T {
  return {
    ...job,
    lastResult: sanitizeControllerRunResult(job.lastResult),
  }
}

function sanitizeControllerRunResult(result: unknown) {
  if (!result || typeof result !== 'object') return result
  const value = result as Record<string, unknown>
  const details = sanitizeDetails(value.details)
  return details === value.details ? value : { ...value, details }
}

function sanitizeDetails(details: unknown) {
  if (!details || typeof details !== 'object') return details
  const value = details as Record<string, unknown>
  if (typeof value.message !== 'string') return details
  return {
    ...value,
    message: 'Health check request failed.',
  }
}
