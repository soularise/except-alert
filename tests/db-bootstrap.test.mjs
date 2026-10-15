// ER-0060 unit checks for the fresh Relay-first bootstrap. No database is touched.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CANONICAL_TENANT_ID,
  EXCEPTALERT_FILES,
  RELAY_LEDGER,
  RELAY_TABLES,
  BootstrapRefusal,
  checkManifest,
  checkTarget,
  evaluatePreconditions,
  parseArgs,
} from '../scripts/bootstrap-fresh-database.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(here, '..', 'drizzle', 'migrations')
const runnerSource = fs.readFileSync(path.join(here, '..', 'scripts', 'apply-sql-migrations.mjs'), 'utf8')

// The db:apply runner executes on import, so take its splitter from source text instead of importing it.
const splitSqlStatements = new Function(
  `${runnerSource.slice(runnerSource.indexOf('function splitSqlStatements'))}; return splitSqlStatements`
)()

function freshRelayState() {
  return {
    tables: RELAY_TABLES.map((t) => `public.${t}`),
    ledger: RELAY_LEDGER.map(([version, description, checksum]) => ({ version, description, success: true, checksum })),
    counts: { events: 0, audit_log: 0, canonical_events: 0 },
    tenants: [{ id: CANONICAL_TENANT_ID, ingress_key: 'org_abc' }],
  }
}

test('T1 manifest matches the migrations directory, each file once, duplicate prefixes in lexical order', () => {
  assert.doesNotThrow(() => checkManifest(migrationsDir))
  assert.equal(new Set(EXCEPTALERT_FILES).size, EXCEPTALERT_FILES.length)
  const sorted = [...EXCEPTALERT_FILES].sort()
  assert.deepEqual(EXCEPTALERT_FILES, sorted)
  const idx = (f) => EXCEPTALERT_FILES.indexOf(f)
  assert.ok(idx('0012_controller_action_bindings.sql') < idx('0012_tenant_plan_changes.sql'))
  assert.ok(idx('0013_agent_run_deadline_controller.sql') < idx('0013_upgrade_requests.sql'))
})

