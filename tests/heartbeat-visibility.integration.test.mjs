// ER-0059 database-backed checks against a locally running ExceptAlert and the disposable ER-0050 database.
// Skipped unless all of these are set:
//   EA_INTEGRATION_BASE_URL=http://localhost:3100
//   EA_INTEGRATION_DATABASE_URL=postgres://relay:relay@localhost:15432/relay_fault
//   EA_INTEGRATION_CONTROLLER_SECRET=<the CONTROLLER_SECRET the app was started with>
//
// The controller scheduler runs every due job in its database and the app can notify externally, so this file refuses
// to write or call anything until it has verified, in order:
//   1. the app URL and database URL are exactly the designated local targets;
//   2. the database is relay_fault and holds no controller jobs other than er0059-* test jobs, no action bindings or
//      templates, and no Slack/Teams/Telegram settings;
//   3. after one rejected, non-writing sign-in probe, the process listening on the app port holds connections only to
//      the designated database port (the app's environment is not readable on this host, so connections are the proof).
// After the test org is created it also confirms that org exists in the designated database.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

const BASE = process.env.EA_INTEGRATION_BASE_URL
const DB_URL = process.env.EA_INTEGRATION_DATABASE_URL
const SECRET = process.env.EA_INTEGRATION_CONTROLLER_SECRET
const skip = !(BASE && DB_URL && SECRET) && 'set EA_INTEGRATION_BASE_URL, EA_INTEGRATION_DATABASE_URL and EA_INTEGRATION_CONTROLLER_SECRET'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const DESIGNATED_APP_PORT = '3100'
const DESIGNATED_DB = { port: '15432', name: 'relay_fault', user: 'relay' }
const NOTIFICATION_SETTING_KEYS = ['slack_webhook_url', 'teams_webhook_url', 'telegram_bot_token', 'telegram_chat_id']

function assertDesignatedTargets() {
  const app = new URL(BASE)
  assert.ok(LOCAL_HOSTS.has(app.hostname) && app.port === DESIGNATED_APP_PORT && app.protocol === 'http:', `refusing app target ${app.origin}`)
  const db = new URL(DB_URL)
  assert.ok(LOCAL_HOSTS.has(db.hostname), `refusing database host ${db.hostname}`)
  assert.equal(db.port, DESIGNATED_DB.port, 'refusing database port')
  assert.equal(db.pathname, `/${DESIGNATED_DB.name}`, 'refusing database name')
  assert.equal(decodeURIComponent(db.username), DESIGNATED_DB.user, 'refusing database user')
}

function sh(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim()
}

async function assertAppUsesDesignatedDatabase() {
  // A rejected sign-in for an unknown user reads the database without writing, so the app opens its connection.
  const probe = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email: 'er0059-probe@example.test', password: 'probe' }),
  })
  assert.equal(probe.status, 401, 'identity probe was not rejected as expected')
  const listeners = sh('lsof', ['-nP', `-iTCP:${DESIGNATED_APP_PORT}`, '-sTCP:LISTEN', '-t']).split('\n').filter(Boolean)
  assert.ok(listeners.length > 0, `nothing is listening on ${DESIGNATED_APP_PORT}`)
  for (const pid of new Set(listeners)) {
    const established = sh('lsof', ['-nP', '-a', '-p', pid, '-iTCP', '-sTCP:ESTABLISHED', '-Fn']).split('\n').filter((l) => l.startsWith('n'))
    const outbound = established.filter((l) => !l.split('->')[0].endsWith(`:${DESIGNATED_APP_PORT}`))
    const remotePorts = outbound.map((l) => l.split('->')[1]?.split(':').pop())
    assert.ok(remotePorts.includes(DESIGNATED_DB.port), `listener ${pid} has no connection to the designated database port`)
    assert.ok(remotePorts.every((port) => port === DESIGNATED_DB.port), `listener ${pid} has connections to other ports: ${remotePorts.join(',')}`)
  }
}

