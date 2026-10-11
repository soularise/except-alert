// ER-0060 clean-room validation (T5, T6). Skipped unless ER0060_CLEANROOM=1.
// Builds the pinned Relay image, creates the disposable Compose project `er0060-bootstrap`, runs the Relay-first bootstrap,
// refusal cases and organization creation, then tears down only what it created. See scripts/bootstrap-cleanroom.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skip = process.env.ER0060_CLEANROOM !== '1' && 'set ER0060_CLEANROOM=1 to run the disposable-container validation'
const here = path.dirname(fileURLToPath(import.meta.url))

test('ER-0060 clean-room bootstrap validation', { skip, timeout: 3600000 }, () => {
  const evidence = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'er0060-evidence-')), 'evidence.json')
  const run = spawnSync(process.execPath, [path.join(here, '..', 'scripts', 'bootstrap-cleanroom.mjs'), '--evidence', evidence], { encoding: 'utf8' })
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}\nevidence: ${evidence}`)
})
