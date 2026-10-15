#!/usr/bin/env node
// ER-0060 clean-room validation of the Relay-first bootstrap on a disposable local database.
//
//   node scripts/bootstrap-cleanroom.mjs --relay-repo ../relay --evidence evidence.json
//
// Creates only the Compose project `er0060-bootstrap` (Postgres on 127.0.0.1:15433, an internal-only Relay
// container, extra databases inside that Postgres) and one app process on port 3101. Tears down only those.
// Exits non-zero on the first failed check after attempting scoped teardown.

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import postgres from 'postgres'
import { RELAY_LEDGER } from './bootstrap-fresh-database.mjs'

const PROJECT = 'er0060-bootstrap'
const PG_PORT = 15433
const APP_PORT = 3101
const MAIN_DB = 'er0060_bootstrap'
const PIN_PREFIX = '97bc4ce'
const CANONICAL_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const REFUSAL_DBS = ['er0060_refuse_stray', 'er0060_refuse_extra_tenant', 'er0060_refuse_partial_ledger',
  'er0060_refuse_events_row', 'er0060_refuse_ea_table', 'er0060_refuse_checksum', 'er0060_refuse_unmigrated', 'er0060_baseline_old_sql']

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..')
const composeFile = path.join(appRoot, 'docker-compose.bootstrap-test.yml')
const bootstrapScript = path.join(here, 'bootstrap-fresh-database.mjs')

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []))
const relayRepo = path.resolve(appRoot, args['relay-repo'] ?? '../relay')
const evidencePath = args.evidence ? path.resolve(args.evidence) : null

const results = []
const lines = []
let appProc = null
let tmpCheckout = null
const facts = {}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  lines.push(line)
  console.log(line)
}

function step(name, detail = '') {
  results.push({ step: name, ok: true, detail })
  log(`PASS ${name}${detail ? ` - ${detail}` : ''}`)
}

function sh(command, argv, options = {}) {
  return execFileSync(command, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...options }).trim()
}

function compose(...argv) {
  return sh('docker', ['compose', '-p', PROJECT, '-f', composeFile, ...argv], { env: { ...process.env, RELAY_IMAGE: facts.relayTag ?? 'unset' } })
}

function dbUrl(db, port = PG_PORT) {
  return `postgres://relay:relay@127.0.0.1:${port}/${db}`
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

async function waitFor(label, fn, timeoutMs = 120000, intervalMs = 1500) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn()
      if (value) return value
    } catch (error) {
      last = error
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`timed out waiting for ${label}${last ? `: ${last.message}` : ''}`)
}

function dockerInventory() {
  const containers = sh('docker', ['ps', '-a', '--format', '{{.ID}}|{{.Names}}|{{.State}}|{{.Image}}']).split('\n').filter(Boolean).sort()
  const volumes = sh('docker', ['volume', 'ls', '-q']).split('\n').filter(Boolean).sort()
  return { containers, volumes }
}

function labelled() {
  const filter = `label=com.docker.compose.project=${PROJECT}`
  return {
    containers: sh('docker', ['ps', '-a', '--filter', filter, '--format', '{{.ID}}|{{.Names}}']).split('\n').filter(Boolean),
    volumes: sh('docker', ['volume', 'ls', '--filter', filter, '-q']).split('\n').filter(Boolean),
    networks: sh('docker', ['network', 'ls', '--filter', filter, '--format', '{{.Name}}']).split('\n').filter(Boolean),
  }
}

async function snapshot(url) {
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    const tables = (await sql`
      SELECT table_schema || '.' || table_name AS name FROM information_schema.tables
      WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1`).map((r) => r.name)
    const out = { tables: {}, extensions: (await sql`SELECT extname FROM pg_extension ORDER BY 1`).map((r) => r.extname) }
    for (const full of tables) {
      const [schema, table] = full.split('.')
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${table} ORDER BY ordinal_position`
      const constraints = await sql`
        SELECT conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
        WHERE n.nspname = ${schema} AND cl.relname = ${table} ORDER BY conname`
      const indexes = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = ${schema} AND tablename = ${table} ORDER BY indexname`
      const [data] = await sql.unsafe(
        `SELECT COUNT(*)::int AS n, md5(COALESCE(string_agg(t::text, E'\\n' ORDER BY t::text), '')) AS h FROM "${schema}"."${table}" t`
      )
      out.tables[full] = { columns, constraints, indexes, rows: data.n, hash: data.h }
    }
    return out
  } finally {
    await sql.end()
  }
}