async function assertControllerScope(sql) {
  const [{ db }] = await sql`SELECT current_database() AS db`
  assert.equal(db, DESIGNATED_DB.name)
  const [{ n: foreignJobs }] = await sql`SELECT COUNT(*)::int AS n FROM controller_jobs WHERE name NOT LIKE 'er0059-%'`
  assert.equal(foreignJobs, 0, 'database holds controller jobs that are not ER-0059 test jobs')
  const [{ n: bindings }] = await sql`SELECT COUNT(*)::int AS n FROM controller_job_action_bindings`
  const [{ n: templates }] = await sql`SELECT COUNT(*)::int AS n FROM action_templates`
  const [{ n: notify }] = await sql`SELECT COUNT(*)::int AS n FROM settings WHERE key IN ${sql(NOTIFICATION_SETTING_KEYS)}`
  assert.deepEqual({ bindings, templates, notify }, { bindings: 0, templates: 0, notify: 0 }, 'database has action or notification configuration')
}

async function newOrg(sql, label) {
  const email = `er0059-${label}-${randomUUID().slice(0, 8)}@example.test`
  const headers = { 'content-type': 'application/json', origin: BASE }
  const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `ER-0059 ${label}`, email, password: `Er0059-${randomUUID()}` }),
  })
  assert.equal(signup.status, 200, await signup.clone().text())
  const cookie = signup.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
  const setup = await fetch(`${BASE}/api/setup/tenant`, {
    method: 'POST',
    headers: { ...headers, cookie },
    body: JSON.stringify({ name: `ER-0059 ${label} ${randomUUID().slice(0, 6)}` }),
  })
  assert.equal(setup.status, 200, await setup.clone().text())
  const { slug } = await setup.json()
  const [tenant] = await sql`SELECT id FROM tenants WHERE slug = ${slug}`
  assert.ok(tenant, 'the app created the org somewhere other than the designated database')
  return { slug, cookie, email, tenantId: tenant.id }
}

async function removeOrg(sql, org) {
  const refs = await sql`
    SELECT cl.relname AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'tenants'::regclass`
  const [user] = await sql`SELECT id FROM "user" WHERE email = ${org.email}`
  for (let pass = 0; pass < 5; pass++) {
    let failed = false
    for (const { tbl, col } of refs) {
      try { await sql`DELETE FROM ${sql(tbl)} WHERE ${sql(col)} = ${org.tenantId}` } catch { failed = true }
    }
    if (user) {
      for (const [tbl, col] of [['session', 'user_id'], ['account', 'user_id']]) {
        try { await sql`DELETE FROM ${sql(tbl)} WHERE ${sql(col)} = ${user.id}` } catch { failed = true }
      }
    }
    try { await sql`DELETE FROM tenants WHERE id = ${org.tenantId}` } catch { failed = true }
    if (user) {
      try { await sql`DELETE FROM "user" WHERE id = ${user.id}` } catch { failed = true }
    }
    if (!failed) return true
  }
  return false
}

async function api(org, query = '') {
  const res = await fetch(`${BASE}/api/${org.slug}/events?${query}`, { headers: { cookie: org.cookie } })
  assert.equal(res.status, 200)
  return res.json()
}

async function tiles(org, query = '') {
  const res = await fetch(`${BASE}/${org.slug}/dashboard${query}`, { headers: { cookie: org.cookie } })
  assert.equal(res.status, 200)
  const html = await res.text()
  const tile = (label) => {
    const match = new RegExp(`<p[^>]*>(\\d+)</p><p[^>]*>${label}</p>`).exec(html)
    assert.ok(match, `tile ${label} not found in dashboard HTML`)
    return Number(match[1])
  }
  return { open: tile('Open Events'), critical: tile('Critical'), activation: html.includes('Create one source') }
}

