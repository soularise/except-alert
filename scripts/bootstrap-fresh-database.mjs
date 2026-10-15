#!/usr/bin/env node
// Fresh-database bootstrap for the Relay-first install path (ER-0060).
//
// Starting state: an empty database on which Relay has started normally and applied its own migrations.
// This script verifies that state read-only, then applies ExceptAlert's migrations in a fixed order.
// It refuses anything else before changing anything. It is not an upgrade tool and never touches `db:apply`.
//
//   npm run db:bootstrap -- --database-url postgres://user:pw@localhost:15433/name --expect-database name
//
// It does not read .env files or DATABASE_URL.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

export const CANONICAL_TENANT_ID = '00000000-0000-0000-0000-000000000001'
export const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export const EXCEPTALERT_FILES = [
  '0001_extend_events.sql',
  '0002_exceptalert_tables.sql',
  '0003_baselines_settings.sql',
  '0004_auth.sql',
  '0005_add_tenant_id.sql',
  '0006_normalize_provider_signature_algorithms.sql',
  '0007_organizations_and_plans.sql',
  '0008_user_preferences.sql',
  '0009_controller_jobs.sql',
  '0010_controller_event_idempotency.sql',
  '0011_abuse_rate_limits.sql',
  '0012_controller_action_bindings.sql',
  '0012_tenant_plan_changes.sql',
  '0013_agent_run_deadline_controller.sql',
  '0013_upgrade_requests.sql',
]

// The ledger of the pinned Relay build, 97bc4ce (97bc4ce4ac31a086ca66f2af46912db70db50e29), built from a clean checkout.
// sqlx records the file name after the version prefix, underscores as spaces, and the SHA-384 of the file contents as
// checksum. Each checksum below is the SHA-384 of that migration file as stored in the pinned commit. 007_event_v1_pilot.sql is gitignored in the Relay repo, so it is not in that
// commit and not in this ledger; a Relay built from a working tree that has the file is refused.
export const RELAY_LEDGER = [
  [1, 'initial', '9bd80ae327b4698c106020f776d757308dc11ea528a0ea83063f2e8131f97a7689d45f2b5251a6b3c619ed5efee8a079'],
  [2, 'auth failed status', 'caa4e720e34b19d064b37004dd7061cbdd34c1fa759e267a4929dcb2cc125044165eda400e613103f889a0a3633a5630'],
  [3, 'tenant aware ingestion', 'c7406fd3b0f14359fb345db7502ee4b86adfdff0d222a6b853adf048e2e3bf86b0fbc0db22759a75675e205151e82e34'],
  [4, 'organization ingress keys', 'bb7afc666366b4516ac5ec9c8d473638502d4f30384e3e10084870da374483b8b27c2c71ca90db9b0433b18a51cd5507'],
  [5, 'quota exceeded status', '9f29ccbdb2dbe30e286f2fe46258802b18fcc0f635bacdf11716cd3da4e50a85c0c04549e711cd0aba365b56c81e05ef'],
  [6, 'audit template metadata', 'a4aad21899399363768cd3f6552acb8dc0cac01b991caabed131fe10de5960dc92aa9da490c1c96178bd9a8846ecb75f'],
  [8, 'agent observation idempotency', 'b9da625d0a52190acebb964748d1c4dc3defc3e1d5cadf02e46ef7125e9af4d3c817655fcf93e4aa80ed16bc4ef751aa'],
  [9, 'fix agent observation conflict target', '6960eca38c5c3a671ed1b56f8541265a17fc50877bc7677b8bd77db06b75472d29a5f64578af8484408ea6126cf6d5a3'],
  [10, 'samsara event idempotency', '069a6e7c79d4d82098e0ff91899f0d0819542b368bce7cc2686b7b9a24c49051e22d5c932336abfe2f089f115ad47ba8'],
  [11, 'sensos alert id idempotency', '9349dff4c2572dc2bbf5d815bba04652b1723d9a9d6817a1ff282098e000c687efb510d3303c2c8b9ba00f02486cfbc0'],
]

export const RELAY_TABLES = [
  '_sqlx_migrations',
  'audit_log',
  'events',
  'mappings',
  'schemas',
  'tenant_providers',
  'tenants',
]

const EMPTY_REQUIRED = ['events', 'audit_log']

export class BootstrapRefusal extends Error {}

export function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--database-url') out.databaseUrl = argv[++i]
    else if (arg === '--expect-database') out.expectDatabase = argv[++i]
    else if (arg === '--migrations-dir') out.migrationsDir = argv[++i]
    else throw new BootstrapRefusal(`unknown argument: ${arg}`)
  }
  return out
}

export function checkTarget({ databaseUrl, expectDatabase }) {
  if (!databaseUrl) throw new BootstrapRefusal('--database-url is required')
  if (!expectDatabase) throw new BootstrapRefusal('--expect-database is required')
  let url
  try {
    url = new URL(databaseUrl)
  } catch {
    throw new BootstrapRefusal('--database-url is not a valid URL')
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new BootstrapRefusal(`refusing non-local host ${url.hostname}; this script runs only against a local database`)
  }
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (name !== expectDatabase) {
    throw new BootstrapRefusal(`database name ${name || '(none)'} does not match --expect-database ${expectDatabase}`)
  }
  return { host: url.hostname, port: url.port || '5432', database: name }
}

export function checkManifest(migrationsDir) {
  const onDisk = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  const listed = [...EXCEPTALERT_FILES].sort()
  const missing = listed.filter((f) => !onDisk.includes(f))
  const extra = onDisk.filter((f) => !listed.includes(f))
  if (missing.length || extra.length) {
    throw new BootstrapRefusal(
      `migration directory does not match the bootstrap manifest (missing: ${missing.join(', ') || 'none'}; unlisted: ${extra.join(', ') || 'none'})`
    )
  }
}

