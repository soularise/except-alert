#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const envFiles = ['.env', '.env.local', '.env.production.local']
const shellEnvKeys = new Set(Object.keys(process.env))

for (const envFile of envFiles) {
  loadEnvFile(path.resolve(process.cwd(), envFile))
}

const baseUrl =
  process.env.CONTROLLER_BASE_URL ||
  process.env.EXCEPTALERT_APP_URL ||
  process.env.BETTER_AUTH_URL ||
  'http://localhost:3000'

if (!process.env.CONTROLLER_SECRET) {
  console.error('CONTROLLER_SECRET is not set')
  process.exit(1)
}

const endpoint = new URL('/api/internal/controller', baseUrl)

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-controller-secret': process.env.CONTROLLER_SECRET,
    },
  })

  const body = await readResponseBody(response)

  if (!response.ok) {
    console.error(`Controller scheduler returned HTTP ${response.status}`)
    if (body) console.error(body)
    process.exit(1)
  }

  console.log(body || `Controller scheduler completed with HTTP ${response.status}`)
} catch (err) {
  console.error(err instanceof Error ? err.message : 'Controller scheduler request failed')
  process.exit(1)
}

async function readResponseBody(response) {
  const text = await response.text()
  if (!text) return ''

  try {
    return JSON.stringify(JSON.parse(text))
  } catch {
    return text
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

    if (!key || shellEnvKeys.has(key)) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}