test('heartbeats are hidden by default, recoverable, and do not change silence or usage', { skip }, async (t) => {
  assertDesignatedTargets()
  const sql = postgres(DB_URL, { max: 2, onnotice: () => {} })
  let org
  t.after(async () => {
    if (org) {
      const removed = await removeOrg(sql, org)
      t.diagnostic(removed ? `teardown removed org ${org.slug}` : `teardown could not fully remove org ${org.slug}; rows remain in relay_fault`)
    }
    await sql.end()
  })
  await assertControllerScope(sql)
  await assertAppUsesDesignatedDatabase()

  org = await newOrg(sql, 'hb')
  await sql`UPDATE tenants SET plan = 'growth' WHERE id = ${org.tenantId}`
  const tenantId = org.tenantId

  const insert = (source, category, severity, hookPrefix, receivedAt = new Date()) => sql`
    INSERT INTO events (tenant_id, hook_id, source, severity, title, category, payload, occurred_at, received_at, status)
    VALUES (${tenantId}, ${`hook_${hookPrefix}_${randomUUID()}`}, ${source}, ${severity}, ${`${source} ${category}`}, ${category},
            '{}'::jsonb, ${receivedAt}, ${receivedAt}, 'open')`
  const heartbeat = (which, receivedAt) => which === 'm1'
    ? insert('pi-watchdog-m1', 'infra.host.heartbeat', 'info', 'hbm1', receivedAt)
    : insert('pi-watchdog-self', 'infra.observer.heartbeat', 'info', 'hbself', receivedAt)
  const sqlUsage = async () => (await sql`
    SELECT COUNT(*)::int AS n FROM events
    WHERE tenant_id = ${tenantId} AND hook_id LIKE 'hook_%' AND source <> 'auth' AND category <> 'test'
      AND COALESCE(tags->>'test', 'false') <> 'true'
      AND received_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`)[0].n

  await t.test('a brand-new empty org shows the activation panel (control)', async () => {
    assert.equal((await tiles(org)).activation, true)
  })

  await t.test('heartbeat-only tenant: list, counts and Open tile exclude heartbeats; Total and activation behavior unchanged', async () => {
    for (let i = 0; i < 6; i++) { await heartbeat('m1'); await heartbeat('self') }

    const body = await api(org, 'limit=50')
    assert.deepEqual({ total: body.totalCount, recent: body.recentCount, rows: body.events.length }, { total: 0, recent: 0, rows: 0 })

    const hidden = await tiles(org)
    assert.deepEqual({ open: hidden.open, critical: hidden.critical }, { open: 0, critical: 0 })
    assert.equal(hidden.activation, false, 'Total must still count heartbeats so the activation panel is not shown')
  })

  await t.test('Source, Category, includeHeartbeats=1 and =true all restore visibility consistently', async () => {
    assert.equal((await api(org, 'source=pi-watchdog')).totalCount, 12)
    assert.equal((await api(org, 'category=heartbeat')).totalCount, 12)
    const one = await api(org, 'includeHeartbeats=1')
    const word = await api(org, 'includeHeartbeats=true')
    assert.equal(one.totalCount, 12)
    assert.equal(word.totalCount, 12)
    assert.equal(one.recentCount, word.recentCount)
    assert.equal((await api(org, 'includeHeartbeats=0')).totalCount, 0)

    const tileOne = await tiles(org, '?includeHeartbeats=1')
    const tileWord = await tiles(org, '?includeHeartbeats=true')
    assert.equal(tileOne.open, 12)
    assert.deepEqual(tileWord, tileOne)
  })

  await t.test('other providers are unaffected and monthly usage is identical across visibility settings', async () => {
    await insert('stripe', 'charge.failed', 'critical', 'stripe')
    await insert('github', 'workflow_run.failed', 'error', 'github')

    const body = await api(org, 'limit=50')
    assert.deepEqual(body.events.map((e) => e.source).sort(), ['github', 'stripe'])
    const shown = await tiles(org)
    assert.deepEqual({ open: shown.open, critical: shown.critical }, { open: 2, critical: 1 })
    const all = await tiles(org, '?includeHeartbeats=1')
    assert.deepEqual({ open: all.open, critical: all.critical }, { open: 14, critical: 1 })

    const usage = await sqlUsage()
    assert.equal(usage, 14)
    assert.equal(body.monthlyExternalEventCount, usage)
    assert.equal((await api(org, 'includeHeartbeats=1')).monthlyExternalEventCount, usage)
    assert.equal((await api(org, 'includeHeartbeats=true')).monthlyExternalEventCount, usage)
    assert.equal((await api(org, 'source=pi-watchdog')).monthlyExternalEventCount, usage)
  })

  await t.test('10-minute dead_letter window: active, then silent, then recovered, with alerts visible on page 1', async () => {
    const [job] = await sql`
      INSERT INTO controller_jobs (tenant_id, name, type, config, cron_expr, next_run_at)
      VALUES (${tenantId}, ${`er0059-silence-${randomUUID().slice(0, 6)}`}, 'dead_letter',
              ${sql.json({ providerId: 'pi-watchdog-m1', maximumSilenceMinutes: 10 })}, '*/5 * * * *', now() - interval '1 minute')
      RETURNING id`
    const run = async () => {
      await sql`UPDATE controller_jobs SET next_run_at = now() - interval '1 minute', lease_expires_at = NULL WHERE id = ${job.id}`
      const res = await fetch(`${BASE}/api/internal/controller`, { method: 'POST', headers: { 'x-controller-secret': SECRET } })
      assert.equal(res.status, 200)
      const { counts } = await res.json()
      assert.equal(counts.claimed, 1, 'the scheduler must claim exactly the one paid-plan test job')
      assert.equal(counts.evaluated, 1)
      const [row] = await sql`SELECT last_status, last_run_at, last_result FROM controller_jobs WHERE id = ${job.id}`
      assert.ok(row.last_run_at, 'the job did not execute')
      return row
    }
    const controllerEvents = () => sql`
      SELECT title, status, severity FROM events
      WHERE tenant_id = ${tenantId} AND source = 'controller' AND category = 'controller.dead_letter' ORDER BY received_at`

    const active = await run()
    assert.equal(active.last_status, 'ok')
    assert.equal(active.last_result.outcome, 'provider_active')
    assert.equal(active.last_result.details.eventCount, 6)
    assert.equal((await controllerEvents()).length, 0)

    await sql`UPDATE events SET received_at = now() - interval '15 minutes', occurred_at = now() - interval '15 minutes'
              WHERE tenant_id = ${tenantId} AND source = 'pi-watchdog-m1'`
    const silent = await run()
    assert.equal(silent.last_status, 'alert')
    assert.equal(silent.last_result.outcome, 'provider_silent')
    assert.equal(silent.last_result.details.eventCount, 0)
    const afterAlert = await controllerEvents()
    assert.equal(afterAlert.length, 1)
    assert.match(afterAlert[0].title, /needs attention$/)
    assert.equal(afterAlert[0].status, 'open')

    for (let i = 0; i < 30; i++) await heartbeat('self')

    const buriedView = await api(org, 'includeHeartbeats=1&limit=10')
    assert.ok(!buriedView.events.some((e) => e.source === 'controller'), 'control: with heartbeats shown the alert is buried off page 1')
    const defaultView = await api(org, 'limit=10')
    assert.ok(defaultView.events.some((e) => e.source === 'controller' && /needs attention$/.test(e.title)), 'alert must be on page 1 by default')

    await heartbeat('m1')
    const recovered = await run()
    assert.equal(recovered.last_status, 'ok')
    assert.equal(recovered.last_result.outcome, 'provider_active')
    assert.equal(recovered.last_result.details.eventCount, 1)
    const afterRecovery = await controllerEvents()
    assert.equal(afterRecovery.length, 2)
    assert.match(afterRecovery[1].title, /recovered$/)
    assert.equal(afterRecovery[1].status, 'open')

    const page1 = await api(org, 'limit=10')
    const titles = page1.events.filter((e) => e.source === 'controller').map((e) => e.title)
    assert.equal(titles.length, 2, 'alert and recovery must both be on page 1')
    assert.ok(titles.some((x) => /needs attention$/.test(x)) && titles.some((x) => /recovered$/.test(x)))
    assert.ok(page1.events.every((e) => !e.source.startsWith('pi-watchdog')))
  })

  await t.test('usage is still identical across visibility settings after the silence cycle, and no notifications were configured', async () => {
    const usage = await sqlUsage()
    assert.equal((await api(org)).monthlyExternalEventCount, usage)
    assert.equal((await api(org, 'includeHeartbeats=1')).monthlyExternalEventCount, usage)
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM settings WHERE key IN ${sql(NOTIFICATION_SETTING_KEYS)}`
    assert.equal(n, 0)
  })
})
