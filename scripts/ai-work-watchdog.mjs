#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ADAPTER_VERSION = '0.1.0'
const PROVIDER_ID = 'agent-observation'

function usage() {
  console.error('Usage: EA_RELAY_URL=... EA_TENANT_REF=... EA_WATCHDOG_TOKEN=... node scripts/ai-work-watchdog.mjs --label "Safe label" -- command [args...]')
  process.exit(2)
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`${name} is required.`)
    process.exit(2)
  }
  return value
}

const args = process.argv.slice(2)
const separator = args.indexOf('--')
if (separator === -1 || separator === args.length - 1) usage()

const labelIndex = args.indexOf('--label')
if (labelIndex === -1 || !args[labelIndex + 1] || labelIndex > separator) usage()

const safeLabel = args[labelIndex + 1].trim()
if (!safeLabel || safeLabel.length > 120) usage()

const relayUrl = required('EA_RELAY_URL').replace(/\/$/, '')
const tenantRef = required('EA_TENANT_REF')
const token = required('EA_WATCHDOG_TOKEN')
const spoolDir = process.env.EA_WATCHDOG_SPOOL_DIR?.trim() || join(process.cwd(), '.exceptalert-watchdog-spool')
const heartbeatSeconds = Number(process.env.EA_HEARTBEAT_SECONDS ?? '60')
if (!Number.isInteger(heartbeatSeconds) || heartbeatSeconds < 15 || heartbeatSeconds > 300) {
  console.error('EA_HEARTBEAT_SECONDS must be an integer from 15 to 300.')
  process.exit(2)
}

const command = args.slice(separator + 1)
const correlationId = randomUUID()
const startedAt = Date.now()

function eventPayload(eventName, outcomeClass, extra = {}) {
  const occurredAt = new Date().toISOString()
  const durationMs = Date.now() - startedAt
  return {
    schema_version: 1,
    event_id: randomUUID(),
    event_name: eventName,
    occurred_at: occurredAt,
    correlation_id: correlationId,
    runtime: { family: 'command', adapter_version: ADAPTER_VERSION },
    subject: { kind: 'developer_workflow', name: safeLabel },
    evidence: { level: 'adapter', capture_method: 'explicit_wrapper' },
    outcome: { class: outcomeClass, ...(eventName !== 'agent.run.started' ? { duration_ms: durationMs } : {}) },
    attributes: { interactive: process.stdout.isTTY === true },
    severity: outcomeClass === 'failure' || outcomeClass === 'aborted' ? 'error' : 'info',
    title: `AI work ${eventName.replace('agent.run.', '').replace('agent.execution.', '')}: ${safeLabel}`,
    description: `Explicit AI Work Watchdog lifecycle signal for ${safeLabel}.`,
    tags: {
      correlation_id: correlationId,
      safe_label: safeLabel,
      runtime_family: 'command',
      adapter_version: ADAPTER_VERSION,
      evidence_level: 'adapter',
      outcome_class: outcomeClass,
      ...extra,
    },
  }
}

async function emit(event) {
  try {
    const response = await fetch(`${relayUrl}/hook/${encodeURIComponent(tenantRef)}/${PROVIDER_ID}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-relay-token': token,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) {
      console.error(`Watchdog event delivery failed: HTTP ${response.status}`)
      await spool(event)
    }
  } catch (error) {
    console.error(`Watchdog event delivery failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    await spool(event)
  }
}

async function spool(event) {
  try {
    await mkdir(spoolDir, { recursive: true })
    const entries = (await readdir(spoolDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .sort((left, right) => left.name.localeCompare(right.name))
    await Promise.all(entries.slice(0, Math.max(0, entries.length - 99)).map((entry) => rm(join(spoolDir, entry.name))))
    await writeFile(join(spoolDir, `${event.event_id}.json`), JSON.stringify(event), { mode: 0o600 })
  } catch (error) {
    console.error(`Watchdog spool failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

async function flushSpool() {
  try {
    const entries = await readdir(spoolDir, { withFileTypes: true })
    for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith('.json')).slice(0, 100)) {
      const path = join(spoolDir, entry.name)
      const event = JSON.parse(await readFile(path, 'utf8'))
      const response = await fetch(`${relayUrl}/hook/${encodeURIComponent(tenantRef)}/${PROVIDER_ID}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-relay-token': token },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(5_000),
      })
      if (response.ok) await rm(path)
    }
  } catch (error) {
    if (!(error instanceof Error && error.code === 'ENOENT')) {
      console.error(`Watchdog spool replay failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
}

const child = spawn(command[0], command.slice(1), { stdio: 'inherit' })
void flushSpool()
void emit(eventPayload('agent.run.started', 'running'))
const heartbeat = setInterval(() => void emit(eventPayload('agent.execution.heartbeat', 'running')), heartbeatSeconds * 1_000)

let receivedSignal = null
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    receivedSignal = signal
    child.kill(signal)
  })
}

child.on('error', async (error) => {
  clearInterval(heartbeat)
  await emit(eventPayload('agent.run.failed', 'failure', { launch_error: error.code ?? 'spawn_failed' }))
  process.exitCode = 1
})

child.on('exit', async (code, signal) => {
  clearInterval(heartbeat)
  const aborted = receivedSignal || signal
  const outcome = aborted ? 'aborted' : code === 0 ? 'success' : 'failure'
  const eventName = aborted ? 'agent.run.aborted' : code === 0 ? 'agent.run.completed' : 'agent.run.failed'
  await emit(eventPayload(eventName, outcome, { exit_code: code ?? null, signal: signal ?? receivedSignal ?? null }))
  process.exitCode = code ?? 1
})
