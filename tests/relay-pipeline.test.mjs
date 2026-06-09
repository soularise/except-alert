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