function runBootstrap(databaseUrl, expectDatabase, extra = []) {
  const result = spawnSync(process.execPath, [bootstrapScript, '--database-url', databaseUrl, '--expect-database', expectDatabase, ...extra], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    cwd: os.tmpdir(),
  })
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}

async function admin(fn) {
  const sql = postgres(dbUrl('postgres'), { max: 1, onnotice: () => {} })
  try { return await fn(sql) } finally { await sql.end() }
}

async function withDb(db, fn) {
  const sql = postgres(dbUrl(db), { max: 1, onnotice: () => {} })
  try { return await fn(sql) } finally { await sql.end() }
}

async function refusalCase(name, db, expectCode, mutate, { url = dbUrl(db), expectDb = db, expectText = /Refused/ } = {}) {
  if (mutate) await withDb(db, mutate)
  const before = await snapshot(dbUrl(db))
  const run = runBootstrap(url, expectDb)
  const after = await snapshot(dbUrl(db))
  assert.equal(run.code, expectCode, `${name}: expected exit ${expectCode}, got ${run.code}\n${run.out}`)
  assert.match(run.out, expectText, `${name}: expected a refusal message matching ${expectText}\n${run.out}`)
  assert.deepEqual(after, before, `${name}: schema or data changed`)
  const tableCount = Object.keys(before.tables).length
  step(`refusal: ${name}`, `exit ${run.code}, snapshot identical (${tableCount} tables, ${Object.values(before.tables).reduce((n, t) => n + t.rows, 0)} rows)`)
}

async function startApp(logFile) {
  const secret = crypto.randomBytes(24).toString('hex')
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR ?? '/tmp', NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL: dbUrl(MAIN_DB, PG_PORT).replace('127.0.0.1', 'localhost'),
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: `http://localhost:${APP_PORT}`,
    EXCEPTALERT_APP_URL: `http://localhost:${APP_PORT}`,
    EXCEPTALERT_ADMIN_EMAILS: '',
    EXCEPTALERT_PASSWORD_RESET_EVENT_TENANT_ID: '',
    EXCEPTALERT_PASSWORD_RESET_EVENT_TENANT_SLUG: '',
    RELAY_URL: 'http://127.0.0.1:1',
  }
  const out = fs.openSync(logFile, 'a')
  appProc = spawn(path.join(appRoot, 'node_modules', '.bin', 'next'), ['dev', '-p', String(APP_PORT)], {
    cwd: appRoot, env, stdio: ['ignore', out, out], detached: true,
  })
  const base = `http://localhost:${APP_PORT}`
  await waitFor('app to answer', async () => (await fetch(`${base}/api/auth/ok`).catch(() => null))?.status >= 200, 180000, 2000)
  return base
}

// Next dev talks to its own worker over loopback ephemeral ports, so the guard is: every connection stays on loopback,
// none targets a registered (<49152) port other than the disposable database port, and the database port is used.
function appConnections() {
  const pids = sh('lsof', ['-nP', `-iTCP:${APP_PORT}`, '-sTCP:LISTEN', '-t']).split('\n').filter(Boolean)
  assert.ok(pids.length > 0, 'no listener on the app port')
  const found = []
  for (const pid of pids) {
    let out = ''
    try { out = sh('lsof', ['-nP', '-a', '-p', pid, '-iTCP', '-Fn']) } catch { out = '' }
    for (const line of out.split('\n')) {
      const match = line.match(/^n(.*):(\d+)->(.*):(\d+)$/)
      if (match && match[2] !== String(APP_PORT)) found.push({ host: match[3].replace(/[\[\]]/g, ''), port: Number(match[4]) })
    }
  }
  return found
}

