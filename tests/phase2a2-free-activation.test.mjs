import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('new Free organizations get a dashboard activation path', () => {
  const dashboardPage = read('src/app/(app)/[slug]/dashboard/page.tsx')
  const dashboardClient = read('src/components/DashboardClient.tsx')
  const usage = read('src/lib/event-usage.ts')
  const eventTimeline = read('src/components/EventTimeline.tsx')
  const providersPage = read('src/app/(app)/[slug]/settings/providers/page.tsx')
  const teamPage = read('src/app/(app)/[slug]/settings/team/page.tsx')

  assert.match(dashboardPage, /tenantProviders/)
  assert.match(dashboardPage, /configuredProviderCount/)
  assert.match(dashboardPage, /totalEventCount/)
  assert.match(dashboardPage, /getMonthlyExternalEventUsage\(tenantId\)/)
  assert.match(dashboardClient, /Monthly usage/)
  assert.match(dashboardClient, /externalEventsPerMonth/)
  assert.match(dashboardClient, /currentMonthlyExternalEventCount/)
  assert.match(dashboardClient, /onMonthlyExternalEventCount/)
  assert.match(usage, /hook_%/)
  assert.match(usage, /source} <> 'auth'/)
  assert.match(usage, /category} <> 'test'/)
  assert.match(usage, /tags}->>'test'/)
  assert.match(dashboardClient, /showActivationPanel = totalEventCount === 0/)
  assert.match(dashboardClient, /Finish Free setup/)
  assert.match(dashboardClient, /Create one source/)
  assert.match(dashboardClient, /Send a test event/)
  assert.match(dashboardClient, /\/settings\/providers/)
  assert.match(dashboardClient, /suppressEmptyState=\{showActivationPanel\}/)
  assert.match(eventTimeline, /suppressEmptyState = false/)
  assert.match(eventTimeline, /if \(suppressEmptyState\) return null/)
  assert.match(eventTimeline, /monthlyExternalEventCount/)
  assert.match(eventTimeline, /No events yet\. Send a webhook to get started\./)
  assert.match(providersPage, /provider\.configured && !isConfiguring && providerTestResult/)
  assert.match(providersPage, /Send Test/)
  assert.match(providersPage, /View in dashboard/)
  assert.match(teamPage, /limitsFor\(tenant\.plan\)\.members/)
  assert.match(teamPage, /atMemberLimit/)
  assert.match(teamPage, /Free workspaces are single-user/)
})

test('platform admin owned workspaces get internal Growth entitlements', () => {
  const entitlements = read('src/lib/entitlements.ts')
  const setupRoute = read('src/app/api/setup/tenant/route.ts')
  const layout = read('src/app/(app)/[slug]/layout.tsx')
  const authGuard = read('src/lib/auth-guard.ts')

  assert.match(entitlements, /isPlatformAdminEmail/)
  assert.match(entitlements, /tenant\.createdByUserId === user\.id/)
  assert.match(entitlements, /role === 'owner'/)
  assert.match(entitlements, /return 'growth'/)
  assert.match(entitlements, /update\(tenants\)/)
  assert.match(setupRoute, /isPlatformAdminEmail\(session\.user\.email\) \? 'growth' : 'free'/)
  assert.match(layout, /membership\.role/)
  assert.match(authGuard, /membership\.role/)
})
