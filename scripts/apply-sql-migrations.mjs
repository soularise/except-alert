#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import postgres from 'postgres'

const envFiles = ['.env', '.env.production.local']

for (const envFile of envFiles) {
  loadEnvFile(path.resolve(process.cwd(), envFile))
}

const migrationFiles = process.argv.slice(2)

if (migrationFiles.length === 0) {
  console.error('Usage: npm run db:apply -- drizzle/migrations/0007_organizations_and_plans.sql')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_URL.includes('sslmode=require') ? 'require' : undefined,
})

try {
  for (const migrationFile of migrationFiles) {
    await applyMigration(migrationFile)
  }
} finally {
  await sql.end()
}

async function applyMigration(migrationFile) {
  const resolved = path.resolve(process.cwd(), migrationFile)
  const source = fs.readFileSync(resolved, 'utf8')
  const statements = splitSqlStatements(source)

  console.log(`Applying ${path.relative(process.cwd(), resolved)} (${statements.length} statements)`)

  for (const statement of statements) {
    await sql.unsafe(statement)
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (!key || process.env[key] !== undefined) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function splitSqlStatements(source) {
  const statements = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    const next = source[i + 1]

    if (inLineComment) {
      current += char
      if (char === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      current += char
      if (char === '*' && next === '/') {
        current += next
        i += 1
        inBlockComment = false
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
      current += char + next
      i += 1
      inLineComment = true
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
      current += char + next
      i += 1
      inBlockComment = true
      continue
    }

    if (!inDoubleQuote && char === "'") {
      current += char
      if (inSingleQuote && next === "'") {
        current += next
        i += 1
      } else {
        inSingleQuote = !inSingleQuote
      }
      continue
    }

    if (!inSingleQuote && char === '"') {
      current += char
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === ';') {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ''
      continue
    }

    current += char
  }

  const tail = current.trim()
  if (tail) statements.push(tail)

  return statements
}