function assertAppConfinedToDisposableDatabase(connections) {
  const loopback = new Set(['127.0.0.1', '::1', 'localhost'])
  const offHost = connections.filter((c) => !loopback.has(c.host))
  const wrongPort = connections.filter((c) => c.port < 49152 && c.port !== PG_PORT)
  assert.deepEqual(offHost, [], `app has non-loopback connections: ${JSON.stringify(offHost)}`)
  assert.deepEqual(wrongPort, [], `app has connections to other service ports: ${JSON.stringify(wrongPort)}`)
  assert.ok(connections.some((c) => c.port === PG_PORT), 'app has no observed connection to the disposable database')
}

async function newOrg(base, sql, label) {
  const email = `er0060-${label}-${crypto.randomUUID().slice(0, 8)}@example.test`
  const headers = { 'content-type': 'application/json', origin: base }
  const signup = await fetch(`${base}/api/auth/sign-up/email`, {
    method: 'POST', headers, body: JSON.stringify({ name: `ER-0060 ${label}`, email, password: `Er0060-${crypto.randomUUID()}` }),
  })
  assert.equal(signup.status, 200, await signup.clone().text())
  const cookie = signup.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
  const setup = await fetch(`${base}/api/setup/tenant`, {
    method: 'POST', headers: { ...headers, cookie }, body: JSON.stringify({ name: `ER-0060 ${label} ${crypto.randomUUID().slice(0, 6)}` }),
  })
  assert.equal(setup.status, 200, await setup.clone().text())
  const { slug } = await setup.json()
  const [tenant] = await sql`SELECT id::text AS id, config, ingress_key, plan FROM tenants WHERE slug = ${slug}`
  assert.ok(tenant, 'organization row not found in the disposable database')
  return { slug, ...tenant }
}

