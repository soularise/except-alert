import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('upgrade requests have durable storage and active-request guardrails', () => {
  const migration = read('drizzle/migrations/0013_upgrade_requests.sql')
  const schema = read('src/lib/db/schema.ts')

  assert.match(migration, /CREATE TABLE IF NOT EXISTS upgrade_requests/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS tenant_plan_changes/)
  assert.match(migration, /requested_plan\s+TEXT NOT NULL CHECK \(requested_plan IN \('pro', 'growth'\)\)/)
  assert.match(migration, /status\s+TEXT NOT NULL DEFAULT 'open'/)
  assert.match(migration, /payment_sent/)
  assert.match(migration, /paid/)
  assert.match(migration, /approved/)
  assert.match(migration, /upgrade_requests_one_active_per_tenant/)
  assert.match(schema, /export const upgradeRequests = pgTable/)
  assert.match(schema, /uniqueIndex\('upgrade_requests_one_active_per_tenant'\)/)
})

test('tenant upgrade request route is tenant scoped and notifies platform admin', () => {
  const route = read('src/app/api/[slug]/upgrade-requests/route.ts')
  const notification = read('src/lib/platform-notifications.ts')

  assert.match(route, /requireTenantAccess\(request, slug, 'admin'\)/)
  assert.match(route, /requestedPlan: z\.enum\(\['pro', 'growth'\]\)/)
  assert.match(route, /inArray\(upgradeRequests\.status, \['open', 'payment_sent', 'paid'\]\)/)
  assert.match(route, /notifyPlatformUpgradeRequest/)
  assert.match(notification, /EXCEPTALERT_ADMIN_TELEGRAM_BOT_TOKEN/)
  assert.match(notification, /EXCEPTALERT_ADMIN_TELEGRAM_CHAT_ID/)
  assert.match(notification, /\/admin/)
})

test('grand admin can track payment and approve upgrade requests manually', () => {
  const route = read('src/app/api/admin/upgrade-requests/[id]/route.ts')
  const page = read('src/app/admin/page.tsx')
  const actions = read('src/components/AdminUpgradeRequestActions.tsx')

  assert.match(route, /getAdminSession\(request\.headers\)/)
  assert.match(route, /z\.enum\(\['payment_sent', 'paid', 'approved', 'declined'\]\)/)
  assert.match(route, /changeOrganizationPlan/)
  assert.match(route, /reason: 'upgrade_request_approved'/)
  assert.match(page, /Upgrade Requests/)
  assert.match(page, /AdminUpgradeRequestActions/)
  assert.match(actions, /Payment sent/)
  assert.match(actions, /Mark paid/)
  assert.match(actions, /Approve/)
})

test('free limit surfaces include upgrade request actions', () => {
  const team = read('src/app/(app)/[slug]/settings/team/page.tsx')
  const providers = read('src/app/(app)/[slug]/settings/providers/page.tsx')
  const controllers = read('src/app/(app)/[slug]/settings/controller-jobs/page.tsx')

  for (const source of [team, providers, controllers]) {
    assert.match(source, /UpgradeRequestButton/)
  }

  assert.match(team, /source="team_limit"/)
  assert.match(providers, /source="source_limit"/)
  assert.match(controllers, /source="controller_jobs"/)
})
