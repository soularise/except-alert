// ER-0065 operator-route test: register a provider through the real ExceptAlert routes, deliver a
// signed webhook to Relay at the displayed URL, and read the normalized event back through the
// authenticated event routes. A direct database read or "Test Connection" never counts as evidence;
// SQL is used only for guards, one corroborating read, and the synthetic stale-registration seed.
//
// Skipped unless every variable is set (no defaults by design):
//   EA_ONBOARD_BASE_URL=http://127.0.0.1:3102
//   EA_ONBOARD_RELAY_URL=http://127.0.0.1:13820
//   EA_ONBOARD_DATABASE_URL=postgres://relay:relay@127.0.0.1:15434/er0065_onboarding
//   EA_ONBOARD_EXPECT_DB_SYSTEM_ID=<digits>
//   EA_ONBOARD_PROVIDER=vercel
//   EA_ONBOARD_FIXTURE_DIR=<path to the Relay worktree tests/fixtures>
//   EA_ONBOARD_REPORT=<output path for the secret-free JSON report>
// Secrets, passwords and cookies are generated per run, held in memory, and never printed or written.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

const env = (name) => process.env[name]
const NAMES = [
  'EA_ONBOARD_BASE_URL',
  'EA_ONBOARD_RELAY_URL',
  'EA_ONBOARD_DATABASE_URL',
  'EA_ONBOARD_EXPECT_DB_SYSTEM_ID',
  'EA_ONBOARD_PROVIDER',
  'EA_ONBOARD_FIXTURE_DIR',
  'EA_ONBOARD_REPORT',
]
const skip = NAMES.some((n) => !env(n)) && `set ${NAMES.join(', ')}`

const BASE = env('EA_ONBOARD_BASE_URL')
const RELAY = env('EA_ONBOARD_RELAY_URL')
const PROVIDER = env('EA_ONBOARD_PROVIDER')

// Provider-specific expectations live here; the flow below is provider-neutral. A new provider adds
// one entry (fixture file, expected normalized event) and its signer to SIGNERS.
const CASES = {
  vercel: {
    fixture: 'vercel-doc-deployment-error.json',
    expected: {
      source: 'vercel',
      category: 'deployment.error',
      severity: 'error',
      title: 'synthetic-app: deployment.error',
      occurredAt: '2023-11-14T22:13:20.000Z',
    },
    oldAlgorithm: 'hmac-sha256',
  },
}
const SIGNERS = {
  'hmac-sha1': (secret, body) => createHmac('sha1', secret).update(body).digest('hex'),
  'hmac-sha256': (secret, body) => createHmac('sha256', secret).update(body).digest('hex'),
}

