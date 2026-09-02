import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url).pathname
const read = (path) => readFileSync(join(root, path), 'utf8')

test('Agent Ops proof fixture keeps healthy history completed and non-alerting', () => {
  const fixture = read('src/lib/agent-ops-proof-fixture.ts')

  assert.match(fixture, /run-er0032-healthy-30m-detached/)
  assert.match(fixture, /status: 'completed'/)
  assert.match(fixture, /duration: '30 minutes'/)
  assert.match(fixture, /checkpoints: 4/)
  assert.match(fixture, /No attention-worthy exception/)
  assert.match(fixture, /evaluation\.passed/)
})

test('Agent Ops proof fixture preserves the grouped silence and failure evidence', () => {
  const fixture = read('src/lib/agent-ops-proof-fixture.ts')
  const component = read('src/components/AgentOpsProofView.tsx')

  assert.match(fixture, /run-er0033-silence-90m-detached/)
  assert.match(fixture, /status: 'failed'/)
  assert.match(fixture, /expected_by/)
  assert.match(fixture, /controller\.silence_detected/)
  assert.match(fixture, /manual local derivation/)
  assert.match(fixture, /controller_implemented: false/)
  assert.match(fixture, /agent\.failed/)
  assert.match(fixture, /run\.failed/)
  assert.match(component, /One grouped deviation/)
})

test('Agent Ops proof collapses lifecycle noise and renders proof caveats', () => {
  const component = read('src/components/AgentOpsProofView.tsx')

  assert.match(component, /Collapsed lifecycle activity/)
  assert.match(component, /retained routine records/)
  assert.match(component, /Why these records are collapsed/)
  assert.match(component, /Local replay evidence proof/)
  assert.match(component, /Not production Agent Ops/)
  assert.match(component, /no live controller, notification, action, or database behavior/i)
})

test('Agent Ops proof remains unlinked, read-only, and development-only', () => {
  const page = read('src/app/(app)/[slug]/proofs/agent-ops-runs/page.tsx')
  const component = read('src/components/AgentOpsProofView.tsx')
  const sidebar = read('src/components/AppSidebar.tsx')

  assert.match(page, /NODE_ENV === 'production'/)
  assert.match(page, /notFound\(\)/)
  assert.doesNotMatch(component, /\bfetch\(/)
  assert.doesNotMatch(component, /\/api\//)
  assert.doesNotMatch(component, /HitlActionPanel/)
  assert.doesNotMatch(sidebar, /agent-ops-runs/)
})
