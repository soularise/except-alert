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

  assert.match(dashboardPage, /tenantProviders/)
  assert.match(dashboardPage, /configuredProviderCount/)
  assert.match(dashboardPage, /totalEventCount/)
  assert.match(dashboardClient, /showActivationPanel = totalEventCount === 0/)
  assert.match(dashboardClient, /Finish Free setup/)
  assert.match(dashboardClient, /Create one source/)
  assert.match(dashboardClient, /Send a test event/)
  assert.match(dashboardClient, /\/settings\/providers/)
})
