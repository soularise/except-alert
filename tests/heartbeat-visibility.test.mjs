import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PROVIDERS, HEARTBEAT_PROVIDER_IDS, wantsHeartbeats } from '../src/lib/providers.ts'

const root = new URL('..', import.meta.url).pathname
const read = (path) => readFileSync(join(root, path), 'utf8')

// agent-observation emits agent.execution.heartbeat run telemetry that agent_run_deadline reads; it is not a liveness source.
const NON_HEARTBEAT_HEARTBEAT_CATEGORIES = new Set(['agent-observation'])

test('only the LAN watchdog sources are flagged as heartbeat providers', () => {
  assert.deepEqual([...HEARTBEAT_PROVIDER_IDS].sort(), ['pi-watchdog-m1', 'pi-watchdog-self'])
  for (const id of ['agent-observation', 'stripe', 'contact']) {
    assert.notEqual(PROVIDERS.find((p) => p.id === id)?.heartbeat, true, id)
  }
  assert.equal(HEARTBEAT_PROVIDER_IDS.includes('controller'), false)
})

test('providers with a .heartbeat category must be flagged unless explicitly allow-listed', () => {
  for (const provider of PROVIDERS) {
    const hasHeartbeatCategory = provider.eventCategories.some((c) => c.value.endsWith('.heartbeat'))
    if (!hasHeartbeatCategory || NON_HEARTBEAT_HEARTBEAT_CATEGORIES.has(provider.id)) continue
    assert.equal(provider.heartbeat, true, `${provider.id} has a heartbeat category but no heartbeat flag`)
  }
})

test('includeHeartbeats treats 1 and true as on and everything else as off', () => {
  assert.equal(wantsHeartbeats('1'), true)
  assert.equal(wantsHeartbeats('true'), true)
  for (const value of ['0', 'false', '', 'yes', null, undefined]) assert.equal(wantsHeartbeats(value), false, String(value))
})

test('API, tiles and checkbox share the same includeHeartbeats parser', () => {
  assert.match(read('src/app/(app)/[slug]/dashboard/page.tsx'), /wantsHeartbeats\(filters\.includeHeartbeats\)/)
  assert.match(read('src/components/FilterBar.tsx'), /checked=\{wantsHeartbeats\(filters\.includeHeartbeats\)\}/)
})

test('events API hides heartbeats by default and lifts the exclusion on explicit filters', () => {
  const route = read('src/app/api/[slug]/events/route.ts')

  assert.match(route, /notInArray\(events\.source, HEARTBEAT_PROVIDER_IDS\)/)
  assert.match(route, /!includeHeartbeats && !source && !category/)
  assert.match(route, /wantsHeartbeats\(searchParams\.get\('includeHeartbeats'\)\)/)
  assert.match(route, /gte\(events\.receivedAt, sixtySecondsAgo\), hideHeartbeats/)
  assert.match(route, /getMonthlyExternalEventUsage\(access\.tenant\.id\)/)
})

test('dashboard Open and Critical tiles hide heartbeats; the activation total does not', () => {
  const page = read('src/app/(app)/[slug]/dashboard/page.tsx')
  const total = page.slice(page.indexOf('db\n      .select({ value: count() })\n      .from(events)\n      .where(eq(events.tenantId, tenantId))'))

  assert.match(page, /eq\(events\.status, 'open'\), hideHeartbeats/)
  assert.match(page, /not\(inArray\(events\.status, \['resolved', 'dismissed'\]\)\),\s*hideHeartbeats/)
  assert.match(total, /\.where\(eq\(events\.tenantId, tenantId\)\)\s*\.then/)
})

test('silence evaluation and usage accounting do not read status, category or heartbeat flags', () => {
  const controller = read('src/lib/controller.ts')
  const start = controller.indexOf('async function countProviderEvents')
  const helper = controller.slice(start, controller.indexOf('\nasync function', start + 1))
  const usage = read('src/lib/event-usage.ts')

  assert.match(helper, /eq\(events\.tenantId, tenantId\)/)
  assert.match(helper, /eq\(events\.source, providerId\)/)
  assert.match(helper, /gte\(events\.receivedAt, since\)/)
  assert.doesNotMatch(helper, /status|category|severity|HEARTBEAT/)
  assert.doesNotMatch(usage, /events\.status|HEARTBEAT|heartbeat/i)
  assert.doesNotMatch(controller, /HEARTBEAT_PROVIDER_IDS/)
})

test('the Show heartbeats toggle is wired from the filter bar to the API URL', () => {
  assert.match(read('src/components/FilterBar.tsx'), /updateParam\('includeHeartbeats'/)
  assert.match(read('src/components/EventTimeline.tsx'), /params\.set\('includeHeartbeats'/)
})
