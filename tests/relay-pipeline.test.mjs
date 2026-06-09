import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))

const RELAY_BASE = 'http://localhost:3800'
const DATABASE_URL = 'postgres://relay:relay@localhost:5432/relay'
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

function fixture(name) {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'))
}

async function postToRelay(provider, body) {
  const res = await fetch(`${RELAY_BASE}/hook/${provider}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res
}

let sql

before(() => {
  sql = postgres(DATABASE_URL)
})

after(async () => {
  await sql.end()
})

test('stripe charge.failed — deep assertions', async (t) => {
  let hookId

  t.after(async () => {
    if (hookId) await sql`DELETE FROM events WHERE hook_id = ${hookId}`
  })

  const body = fixture('stripe-charge-failed.json')
  const res = await postToRelay('stripe', body)
  assert.equal(res.status, 200, `Relay returned ${res.status}`)

  const data = await res.json()
  hookId = data.hook_id
  assert.ok(hookId, 'Relay response missing hook_id')

  const [event] = await sql`SELECT * FROM events WHERE hook_id = ${hookId}`
  assert.ok(event, `No event row found for hook_id ${hookId}`)

  assert.equal(event.source, 'stripe')
  assert.equal(event.severity, 'error')
  assert.equal(event.category, 'stripe.charge.failed')
  assert.equal(event.title, 'charge.failed: ch_3NzQKL2eZvKYlo2C0XVz4Y1s')
  assert.equal(event.description, 'Your card was declined. Network status: declined_by_network')
  assert.deepEqual(event.tags, { charge_id: 'ch_3NzQKL2eZvKYlo2C0XVz4Y1s' })
  assert.deepEqual(event.payload, body)
  assert.equal(event.tenant_id, DEFAULT_TENANT_ID)
  assert.equal(event.occurred_at.getTime(), new Date(1748872200 * 1000).getTime())
})

test('stripe charge.refunded — deep assertions', async (t) => {
  let hookId

  t.after(async () => {
    if (hookId) await sql`DELETE FROM events WHERE hook_id = ${hookId}`
  })

  const body = fixture('stripe-charge-refunded.json')
  const res = await postToRelay('stripe', body)
  const text = await res.text()
  assert.equal(res.status, 200, `Relay returned ${res.status}: ${text}`)
  const data = JSON.parse(text)
  hookId = data.hook_id
  assert.ok(hookId, 'Relay response missing hook_id')

  const [event] = await sql`SELECT * FROM events WHERE hook_id = ${hookId}`
  assert.ok(event, `No event row found for hook_id ${hookId}`)

  assert.equal(event.source, 'stripe')
  assert.equal(event.severity, 'info')
  assert.equal(event.category, 'stripe.charge.refunded')
  assert.equal(event.title, 'charge.refunded: ch_3NzQKL2eZvKYlo2C0Refund')
  assert.equal(event.description, '')
  assert.deepEqual(event.tags, { charge_id: 'ch_3NzQKL2eZvKYlo2C0Refund' })
  assert.deepEqual(event.payload, body)
  assert.equal(event.tenant_id, DEFAULT_TENANT_ID)
  assert.equal(event.occurred_at.getTime(), new Date(1748875800 * 1000).getTime())
})

test('stripe payment_intent.succeeded — deep assertions', async (t) => {
  let hookId

  t.after(async () => {
    if (hookId) await sql`DELETE FROM events WHERE hook_id = ${hookId}`
  })

  const body = fixture('stripe-payment-intent-succeeded.json')
  const res = await postToRelay('stripe', body)
  const text = await res.text()
  assert.equal(res.status, 200, `Relay returned ${res.status}: ${text}`)
  const data = JSON.parse(text)
  hookId = data.hook_id
  assert.ok(hookId, 'Relay response missing hook_id')

  const [event] = await sql`SELECT * FROM events WHERE hook_id = ${hookId}`
  assert.ok(event, `No event row found for hook_id ${hookId}`)

  assert.equal(event.source, 'stripe')
  assert.equal(event.severity, 'info')
  assert.equal(event.category, 'stripe.payment_intent.succeeded')
  assert.equal(event.title, 'payment_intent.succeeded: pi_3NzQKL2eZvKYlo2C0PISucc')
  assert.equal(event.description, '')
  assert.deepEqual(event.tags, { charge_id: 'pi_3NzQKL2eZvKYlo2C0PISucc' })
  assert.deepEqual(event.payload, body)
  assert.equal(event.tenant_id, DEFAULT_TENANT_ID)
  assert.equal(event.occurred_at.getTime(), new Date(1748879400 * 1000).getTime())
})

test('github workflow-run-failed — shallow smoke test', async (t) => {
  let hookId

  t.after(async () => {
    if (hookId) await sql`DELETE FROM events WHERE hook_id = ${hookId}`
  })

  const body = fixture('github-workflow-run-failed.json')
  const res = await postToRelay('github', body)
  const text = await res.text()
  assert.equal(res.status, 200, `Relay returned ${res.status}: ${text}`)
  const data = JSON.parse(text)
  hookId = data.hook_id
  assert.ok(hookId, 'Relay response missing hook_id')

  const [event] = await sql`SELECT * FROM events WHERE hook_id = ${hookId}`
  assert.ok(event, `No event row found for hook_id ${hookId}`)
  assert.equal(event.source, 'github')
  assert.equal(event.tenant_id, DEFAULT_TENANT_ID)
})