test('T1 manifest refuses an unlisted or missing file', () => {
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? '/tmp'), 'er0060-manifest-'))
  try {
    for (const f of EXCEPTALERT_FILES.slice(1)) fs.writeFileSync(path.join(tmp, f), '')
    fs.writeFileSync(path.join(tmp, '9999_extra.sql'), '')
    assert.throws(() => checkManifest(tmp), /missing: 0001_extend_events.sql; unlisted: 9999_extra.sql/)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('T2 target guard refuses remote hosts, wrong database names and missing arguments', () => {
  assert.throws(() => checkTarget({ databaseUrl: 'postgres://u:p@db.example.com:5432/x', expectDatabase: 'x' }), BootstrapRefusal)
  assert.throws(() => checkTarget({ databaseUrl: 'postgres://u:p@10.0.0.5:5432/x', expectDatabase: 'x' }), /non-local host/)
  assert.throws(() => checkTarget({ databaseUrl: 'postgres://u:p@localhost:15433/other', expectDatabase: 'x' }), /does not match/)
  assert.throws(() => checkTarget({ databaseUrl: 'postgres://u:p@localhost:15433/x' }), /--expect-database is required/)
  assert.throws(() => checkTarget({ expectDatabase: 'x' }), /--database-url is required/)
  assert.deepEqual(checkTarget({ databaseUrl: 'postgres://u:p@127.0.0.1:15433/x', expectDatabase: 'x' }), {
    host: '127.0.0.1',
    port: '15433',
    database: 'x',
  })
  assert.throws(() => parseArgs(['--database', 'x']), /unknown argument/)
})

test('T2 the script never reads DATABASE_URL or env files', () => {
  const source = fs.readFileSync(path.join(here, '..', 'scripts', 'bootstrap-fresh-database.mjs'), 'utf8')
  assert.ok(!/process\.env/.test(source))
  assert.ok(!/\.env/.test(source.replace(/\/\/.*$/gm, '')))
})

test('T2 a fresh Relay-migrated state passes', () => {
  assert.deepEqual(evaluatePreconditions(freshRelayState()), [])
})

test('T2 each precondition failure is reported', () => {
  const cases = {
    'unmigrated empty database': { tables: [], ledger: [], counts: {}, tenants: null },
    'stray table': (() => { const s = freshRelayState(); s.tables.push('public.stray'); return s })(),
    'ExceptAlert table already present': (() => { const s = freshRelayState(); s.tables.push('public.actions'); return s })(),
    'partial ledger': (() => { const s = freshRelayState(); s.ledger.pop(); return s })(),
    'altered ledger checksum': (() => { const s = freshRelayState(); s.ledger[3].checksum = s.ledger[3].checksum.replace(/^./, (c) => (c === '0' ? '1' : '0')); return s })(),
    'failed ledger entry': (() => { const s = freshRelayState(); s.ledger[3].success = false; return s })(),
    'events not empty': (() => { const s = freshRelayState(); s.counts.events = 1; return s })(),
    'extra tenant': (() => { const s = freshRelayState(); s.tenants.push({ id: 'x', ingress_key: 'k' }); return s })(),
    'no default tenant': (() => { const s = freshRelayState(); s.tenants = []; return s })(),
    'default tenant without key': (() => { const s = freshRelayState(); s.tenants[0].ingress_key = null; return s })(),
  }
  for (const [name, state] of Object.entries(cases)) {
    assert.ok(evaluatePreconditions(state).length > 0, `${name} should be refused`)
  }
})

test('T3 no ExceptAlert migration file uses dollar quoting', () => {
  for (const file of EXCEPTALERT_FILES) {
    const source = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    assert.ok(!/\$[A-Za-z_]*\$/.test(source), `${file} contains dollar quoting`)
  }
})

test('T3 the db:apply splitter yields the expected statements for the edited files', () => {
  const read = (f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8')
  const code = (statements) => statements.map((st) => st.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim())
  const s4 = code(splitSqlStatements(read('0004_auth.sql')))
  assert.ok(s4.some((s) => s === "ALTER TABLE tenants ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
  assert.ok(s4.some((s) => s === "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'"))
  const s5 = code(splitSqlStatements(read('0005_add_tenant_id.sql')))
  const seed = s5.filter((s) => s.includes('INSERT INTO tenants'))
  assert.equal(seed.length, 1)
  assert.doesNotMatch(seed[0], /ON CONFLICT/)
  assert.match(seed[0], /WHERE NOT EXISTS \(SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001'\)/)
  for (const file of EXCEPTALERT_FILES) {
    assert.ok(splitSqlStatements(read(file)).length > 0, `${file} produced no statements`)
  }
})

test('T4 the edited statements are repeat-safe forms', () => {
  const s4 = fs.readFileSync(path.join(migrationsDir, '0004_auth.sql'), 'utf8')
  assert.match(s4, /ALTER COLUMN id SET DEFAULT gen_random_uuid\(\)/)
  assert.match(s4, /ADD COLUMN IF NOT EXISTS config JSONB/)
  const s5 = fs.readFileSync(path.join(migrationsDir, '0005_add_tenant_id.sql'), 'utf8')
  assert.match(s5, /WHERE NOT EXISTS/)
})

test('T2 an altered checksum is reported as a checksum difference, naming the version', () => {
  const state = freshRelayState()
  state.ledger[3].checksum = 'ff'.repeat(48)
  const failures = evaluatePreconditions(state)
  assert.equal(failures.length, 1)
  assert.match(failures[0], /checksum differs .* version\(s\) 4/)
})

test('T2 every pinned checksum is a 96-character SHA-384 hex digest, unique per version', () => {
  const sums = RELAY_LEDGER.map(([, , checksum]) => checksum)
  assert.ok(sums.every((c) => /^[0-9a-f]{96}$/.test(c)))
  assert.equal(new Set(sums).size, sums.length)
  assert.deepEqual(RELAY_LEDGER.map(([v]) => v), [1, 2, 3, 4, 5, 6, 8, 9, 10, 11])
})
