import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('controller job migration creates the Phase 2B scheduler table', () => {
  const migration = read('drizzle/migrations/0009_controller_jobs.sql')
  const schema = read('src/lib/db/schema.ts')

  assert.match(migration, /CREATE TABLE IF NOT EXISTS controller_jobs/)
  assert.match(migration, /type\s+TEXT NOT NULL CHECK \(type IN \('health_ping', 'dead_letter', 'cron_deadline', 'deviation'\)\)/)
  assert.match(migration, /last_status\s+TEXT NOT NULL DEFAULT 'pending'/)
  assert.match(migration, /CHECK \(last_status IN \('pending', 'ok', 'alert', 'error'\)\)/)
  assert.match(migration, /CONSTRAINT controller_jobs_tenant_name_unique UNIQUE \(tenant_id, name\)/)
  assert.match(migration, /idx_controller_jobs_due/)
  assert.match(migration, /WHERE enabled = true/)
  assert.match(schema, /export const controllerJobs = pgTable/)
  assert.match(schema, /cronExpr:\s+text\('cron_expr'\)\.notNull\(\)\.default\('\*\/5 \* \* \* \*'\)/)
  assert.match(schema, /leaseExpiresAt:\s+timestamptz\('lease_expires_at'\)/)
  assert.match(schema, /lastResult:\s+jsonb\('last_result'\)/)
  assert.match(schema, /controller_jobs_tenant_name_unique/)
  assert.match(schema, /idx_controller_jobs_due'\)\.on\(t\.nextRunAt\)\.where/)
})

test('controller job validators cover all first-wave job types', () => {
  const validators = read('src/lib/controller-jobs.ts')

  assert.match(validators, /CONTROLLER_JOB_TYPES = \[/)
  assert.match(validators, /health_ping/)
  assert.match(validators, /dead_letter/)
  assert.match(validators, /cron_deadline/)
  assert.match(validators, /deviation/)
  assert.match(validators, /isValidFiveFieldCron/)
  assert.match(validators, /isValidTimeZone/)
  assert.match(validators, /URL must use HTTP or HTTPS/)
  assert.match(validators, /URL must not include credentials/)
  assert.match(validators, /direction: z\.enum\(\['spike', 'drop', 'both'\]\)/)
  assert.match(validators, /providerIdForControllerJob/)
})

test('controller job API enforces tenant roles, provider ownership, and plan limits', () => {
  const listRoute = read('src/app/api/[slug]/controller-jobs/route.ts')
  const detailRoute = read('src/app/api/[slug]/controller-jobs/[id]/route.ts')
  const planLimits = read('src/lib/plan-limits.ts')

  assert.match(planLimits, /controllerJobs: 0/)
  assert.match(planLimits, /controllerJobs: 5/)
  assert.match(planLimits, /export function canCreateControllerJob/)

  assert.match(listRoute, /requireTenantAccess\(request, slug, 'viewer'\)/)
  assert.match(listRoute, /requireTenantAccess\(request, slug, 'admin'\)/)
  assert.match(listRoute, /eq\(controllerJobs\.tenantId, access\.tenant\.id\)/)
  assert.match(listRoute, /pg_advisory_xact_lock/)
  assert.match(listRoute, /canCreateControllerJob\(access\.tenant\.plan/)
  assert.match(listRoute, /providerIdForControllerJob/)
  assert.match(listRoute, /tenantProviders\.tenantId, access\.tenant\.id/)
  assert.match(listRoute, /tenantProviders\.providerId, providerId/)

  assert.match(detailRoute, /requireTenantAccess\(request, slug, 'viewer'\)/)
  assert.match(detailRoute, /requireTenantAccess\(request, slug, 'admin'\)/)
  assert.match(detailRoute, /and\(eq\(controllerJobs\.id, id\), eq\(controllerJobs\.tenantId, access\.tenant\.id\)\)/)
  assert.match(detailRoute, /controllerJobWriteSchema\.parse/)
  assert.match(detailRoute, /providerIdForControllerJob/)
  assert.match(detailRoute, /tenantProviders\.tenantId, access\.tenant\.id/)
})

test('controller job settings UI exposes plan-aware management', () => {
  const settingsLayout = read('src/app/(app)/[slug]/settings/layout.tsx')
  const page = read('src/app/(app)/[slug]/settings/controller-jobs/page.tsx')

  assert.match(settingsLayout, /Controllers/)
  assert.match(settingsLayout, /controller-jobs/)
  assert.match(page, /fetch\(`\/api\/\$\{tenant\.slug\}\/controller-jobs`\)/)
  assert.match(page, /fetch\(`\/api\/\$\{tenant\.slug\}\/providers`\)/)
  assert.match(page, /limitsFor\(tenant\.plan\)\.controllerJobs/)
  assert.match(page, /controllerLimit === 0/)
  assert.match(page, /Active monitoring requires Pro or Growth/)
  assert.match(page, /role === 'owner' \|\| role === 'admin'/)
  assert.match(page, /configuredProviders/)
  assert.match(page, /method: 'POST'/)
  assert.match(page, /method: 'PATCH'/)
  assert.match(page, /method: 'DELETE'/)
  assert.match(page, /Health ping/)
  assert.match(page, /Silence/)
  assert.match(page, /Deadline/)
  assert.match(page, /Deviation/)
})

test('controller scheduler skeleton claims due jobs and records provider evaluations', () => {
  const controller = read('src/lib/controller.ts')

  assert.match(controller, /export async function runControllerScheduler/)
  assert.match(controller, /export async function claimDueControllerJobs/)
  assert.match(controller, /FOR UPDATE SKIP LOCKED/)
  assert.match(controller, /lease_expires_at/)
  assert.match(controller, /finishControllerJob/)
  assert.match(controller, /lastStatus: result\.status/)
  assert.match(controller, /lastResult: result/)
  assert.match(controller, /nextRunAfter\(now, job\.cronExpr\)/)
  assert.match(controller, /evaluateDeadLetter/)
  assert.match(controller, /evaluateCronDeadline/)
  assert.match(controller, /eq\(events\.tenantId, tenantId\)/)
  assert.match(controller, /eq\(events\.source, providerId\)/)
  assert.match(controller, /health_ping_deferred/)
  assert.match(controller, /deviation_deferred/)
})

test('controller scheduler records dashboard events on state transitions', () => {
  const controller = read('src/lib/controller.ts')

  assert.match(controller, /recordControllerTransition/)
  assert.match(controller, /insertControllerEvent/)
  assert.match(controller, /source: 'controller'/)
  assert.match(controller, /category: `controller\.\$\{job\.type\}`/)
  assert.match(controller, /controllerEventHookId/)
  assert.match(controller, /transition: 'alert' \| 'error' \| 'recovery'/)
  assert.match(controller, /previousStatus !== 'alert'/)
  assert.match(controller, /previousStatus !== 'error'/)
  assert.match(controller, /previousStatus === 'alert' \|\| previousStatus === 'error'/)
  assert.match(controller, /alertStartedAt: null/)
  assert.match(controller, /lastAlertedAt: now/)
  assert.match(controller, /controllerJobId: job\.id/)
})

test('internal controller route requires a timing-safe secret and runs scheduler counts', () => {
  const route = read('src/app/api/internal/controller/route.ts')

  assert.match(route, /process\.env\.CONTROLLER_SECRET/)
  assert.match(route, /x-controller-secret/)
  assert.match(route, /timingSafeEqual/)
  assert.match(route, /leftBuffer\.length !== rightBuffer\.length/)
  assert.match(route, /runControllerScheduler\(\)/)
  assert.match(route, /NextResponse\.json\(\{ ok: true, counts \}\)/)
  assert.match(route, /status: 404/)
  assert.match(route, /status: 503/)
})