async function main() {
  const evidenceDir = evidencePath ? path.dirname(evidencePath) : os.tmpdir()
  const appLog = path.join(evidenceDir, 'er0060-app.log')

  // ---- guards before any write
  assert.equal(PROJECT, 'er0060-bootstrap')
  for (const port of [PG_PORT, APP_PORT]) assert.equal(await portInUse(port), false, `port ${port} is already in use; refusing`)
  facts.baseline = dockerInventory()
  step('guard: ports free and project name fixed', `ports ${PG_PORT}, ${APP_PORT}; project ${PROJECT}; ${facts.baseline.containers.length} existing containers and ${facts.baseline.volumes.length} volumes recorded`)
  assert.equal(labelled().containers.length + labelled().volumes.length + labelled().networks.length, 0, 'a project with this name already exists; refusing')

  // ---- pinned, clean Relay checkout and build
  const hash = sh('git', ['-C', relayRepo, 'rev-parse', 'HEAD'])
  assert.ok(hash.startsWith(PIN_PREFIX), `Relay HEAD ${hash} is not the pinned commit ${PIN_PREFIX}`)
  const porcelain = sh('git', ['-C', relayRepo, 'status', '--porcelain'])
  assert.equal(porcelain, '', `Relay checkout is not clean:\n${porcelain}`)
  facts.relayCommit = hash
  facts.relayTag = `er0060-bootstrap-relay:${hash.slice(0, 7)}`
  step('Relay checkout verified', `${hash}, working tree clean`)
  facts.tagPreExisted = spawnSync('docker', ['image', 'inspect', facts.relayTag]).status === 0
  tmpCheckout = fs.mkdtempSync(path.join(os.tmpdir(), 'er0060-relay-'))
  execFileSync('sh', ['-c', `git -C "${relayRepo}" archive ${hash} | tar -x -C "${tmpCheckout}"`])
  const migrationFiles = fs.readdirSync(path.join(tmpCheckout, 'migrations')).filter((f) => f.endsWith('.sql')).sort()
  const exportSums = migrationFiles.map((f) => {
    const m = f.match(/^0*(\d+)_(.*)\.sql$/)
    return [Number(m[1]), m[2].replace(/_/g, ' '), crypto.createHash('sha384').update(fs.readFileSync(path.join(tmpCheckout, 'migrations', f))).digest('hex')]
  }).sort((a, b) => a[0] - b[0])
  assert.deepEqual(exportSums, RELAY_LEDGER.map((r) => [...r]), 'bootstrap manifest does not match the pinned commit export (versions, descriptions, SHA-384)')
  step('bootstrap Relay manifest equals the pinned commit export', `${exportSums.length} migrations; versions, descriptions and SHA-384 checksums identical`)
  log(`building ${facts.relayTag} from clean export of ${hash} (tag pre-existed: ${facts.tagPreExisted})`)
  sh('docker', ['build', '-t', facts.relayTag, tmpCheckout], { timeout: 1800000 })
  facts.relayImageId = sh('docker', ['image', 'inspect', '--format', '{{.Id}}', facts.relayTag])
  step('Relay image built', `${facts.relayTag} id ${facts.relayImageId}`)

  // ---- disposable Postgres, empty before Relay
  compose('up', '-d', '--wait', 'postgres')
  const initial = await withDb(MAIN_DB, async (sql) => ({
    tables: (await sql`SELECT table_schema || '.' || table_name AS n FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`).map((r) => r.n),
    db: (await sql`SELECT current_database() AS d`)[0].d,
  }))
  assert.equal(initial.db, MAIN_DB)
  assert.deepEqual(initial.tables, [], 'database is not empty before Relay starts')
  step('guard D1: database empty before Relay creates any table', `${MAIN_DB} on port ${PG_PORT}`)

  // ---- Relay starts normally
  compose('up', '-d', 'relay')
  try {
    await waitFor('Relay to apply its migrations and listen', async () => {
      const n = await withDb(MAIN_DB, async (sql) => (await sql`SELECT COUNT(*)::int AS n FROM _sqlx_migrations WHERE success`)[0].n).catch(() => 0)
      return n === RELAY_LEDGER.length && /Listening on/.test(compose('logs', 'relay'))
    })
  } catch (error) {
    const n = await withDb(MAIN_DB, async (sql) => (await sql`SELECT COUNT(*)::int AS n FROM _sqlx_migrations`)[0].n).catch((e) => `unreadable: ${e.message}`)
    let state = ''
    try { state = compose('ps', '-a', '--format', '{{.Name}} {{.State}} {{.ExitCode}}') } catch (e) { state = String(e.message) }
    throw new Error(`${error.message}\nledger rows: ${n}\ncontainers: ${state}\nrelay logs:\n${compose('logs', 'relay').slice(-3000)}`)
  }
  let health = 'not attempted'
  try { health = compose('exec', '-T', 'relay', 'wget', '-qO-', 'http://127.0.0.1:3800/health') } catch (e) { health = `wget unavailable or failed: ${String(e.stderr ?? e.message).slice(0, 120)}` }
  facts.relayHealthFirstStart = health
  const ledger1 = await withDb(MAIN_DB, (sql) => sql`SELECT version::int AS version, description, success, encode(checksum, 'hex') AS checksum FROM _sqlx_migrations ORDER BY version`)
  assert.deepEqual(ledger1.map((r) => [r.version, r.description, r.checksum]), RELAY_LEDGER.map((r) => [...r]), "the checksums sqlx recorded for the real Relay differ from the manifest")
  const key0 = await withDb(MAIN_DB, async (sql) => (await sql`SELECT ingress_key FROM tenants WHERE id = ${CANONICAL_TENANT_ID}`)[0]?.ingress_key)
  assert.ok(key0, 'Relay did not seed the canonical default tenant with an ingress_key')
  facts.ledger = ledger1.map((r) => `${r.version}:${r.description}`)
  facts.defaultKeyAfterRelay = key0
  step('Relay started normally and migrated itself', `ledger ${RELAY_LEDGER.length} migrations all success with checksums equal to the pinned files; /health: ${health}; default tenant key ${key0}`)
  compose('stop', 'relay')

  // ---- refusal cases on copies of the Relay-migrated database (and the unmigrated case)
  await admin(async (sql) => {
    for (const db of REFUSAL_DBS.filter((d) => d !== 'er0060_refuse_unmigrated')) {
      await waitFor(`template ${MAIN_DB} to be idle`, async () => {
        try { await sql.unsafe(`CREATE DATABASE ${db} TEMPLATE ${MAIN_DB}`); return true } catch (e) { if (/being accessed/.test(e.message)) return false; throw e }
      }, 30000, 1000)
    }
    await sql.unsafe('CREATE DATABASE er0060_refuse_unmigrated')
  })
  await refusalCase('stray table', 'er0060_refuse_stray', 2, (sql) => sql`CREATE TABLE stray (id int)`)
  await refusalCase('extra tenant row', 'er0060_refuse_extra_tenant', 2,
    (sql) => sql`INSERT INTO tenants (id, slug, name, ingress_key) VALUES (gen_random_uuid(), 'extra', 'Extra', 'org_extra')`)
  await refusalCase('partial Relay ledger (last migration removed)', 'er0060_refuse_partial_ledger', 2, (sql) => sql`DELETE FROM _sqlx_migrations WHERE version = 11`)
  await refusalCase('events already contain a row', 'er0060_refuse_events_row', 2, (sql) => sql`
    INSERT INTO events (hook_id, source, severity, title, category, payload, occurred_at, tenant_id)
    VALUES ('h', 's', 'info', 't', 'c', '{}', now(), ${CANONICAL_TENANT_ID})`)
  await refusalCase('ExceptAlert table already present', 'er0060_refuse_ea_table', 2, (sql) => sql`CREATE TABLE actions (id int)`)
  await refusalCase('altered Relay ledger checksum', 'er0060_refuse_checksum', 2,
    (sql) => sql`UPDATE _sqlx_migrations SET checksum = decode(repeat('ab', 48), 'hex') WHERE version = 4`,
    { expectText: /Refused[\s\S]*checksum differs[\s\S]*version\(s\) 4/ })
  await refusalCase('unmigrated empty database (Relay never ran)', 'er0060_refuse_unmigrated', 2, null)
  await refusalCase('wrong --expect-database', MAIN_DB, 2, null, { expectDb: 'not_this_db' })
  await refusalCase('remote host', MAIN_DB, 2, null, { url: `postgres://relay:relay@192.0.2.1:${PG_PORT}/${MAIN_DB}` })

  // ---- negative control: the unedited 0004/0005 (from git HEAD) on the same Relay-migrated state
  const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'er0060-oldsql-'))
  try {
    for (const f of fs.readdirSync(path.join(appRoot, 'drizzle', 'migrations'))) fs.copyFileSync(path.join(appRoot, 'drizzle', 'migrations', f), path.join(oldDir, f))
    for (const f of ['0004_auth.sql', '0005_add_tenant_id.sql']) {
      fs.writeFileSync(path.join(oldDir, f), sh('git', ['-C', appRoot, 'show', `HEAD:drizzle/migrations/${f}`]))
    }
    const oldRun = runBootstrap(dbUrl('er0060_baseline_old_sql'), 'er0060_baseline_old_sql', ['--migrations-dir', oldDir])
    facts.unedited0005 = oldRun.out
    assert.equal(oldRun.code, 1, `expected the unedited migrations to fail, got exit ${oldRun.code}\n${oldRun.out}`)
    assert.match(oldRun.out, /0005_add_tenant_id\.sql failed: .*ingress_key/s)
    let insertError = ''
    await withDb('er0060_baseline_old_sql', async (sql) => {
      try { await sql`INSERT INTO tenants (name, slug, ingress_key) VALUES ('x', 'x', 'org_x')` } catch (e) { insertError = e.message }
    })
    facts.unedited0004TenantInsert = insertError
    assert.match(insertError, /null value in column "id"/)
    step('negative control: unedited 0004/0005 reproduce both defects on a Relay-first database', `0005 fails (${oldRun.out.split('\n').find((l) => /failed/.test(l))?.slice(0, 160)}); insert without id fails (${insertError})`)
  } finally {
    fs.rmSync(oldDir, { recursive: true, force: true })
  }

  // ---- the bootstrap itself
  const mainBefore = await snapshot(dbUrl(MAIN_DB))
  const first = runBootstrap(dbUrl(MAIN_DB), MAIN_DB)
  log(`bootstrap output:\n${first.out}`)
  facts.bootstrapOutput = first.out
  assert.equal(first.code, 0, `bootstrap failed (exit ${first.code})`)
  step('db:bootstrap applied all ExceptAlert migrations with no manual SQL', `exit 0; ${15} files`)

  await withDb(MAIN_DB, async (sql) => {
    const col = async (t, c) => (await sql`SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${t} AND column_name = ${c}`)[0]
    const id = await col('tenants', 'id'); assert.match(id.column_default, /gen_random_uuid\(\)/)
    const config = await col('tenants', 'config'); assert.equal(config.data_type, 'jsonb'); assert.match(config.column_default, /'\{\}'::jsonb/)
    const ingress = await col('tenants', 'ingress_key'); assert.equal(ingress.is_nullable, 'NO')
    const name = await col('tenants', 'name'); assert.equal(name.is_nullable, 'YES')
    const idx = await sql`SELECT indexdef FROM pg_indexes WHERE tablename = 'tenants' AND indexname = 'tenants_ingress_key_unique'`
    assert.match(idx[0]?.indexdef ?? '', /UNIQUE.*ingress_key/)
    const chk = await sql`SELECT 1 FROM pg_constraint WHERE conname = 'tenants_plan_check'`; assert.equal(chk.length, 1)
    const tenantCol = await col('events', 'tenant_id'); assert.equal(tenantCol.is_nullable, 'NO')
    const fks = await sql`
      SELECT conname FROM pg_constraint c WHERE c.contype = 'f' AND c.conrelid = 'events'::regclass AND c.confrelid = 'tenants'::regclass`
    assert.equal(fks.length, 1, `events->tenants foreign keys: ${fks.map((f) => f.conname).join(',')}`)
    const status = await col('events', 'status'); assert.match(status.column_default, /'open'/)
    const tenants = await sql`SELECT id::text AS id, ingress_key FROM tenants`
    assert.equal(tenants.length, 1); assert.equal(tenants[0].id, CANONICAL_TENANT_ID)
    assert.equal(tenants[0].ingress_key, key0, 'default tenant ingress_key changed')
    const ledger2 = await sql`SELECT version::int AS version, description, success FROM _sqlx_migrations ORDER BY version`
    assert.deepEqual(ledger2.map((r) => `${r.version}:${r.description}`), facts.ledger, 'Relay ledger changed')
    const ea = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user', 'tenant_memberships', 'controller_jobs', 'upgrade_requests', 'abuse_rate_limits', 'tenant_plan_changes')`
    assert.equal(ea.length, 6)
  })
  step('shared schema, defaults, constraints and unique ingress_key present; tenants.name stays nullable (documented difference)')
  step('canonical default tenant preserved without key churn', `one row ${CANONICAL_TENANT_ID}, key ${key0}`)

  // ---- Relay starts normally against the bootstrapped database
  compose('up', '-d', 'relay')
  await waitFor('Relay to restart', async () => (compose('logs', 'relay').match(/Listening on/g) ?? []).length >= 2)
  let health2 = 'not attempted'
  try { health2 = compose('exec', '-T', 'relay', 'wget', '-qO-', 'http://127.0.0.1:3800/health') } catch (e) { health2 = `wget unavailable or failed: ${String(e.stderr ?? e.message).slice(0, 120)}` }
  const ledger3 = await withDb(MAIN_DB, (sql) => sql`SELECT COUNT(*)::int AS n FROM _sqlx_migrations`)
  assert.equal(ledger3[0].n, RELAY_LEDGER.length)
  const relayLogs = compose('logs', 'relay')
  assert.ok(!/ERROR|panicked/i.test(relayLogs), `Relay logged errors after bootstrap:\n${relayLogs.slice(-1500)}`)
  facts.relayHealthAfterBootstrap = health2
  step('Relay starts normally against the bootstrapped database', `ledger still ${RELAY_LEDGER.length}, no ERROR/panic in logs, /health: ${health2}`)
  compose('stop', 'relay')

  // ---- second bootstrap refuses without changes
  const mid = await snapshot(dbUrl(MAIN_DB))
  const second = runBootstrap(dbUrl(MAIN_DB), MAIN_DB)
  const midAfter = await snapshot(dbUrl(MAIN_DB))
  assert.notEqual(second.code, 0, 'second bootstrap unexpectedly succeeded')
  assert.match(second.out, /Refused/)
  assert.deepEqual(midAfter, mid, 'second bootstrap changed the database')
  facts.secondBootstrapOutput = second.out
  step('second bootstrap refuses without changes', `exit ${second.code}; snapshot identical`)
  void mainBefore

  // ---- organization creation through the app
  const base = await startApp(appLog)
  const probe = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ email: 'nobody@example.test', password: 'wrong-password-123' }),
  })
  assert.ok([400, 401].includes(probe.status), `unexpected probe status ${probe.status}`)
  const connections = appConnections()
  assertAppConfinedToDisposableDatabase(connections)
  facts.appConnections = connections
  step('guard: app confined to the disposable database', `${connections.length} loopback connections observed; database port ${PG_PORT} in use; others are ephemeral-port local IPC: ${JSON.stringify(connections.filter((c) => c.port !== PG_PORT).map((c) => c.port))}`)
  const { org1, org2 } = await withDb(MAIN_DB, async (sql) => ({
    org1: await newOrg(base, sql, 'one'),
    org2: await newOrg(base, sql, 'two'),
  }))
  for (const org of [org1, org2]) {
    assert.match(org.id, /^[0-9a-f-]{36}$/); assert.deepEqual(org.config, {}); assert.match(org.ingress_key, /^org_/); assert.equal(org.plan, 'free')
  }
  assert.notEqual(org1.ingress_key, org2.ingress_key); assert.notEqual(org1.ingress_key, key0)
  facts.orgs = [org1.slug, org2.slug]
  step('organization creation succeeds through the app path', `${org1.slug} and ${org2.slug}: generated ids, config {}, distinct ingress keys`)

  // ---- T6: rerun edited 0004/0005 through db:apply on the finished disposable database
  const beforeRerun = await snapshot(dbUrl(MAIN_DB))
  const rerun = spawnSync('npm', ['run', 'db:apply', '--', 'drizzle/migrations/0004_auth.sql', 'drizzle/migrations/0005_add_tenant_id.sql'], {
    cwd: appRoot, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: dbUrl(MAIN_DB) },
  })
  facts.rerunOutput = `${rerun.stdout}${rerun.stderr}`
  const afterRerun = await snapshot(dbUrl(MAIN_DB))
  facts.rerunExit = rerun.status
  const diffTables = Object.keys(beforeRerun.tables).filter((t) => JSON.stringify(beforeRerun.tables[t]) !== JSON.stringify(afterRerun.tables[t]))
  facts.rerunChangedTables = diffTables
  const tenantsSame = JSON.stringify(beforeRerun.tables['public.tenants']) === JSON.stringify(afterRerun.tables['public.tenants'])
  results.push({ step: 'T6 db:apply rerun of edited 0004/0005', ok: rerun.status === 0 && tenantsSame, detail: `exit ${rerun.status}; tenants unchanged: ${tenantsSame}; tables changed: ${diffTables.join(', ') || 'none'}` })
  log(`${rerun.status === 0 && tenantsSame ? 'PASS' : 'FAIL'} T6 db:apply rerun of edited 0004/0005 - exit ${rerun.status}; tenants unchanged: ${tenantsSame}; tables changed: ${diffTables.join(', ') || 'none'}`)
  log(`db:apply output:\n${facts.rerunOutput}`)
}

