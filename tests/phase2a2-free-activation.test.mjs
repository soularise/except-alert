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
  const eventTimeline = read('src/components/EventTimeline.tsx')
  const providersPage = read('src/app/(app)/[slug]/settings/providers/page.tsx')
  const teamPage = read('src/app/(app)/[slug]/settings/team/page.tsx')

  assert.match(dashboardPage, /tenantProviders/)
  assert.match(dashboardPage, /configuredProviderCount/)
  assert.match(dashboardPage, /totalEventCount/)
  assert.match(dashboardClient, /showActivationPanel = totalEventCount === 0/)
  assert.match(dashboardClient, /Finish Free setup/)
  assert.match(dashboardClient, /Create one source/)
  assert.match(dashboardClient, /Send a test event/)
  assert.match(dashboardClient, /\/settings\/providers/)
  assert.match(dashboardClient, /suppressEmptyState=\{showActivationPanel\}/)
  assert.match(eventTimeline, /suppressEmptyState = false/)
  assert.match(eventTimeline, /if \(suppressEmptyState\) return null/)
  assert.match(eventTimeline, /No events yet\. Send a webhook to get started\./)
  assert.match(providersPage, /provider\.configured && !isConfiguring && providerTestResult/)
  assert.match(providersPage, /Send Test/)
  assert.match(providersPage, /View in dashboard/)
  assert.match(teamPage, /limitsFor\(tenant\.plan\)\.members/)
  assert.match(teamPage, /atMemberLimit/)
  assert.match(teamPage, /Free workspaces are single-user/)
})