// state: { tables: string[] (schema-qualified), ledger: [{version, description, success}], counts: {table: n},
//          tenants: [{id, ingress_key}] }
export function evaluatePreconditions(state) {
  const failures = []
  const expectedTables = RELAY_TABLES.map((t) => `public.${t}`)
  const missingTables = expectedTables.filter((t) => !state.tables.includes(t))
  const unexpectedTables = state.tables.filter((t) => !expectedTables.includes(t))
  if (missingTables.length) failures.push(`missing Relay tables: ${missingTables.join(', ')}`)
  if (unexpectedTables.length) failures.push(`unexpected tables present: ${unexpectedTables.join(', ')}`)

  if (!state.tables.includes('public._sqlx_migrations')) {
    failures.push('no Relay migration ledger (_sqlx_migrations); Relay has not migrated this database')
  } else {
    const wanted = RELAY_LEDGER.map(([v, d]) => `${v}:${d}:true`)
    const got = state.ledger.map((r) => `${r.version}:${r.description}:${r.success}`)
    if (wanted.join('|') !== got.join('|')) {
      failures.push(`Relay ledger is not exactly the pinned build's ${RELAY_LEDGER.length} migrations (versions ${RELAY_LEDGER.map(([v]) => v).join(',')}), all successful (found: ${got.join(', ') || 'none'})`)
    } else {
      const mismatched = RELAY_LEDGER.filter(([v, , checksum]) => state.ledger.find((r) => r.version === v)?.checksum !== checksum).map(([v]) => v)
      if (mismatched.length) failures.push(`Relay ledger checksum differs from the pinned migration file for version(s) ${mismatched.join(', ')}`)
    }
  }

  for (const table of EMPTY_REQUIRED) {
    if (state.counts?.[table] === undefined) continue
    if (state.counts[table] !== 0) failures.push(`${table} holds ${state.counts[table]} row(s); a fresh database is required`)
  }

  if (state.tenants) {
    const ids = state.tenants.map((t) => t.id)
    if (ids.length !== 1 || ids[0] !== CANONICAL_TENANT_ID) {
      failures.push(`tenants must hold exactly the canonical default row (found ${ids.length}: ${ids.join(', ') || 'none'})`)
    } else if (!state.tenants[0].ingress_key) {
      failures.push('canonical default tenant has no ingress_key')
    }
  }
  return failures
}

export async function readState(sql) {
  const tableRows = await sql`
    SELECT table_schema || '.' || table_name AS name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY 1`
  const tables = tableRows.map((r) => r.name)
  const state = { tables, ledger: [], counts: {}, tenants: null }
  if (tables.includes('public._sqlx_migrations')) {
    state.ledger = await sql`SELECT version::int AS version, description, success, encode(checksum, 'hex') AS checksum FROM _sqlx_migrations ORDER BY version`
  }
  for (const table of EMPTY_REQUIRED) {
    if (tables.includes(`public.${table}`)) {
      const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM ${sql(table)}`
      state.counts[table] = n
    }
  }
  if (tables.includes('public.tenants')) {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants'`
    const hasKey = cols.some((c) => c.column_name === 'ingress_key')
    state.tenants = hasKey
      ? await sql`SELECT id::text AS id, ingress_key FROM tenants ORDER BY id`
      : (await sql`SELECT id::text AS id FROM tenants ORDER BY id`).map((r) => ({ ...r, ingress_key: null }))
  }
  return state
}

export async function readDefaultKey(sql) {
  const [row] = await sql`SELECT ingress_key FROM tenants WHERE id = ${CANONICAL_TENANT_ID}`
  return row?.ingress_key ?? null
}

export async function applyFiles(sql, migrationsDir, log = console.log) {
  for (const file of EXCEPTALERT_FILES) {
    const source = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    log(`Applying ${file}`)
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(source).simple()
      })
    } catch (error) {
      throw new Error(`${file} failed: ${error.message}`)
    }
  }
}

export async function bootstrap({ databaseUrl, expectDatabase, migrationsDir }, log = console.log) {
  const target = checkTarget({ databaseUrl, expectDatabase })
  checkManifest(migrationsDir)
  log(`Target: ${target.host}:${target.port}/${target.database}`)
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} })
  try {
    const failures = evaluatePreconditions(await readState(sql))
    if (failures.length) throw new BootstrapRefusal(`not a fresh Relay-migrated database:\n  - ${failures.join('\n  - ')}`)
    const before = await readDefaultKey(sql)
    log(`Default tenant ingress_key before: ${before}`)
    await applyFiles(sql, migrationsDir, log)
    const after = await readDefaultKey(sql)
    log(`Default tenant ingress_key after:  ${after}`)
    if (before !== after) throw new Error(`default tenant ingress_key changed (${before} -> ${after})`)
    log('Bootstrap complete')
    return { before, after }
  } finally {
    await sql.end()
  }
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  try {
    const args = parseArgs(process.argv.slice(2))
    await bootstrap({
      databaseUrl: args.databaseUrl,
      expectDatabase: args.expectDatabase,
      migrationsDir: path.resolve(args.migrationsDir ?? path.join(here, '..', 'drizzle', 'migrations')),
    })
  } catch (error) {
    console.error(error instanceof BootstrapRefusal ? `Refused: ${error.message}` : `Failed: ${error.message}`)
    process.exit(error instanceof BootstrapRefusal ? 2 : 1)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
