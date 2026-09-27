// Route-level provider registration checks (ER-0057) against a running ExceptAlert
// backed by an isolated database. Skipped unless both env vars are set:
//   EA_INTEGRATION_BASE_URL=http://localhost:3100
//   EA_INTEGRATION_DATABASE_URL=postgres://relay:relay@localhost:15432/relay_fault
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

const BASE = process.env.EA_INTEGRATION_BASE_URL
const DB_URL = process.env.EA_INTEGRATION_DATABASE_URL
const skip = !(BASE && DB_URL) && 'set EA_INTEGRATION_BASE_URL and EA_INTEGRATION_DATABASE_URL'

async function newOrg(label) {
  const email = `er0057-${label}-${randomUUID().slice(0, 8)}@example.test`
  const headers = { 'content-type': 'application/json', origin: BASE }
  const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `ER-0057 ${label}`, email, password: `Er0057-${randomUUID()}` }),
  })
  assert.equal(signup.status, 200, await signup.clone().text())
  const cookie = signup.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')

  const setup = await fetch(`${BASE}/api/setup/tenant`, {
    method: 'POST',
    headers: { ...headers, cookie },
    body: JSON.stringify({ name: `ER-0057 ${label} ${randomUUID().slice(0, 6)}` }),
  })
  assert.equal(setup.status, 200, await setup.clone().text())
  const { slug } = await setup.json()
  return { slug, cookie, email }
}

async function putProvider(org, providerId, secret) {
  return fetch(`${BASE}/api/${org.slug}/providers/${providerId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', origin: BASE, cookie: org.cookie },
    body: JSON.stringify({ secret_key: secret }),
  })
}

async function listCount(org) {
  const res = await fetch(`${BASE}/api/${org.slug}/providers`, { headers: { cookie: org.cookie } })
  assert.equal(res.status, 200)
  return (await res.json()).configuredProviderCount
}

test('provider registration writes and merges allow_unsigned and applies the contact-only limit exemption', { skip }, async (t) => {
  const sql = postgres(DB_URL, { max: 1 })
  t.after(() => sql.end())
  const tenantId = async (slug) => (await sql`SELECT id FROM tenants WHERE slug = ${slug}`)[0].id
  const config = async (slug, providerId) =>
    (await sql`SELECT p.config FROM tenant_providers p JOIN tenants t ON t.id = p.tenant_id
               WHERE t.slug = ${slug} AND p.provider_id = ${providerId}`)[0]?.config

  await t.test('updates merge allow_unsigned without dropping existing config keys (S5)', async () => {
    const org = await newOrg('merge')
    const id = await tenantId(org.slug)
    await sql`INSERT INTO tenant_providers (tenant_id, provider_id, secret_key, config)
              VALUES (${id}, 'supabase', '', ${sql.json({ proof_scope: 'kept' })})`
    assert.equal((await putProvider(org, 'supabase', '')).status, 200)
    assert.deepEqual(await config(org.slug, 'supabase'), { proof_scope: 'kept', allow_unsigned: true })

    assert.equal((await putProvider(org, 'supabase', 'now-signed')).status, 200)
    assert.deepEqual(await config(org.slug, 'supabase'), { proof_scope: 'kept', allow_unsigned: false })
  })

  await t.test('contact does not consume the free provider slot (S1 backfill)', async () => {
    const org = await newOrg('contact-free')
    const id = await tenantId(org.slug)
    await sql`INSERT INTO tenant_providers (tenant_id, provider_id, secret_key, signature_header, signature_algorithm, config)
              VALUES (${id}, 'contact', NULL, NULL, NULL, ${sql.json({ allow_unsigned: true })})
              ON CONFLICT (tenant_id, provider_id) DO NOTHING`
    assert.equal(await listCount(org), 0)
    assert.equal((await putProvider(org, 'stripe', 'whsec_er0057')).status, 200)
    assert.equal(await listCount(org), 1)
    const blocked = await putProvider(org, 'github', 'gh_er0057')
    assert.equal(blocked.status, 403, 'free limit still enforced for visible integrations')
  })

  await t.test('hidden customer integrations still consume a slot when registered', async () => {
    const org = await newOrg('hidden-counts')
    const id = await tenantId(org.slug)
    await sql`INSERT INTO tenant_providers (tenant_id, provider_id, secret_key, config)
              VALUES (${id}, 'datadog', 'dd_er0057', ${sql.json({})})`
    assert.equal(await listCount(org), 1)
    assert.equal((await putProvider(org, 'stripe', 'whsec_er0057')).status, 403)
  })

  await t.test('pro org: allow_unsigned written on new registrations; limit 5 unchanged apart from contact', async () => {
    const org = await newOrg('pro-limit')
    const id = await tenantId(org.slug)
    await sql`UPDATE tenants SET plan = 'pro' WHERE id = ${id}`
    await sql`INSERT INTO tenant_providers (tenant_id, provider_id, config)
              VALUES (${id}, 'contact', ${sql.json({ allow_unsigned: true })})`

    assert.equal((await putProvider(org, 'supabase', '')).status, 200)
    assert.deepEqual(await config(org.slug, 'supabase'), { allow_unsigned: true })
    assert.equal((await putProvider(org, 'stripe', 'whsec_er0057')).status, 200)
    assert.deepEqual(await config(org.slug, 'stripe'), { allow_unsigned: false })

    for (const [provider, secret] of [['github', 'b'], ['sentry', 'c'], ['vercel', 'd']]) {
      assert.equal((await putProvider(org, provider, secret)).status, 200, provider)
    }
    assert.equal(await listCount(org), 5)
    assert.equal((await putProvider(org, 'samsara', 'f')).status, 403)
  })
})