async function teardown() {
  const outcome = { ok: true, notes: [] }
  try {
    if (appProc?.pid) {
      try { process.kill(-appProc.pid, 'SIGTERM') } catch { /* already gone */ }
      await new Promise((r) => setTimeout(r, 1500))
      try { process.kill(-appProc.pid, 'SIGKILL') } catch { /* already gone */ }
      outcome.notes.push(`stopped app process group ${appProc.pid}`)
    }
    const before = labelled()
    log(`teardown: project resources to remove: containers ${JSON.stringify(before.containers)}, volumes ${JSON.stringify(before.volumes)}, networks ${JSON.stringify(before.networks)}`)
    if (before.containers.length || before.volumes.length || before.networks.length) {
      compose('down', '-v', '--remove-orphans')
    }
    const left = labelled()
    outcome.remaining = left
    if (left.containers.length || left.volumes.length || left.networks.length) { outcome.ok = false; outcome.notes.push(`resources remain: ${JSON.stringify(left)}`) }
    if (facts.relayTag && facts.tagPreExisted === false && spawnSync('docker', ['image', 'inspect', facts.relayTag]).status !== 0) {
      outcome.notes.push(`image tag ${facts.relayTag} was never built; nothing to remove`)
    } else if (facts.relayTag && facts.tagPreExisted === false) {
      try { sh('docker', ['image', 'rm', facts.relayTag]); outcome.notes.push(`removed image tag ${facts.relayTag} (it did not exist before the run)`) } catch (e) { outcome.notes.push(`could not remove image tag: ${String(e.stderr ?? e.message).slice(0, 120)}`); outcome.ok = false }
    } else if (facts.relayTag) {
      outcome.notes.push(`left image tag ${facts.relayTag} in place (it pre-existed)`)
    }
    if (tmpCheckout) { fs.rmSync(tmpCheckout, { recursive: true, force: true }); outcome.notes.push('removed temporary Relay export') }
    if (facts.baseline) {
      const now = dockerInventory()
      const lostContainers = facts.baseline.containers.filter((c) => !now.containers.includes(c))
      const lostVolumes = facts.baseline.volumes.filter((v) => !now.volumes.includes(v))
      const newContainers = now.containers.filter((c) => !facts.baseline.containers.includes(c))
      const newVolumes = now.volumes.filter((v) => !facts.baseline.volumes.includes(v))
      outcome.baselineDiff = { lostContainers, lostVolumes, newContainers, newVolumes }
      if (lostContainers.length || lostVolumes.length || newContainers.length || newVolumes.length) outcome.ok = false
      outcome.notes.push(`pre-existing containers/volumes ${outcome.ok ? 'unchanged' : 'DIFFER'} (${JSON.stringify(outcome.baselineDiff)})`)
    }
  } catch (error) {
    outcome.ok = false
    outcome.notes.push(`teardown error: ${error.message}`)
  }
  log(`teardown ${outcome.ok ? 'PASS' : 'FAIL'}: ${outcome.notes.join('; ')}`)
  return outcome
}

let failure = null
try {
  await main()
} catch (error) {
  failure = error
  results.push({ step: 'FAILURE', ok: false, detail: error.message })
  log(`FAIL ${error.stack ?? error.message}`)
}
const down = await teardown()
const failed = results.filter((r) => !r.ok)
const summary = { project: PROJECT, finishedAt: new Date().toISOString(), passed: !failure && !failed.length && down.ok, facts, results, teardown: down }
if (evidencePath) {
  fs.writeFileSync(evidencePath, JSON.stringify(summary, null, 2))
  fs.writeFileSync(evidencePath.replace(/\.json$/, '.log'), lines.join('\n') + '\n')
}
log(summary.passed ? 'ALL CHECKS PASSED' : `FAILED: ${failure ? failure.message : failed.map((f) => f.step).join('; ') || 'teardown'}`)
process.exit(summary.passed ? 0 : 1)