export function guardUrls(base, relay, databaseUrl) {
  const b = new URL(base)
  const r = new URL(relay)
  const d = new URL(databaseUrl)
  const ok =
    b.protocol === 'http:' && b.hostname === '127.0.0.1' && b.port === '3102' &&
    r.protocol === 'http:' && r.hostname === '127.0.0.1' && r.port === '13820' &&
    d.hostname === '127.0.0.1' && d.port === '15434' && d.pathname === '/er0065_onboarding'
  if (!ok) throw new Error('guard: only the er0065-onboarding loopback endpoints are allowed')
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

test('guard refuses anything but the disposable stack endpoints', () => {
  const good = ['http://127.0.0.1:3102', 'http://127.0.0.1:13820', 'postgres://relay:relay@127.0.0.1:15434/er0065_onboarding']
  assert.doesNotThrow(() => guardUrls(...good))
  for (const bad of [
    ['http://127.0.0.1:3100', good[1], good[2]],
    ['http://localhost:3102', good[1], good[2]],
    [good[0], 'http://127.0.0.1:13800', good[2]],
    [good[0], 'https://relay.exceptalert.com', good[2]],
    [good[0], good[1], 'postgres://relay:relay@127.0.0.1:15432/relay_fault'],
    [good[0], good[1], 'postgres://relay:relay@127.0.0.1:5432/relay'],
  ]) {
    assert.throws(() => guardUrls(...bad), /guard/)
  }
})

test('operator route: register, deliver a signed webhook, read the event', { skip }, async (t) => {
  guardUrls(BASE, RELAY, env('EA_ONBOARD_DATABASE_URL'))
  const spec = CASES[PROVIDER]
  assert.ok(spec, `no CASES entry for ${PROVIDER}`)
  const sql = postgres(env('EA_ONBOARD_DATABASE_URL'), { max: 1 })
  t.after(() => sql.end())

  const report = { provider: PROVIDER, steps: [], counts: { app_calls: 0, relay_deliveries: 0 } }
  const record = (step, ok, detail = {}) => report.steps.push({ step, ok, ...detail })
  t.after(() => writeFileSync(env('EA_ONBOARD_REPORT'), JSON.stringify(report, null, 2)))

  const app = async (path, init = {}) => {
    report.counts.app_calls += 1
    return fetch(`${BASE}${path}`, { redirect: 'manual', ...init })
  }
  const relay = async (url, body, headers) => {
    report.counts.relay_deliveries += 1
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body })
  }
  const baseHeaders = { 'content-type': 'application/json', origin: BASE }

  async function newOrg(label) {
    const email = `er0065-${label}-${randomUUID().slice(0, 8)}@example.test`
    const signup = await app('/api/auth/sign-up/email', {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ name: `ER-0065 ${label}`, email, password: `Er0065-${randomUUID()}` }),
    })
    assert.equal(signup.status, 200)
    const cookie = signup.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
    const setup = await app('/api/setup/tenant', {
      method: 'POST',
      headers: { ...baseHeaders, cookie },
      body: JSON.stringify({ name: `ER-0065 ${label} ${randomUUID().slice(0, 6)}` }),
    })
    assert.equal(setup.status, 200)
    const { slug } = await setup.json()
    return { slug, cookie }
  }
  const get = (org, path) => app(`/api/${org.slug}${path}`, { headers: { cookie: org.cookie, origin: BASE } })
  const put = (org, secret) =>
    app(`/api/${org.slug}/providers/${PROVIDER}`, {
      method: 'PUT',
      headers: { ...baseHeaders, cookie: org.cookie },
      body: JSON.stringify({ secret_key: secret }),
    })

  const body = readFileSync(join(env('EA_ONBOARD_FIXTURE_DIR'), spec.fixture))
  let orgA
  let orgB
  let hookA
  let eventId

  await t.test('1 guards: system id, pinned ten-migration ledger, no pilot table, baseline', async () => {
    const [{ id }] = await sql`SELECT system_identifier::text AS id FROM pg_control_system()`
    assert.equal(id, env('EA_ONBOARD_EXPECT_DB_SYSTEM_ID'))
    const [{ db }] = await sql`SELECT current_database() AS db`
    assert.equal(db, 'er0065_onboarding')
    const ledger = await sql`SELECT version::int AS version, success FROM _sqlx_migrations ORDER BY version`
    assert.deepEqual(ledger.map((r) => r.version), [1, 2, 3, 4, 5, 6, 8, 9, 10, 11])
    assert.ok(ledger.every((r) => r.success))
    const [{ pilot }] = await sql`SELECT to_regclass('public.canonical_events')::text AS pilot`
    assert.equal(pilot, null)
    const [{ tenants }] = await sql`SELECT count(*)::int AS tenants FROM tenants`
    record('1 guards', true, { baseline_tenants: tenants, ledger_versions: ledger.length })
  })

  await t.test('2 synthetic users and organizations through the real sign-up and setup routes', async () => {
    orgA = await newOrg('a')
    orgB = await newOrg('b')
    assert.notEqual(orgA.slug, orgB.slug)
    record('2 organizations', true)
  })

  await t.test('3 discovery: the catalog lists the provider with the corrected scheme', async () => {
    const res = await get(orgA, '/providers')
    assert.equal(res.status, 200)
    const { providers } = await res.json()
    const entry = providers.find((p) => p.id === PROVIDER)
    assert.ok(entry, 'provider listed and not hidden')
    assert.equal(entry.configured, false)
    assert.equal(entry.signatureHeader, 'x-vercel-signature')
    assert.equal(entry.signatureAlgorithm, 'hmac-sha1')
    assert.match(entry.signatureLabel, /SHA1/)
    assert.ok(entry.configHelp)
    record('3 discovery', true, { algorithm: entry.signatureAlgorithm, header: entry.signatureHeader })
  })

  const secretA = randomBytes(32).toString('hex')
  let webhookUrl

  await t.test('4 registration through the real PUT route', async () => {
    const res = await put(orgA, secretA)
    assert.equal(res.status, 200)
    const detail = await (await get(orgA, `/providers/${PROVIDER}`)).json()
    assert.equal(detail.configured, true)
    assert.ok(!JSON.stringify(detail).includes(secretA), 'the secret is never returned')
    webhookUrl = detail.webhookUrl
    assert.ok(webhookUrl && webhookUrl.startsWith(`${RELAY}/hook/`) && webhookUrl.endsWith(`/${PROVIDER}`))
    const [row] = await sql`
      SELECT p.signature_header, p.signature_algorithm, p.config
      FROM tenant_providers p JOIN tenants t ON t.id = p.tenant_id
      WHERE t.slug = ${orgA.slug} AND p.provider_id = ${PROVIDER}`
    assert.equal(row.signature_algorithm, 'hmac-sha1')
    assert.equal(row.signature_header, 'x-vercel-signature')
    assert.deepEqual(row.config, { allow_unsigned: false })
    record('4 registration', true, { webhook_url_shape: 'relay-origin/hook/<ingress-key>/<provider>', stored_algorithm: row.signature_algorithm })
  })

  await t.test('5 signed Relay delivery at the displayed URL, and the wrong-scheme control', async () => {
    const good = await relay(webhookUrl, body, { 'x-vercel-signature': SIGNERS['hmac-sha1'](secretA, body) })
    const json = await good.json()
    assert.equal(good.status, 200)
    assert.equal(json.status, 'accepted')
    hookA = json.hook_id
    const bad = await relay(webhookUrl, body, { 'x-vercel-signature': SIGNERS['hmac-sha256'](secretA, body) })
    assert.equal(bad.status, 401)
    record('5 delivery', true, { positive: 200, wrong_scheme: 401 })
  })

  await t.test('6 authenticated ExceptAlert event read and detail', async () => {
    let found
    for (let i = 0; i < 10 && !found; i += 1) {
      const res = await get(orgA, '/events')
      assert.equal(res.status, 200)
      found = (await res.json()).events.find((e) => e.hookId === hookA)
      if (!found) await new Promise((r) => setTimeout(r, 1000))
    }
    assert.ok(found, 'event visible through the authenticated list')
    for (const [key, value] of Object.entries(spec.expected)) assert.equal(found[key], value, key)
    const detail = await (await get(orgA, `/events/${found.id}`)).json()
    assert.equal(detail.event.hookId, hookA)
    assert.equal(detail.auditLog.length, 1)
    assert.equal(detail.auditLog[0].status, 'processed')
    record('6 event visibility', true, { fields_compared: Object.keys(spec.expected), audit_rows: detail.auditLog.length })
    eventId = found.id
  })

  await t.test('7 controls: unauthenticated and cross-organization reads are refused', async () => {
    const anon = await app(`/api/${orgA.slug}/events`)
    assert.equal(anon.status, 401)
    const cross = await get({ slug: orgA.slug, cookie: orgB.cookie }, '/events')
    assert.ok([401, 403, 404].includes(cross.status), `cross-organization list status ${cross.status}`)
    const crossDetail = await get({ slug: orgA.slug, cookie: orgB.cookie }, `/events/${eventId}`)
    assert.ok([401, 403, 404].includes(crossDetail.status))
    record('7 controls', true, { anonymous: anon.status, cross_org_list: cross.status, cross_org_detail: crossDetail.status })
  })

  await t.test('8 stale registration: a blank-secret PUT refreshes the algorithm and preserves the secret', async () => {
    const oldSecret = randomBytes(32).toString('hex')
    const [tenant] = await sql`SELECT id FROM tenants WHERE slug = ${orgB.slug}`
    await sql`INSERT INTO tenant_providers (tenant_id, provider_id, secret_key, signature_header, signature_algorithm, config)
              VALUES (${tenant.id}, ${PROVIDER}, ${oldSecret}, 'x-vercel-signature', ${spec.oldAlgorithm}, ${sql.json({ allow_unsigned: false })})`
    const detailB = await (await get(orgB, `/providers/${PROVIDER}`)).json()
    const urlB = detailB.webhookUrl
    const before = await relay(urlB, body, { 'x-vercel-signature': SIGNERS['hmac-sha1'](oldSecret, body) })
    assert.equal(before.status, 401, 'a stale row rejects genuine-scheme deliveries')

    const res = await put(orgB, '')
    assert.equal(res.status, 200)
    const [row] = await sql`SELECT signature_algorithm, signature_header, secret_key FROM tenant_providers WHERE tenant_id = ${tenant.id} AND provider_id = ${PROVIDER}`
    assert.equal(row.signature_algorithm, 'hmac-sha1')
    assert.equal(row.signature_header, 'x-vercel-signature')
    assert.equal(sha256(row.secret_key), sha256(oldSecret), 'the stored secret is unchanged (compared by digest, never printed)')

    const after = await relay(urlB, body, { 'x-vercel-signature': SIGNERS['hmac-sha1'](oldSecret, body) })
    const afterJson = await after.json()
    assert.equal(after.status, 200)
    assert.equal(afterJson.status, 'accepted')
    let seen
    for (let i = 0; i < 10 && !seen; i += 1) {
      seen = (await (await get(orgB, '/events')).json()).events.find((e) => e.hookId === afterJson.hook_id)
      if (!seen) await new Promise((r) => setTimeout(r, 1000))
    }
    assert.ok(seen, 'event visible after the refresh')
    record('8 stale refresh', true, { before_refresh: before.status, after_refresh: after.status, secret_preserved: true })
  })

  await t.test('9 notification suppression: no settings rows for the run organizations', async () => {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM settings s JOIN tenants t ON t.id = s.tenant_id WHERE t.slug IN (${orgA.slug}, ${orgB.slug})`
    assert.equal(n, 0)
    record('9 settings rows', true, { rows: n })
  })
})
