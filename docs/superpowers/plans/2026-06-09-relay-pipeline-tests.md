# Relay Pipeline Integration Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `tests/relay-pipeline.test.mjs` that posts real webhook fixtures through Relay and asserts normalized DB rows match expected values exactly, locking down the product contract between Relay and ExceptAlert.

**Architecture:** Single test file using `node:test` + `node:assert/strict` (same runner as the existing suite). Five fixture files are copied from the Relay repo into `tests/fixtures/`. Each test POSTs to Relay at `http://localhost:3800`, captures `hook_id` from the response, queries Postgres directly for the resulting event row, asserts each field, then deletes the row in `t.after()`. No ExceptAlert server required — assertions go straight to the DB.

**Tech Stack:** Node.js `node:test`, `node:assert/strict`, `postgres` npm package (already a dep at `^3.4.9`), native `fetch` (built into Node 18+, project uses Node 24).

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `tests/fixtures/stripe-charge-failed.json` | Stripe fixture |
| Create | `tests/fixtures/stripe-charge-refunded.json` | Stripe fixture |
| Create | `tests/fixtures/stripe-payment-intent-succeeded.json` | Stripe fixture |
| Create | `tests/fixtures/github-workflow-run-failed.json` | GitHub fixture |
| Create | `tests/fixtures/pagerduty-incident-triggered.json` | PagerDuty fixture |
| Create | `tests/relay-pipeline.test.mjs` | Test file (auto-picked up by `npm test` via `tests/*.test.mjs` glob) |

---

### Task 1: Copy fixture files

**Files:**
- Create: `tests/fixtures/` (5 JSON files)

- [ ] **Step 1: Ensure the dev stack is running**

```bash
npm run dev
```

Confirm Relay and Postgres are up:

```bash
docker compose ps
```

Both `relay` and `postgres` services should show `running`.

- [ ] **Step 2: Create the fixtures directory and copy files**

```bash
mkdir -p tests/fixtures
cp ~/claudehome/projects/relay/tests/fixtures/stripe-charge-failed.json tests/fixtures/
cp ~/claudehome/projects/relay/tests/fixtures/stripe-charge-refunded.json tests/fixtures/
cp ~/claudehome/projects/relay/tests/fixtures/stripe-payment-intent-succeeded.json tests/fixtures/
cp ~/claudehome/projects/relay/tests/fixtures/github-workflow-run-failed.json tests/fixtures/
cp ~/claudehome/projects/relay/tests/fixtures/pagerduty-incident-triggered.json tests/fixtures/
```

- [ ] **Step 3: Verify all 5 files are present**

```bash
ls tests/fixtures/
```

Expected:
```
github-workflow-run-failed.json
pagerduty-incident-triggered.json
stripe-charge-failed.json
stripe-charge-refunded.json
stripe-payment-intent-succeeded.json
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/
git commit -m "test: add relay pipeline fixture files"
```

---

### Task 2: Write the test scaffold

**Files:**
- Create: `tests/relay-pipeline.test.mjs`

- [ ] **Step 1: Create the file with imports, constants, helpers, and lifecycle hooks**

Create `tests/relay-pipeline.test.mjs` with this exact content:

```javascript
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
```

- [ ] **Step 2: Verify the scaffold loads without errors**

```bash
node --test tests/relay-pipeline.test.mjs
```

Expected (0 tests, clean exit):
```
ℹ tests 0
ℹ suites 0
ℹ pass 0
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ...
```

- [ ] **Step 3: Commit**

```bash
git add tests/relay-pipeline.test.mjs
git commit -m "test: add relay-pipeline test scaffold with helpers"
```

---

### Task 3: Stripe charge.failed — deep assertions

**Files:**
- Modify: `tests/relay-pipeline.test.mjs`

The Stripe template maps `charge.failed` → `severity: error`, `category: stripe.charge.failed`. Title is `"{type}: {data.object.id}"`. Description comes from `data.object.failure_message`. `occurred_at` is derived from `data.object.created` (unix epoch). `payload` is the full raw webhook body stored verbatim.

- [ ] **Step 1: Append the test case to `tests/relay-pipeline.test.mjs`**

```javascript
test('stripe charge.failed — deep assertions', async (t) => {
  let hookId

  t.after(async () => {
    if (hookId) await sql`DELETE FROM events WHERE hook_id = ${hookId}`
  })

  const body = fixture('stripe-charge-failed.json')
  const res = await postToRelay('stripe', body)
  assert.equal(res.status, 200, `Relay returned ${res.status}: ${await res.text()}`)

  const data = await res.json()
  hookId = data.hook_id
  assert.ok(hookId, 'Relay response missing hook_id')

  const [event] = await sql`SELECT * FROM events WHERE hook_id = ${hookId}`
  assert.ok(event, `No event row found for hook_id ${hookId}`)

  assert.equal(event.source, 'stripe')
  assert.equal(event.severity, 'error')
  assert.equal(event.category, 'stripe.charge.failed')
  assert.equal(event.title, 'charge.failed: ch_3NzQKL2eZvKYlo2C0XVz4Y1s')
  assert.equal(event.description, 'Your card was declined. Network status: declined_by_network')
  assert.deepEqual(event.tags, { charge_id: 'ch_3NzQKL2eZvKYlo2C0XVz4Y1s' })
  assert.deepEqual(event.payload, body)
  assert.equal(event.tenant_id, DEFAULT_TENANT_ID)
  assert.equal(event.occurred_at.getTime(), new Date(1748872200 * 1000).getTime())
})
```

- [ ] **Step 2: Run the test**

```bash
node --test tests/relay-pipeline.test.mjs
```

Expected:
```
✔ stripe charge.failed — deep assertions (... ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

- [ ] **Step 3: Commit**

```bash
git add tests/relay-pipeline.test.mjs
git commit -m "test: stripe charge.failed deep assertions"
```

---

### Task 4: Stripe charge.refunded — deep assertions

**Files:**
- Modify: `tests/relay-pipeline.test.mjs`

`charge.refunded` maps to `severity: info`. There is no `failure_message` in the fixture so `description` defaults to `""`. `occurred_at` comes from `data.object.created: 1748875800`.

- [ ] **Step 1: Append the test case**

```javascript
test('stripe charge.refunded — deep assertions', async (t) => {
  let hookId

  t.after(async () => {
    if (hookId) await sql`DELETE FROM events WHERE hook_id = ${hookId}`
  })

  const body = fixture('stripe-charge-refunded.json')
  const res = await postToRelay('stripe', body)
  assert.equal(res.status, 200, `Relay returned ${res.status}: ${await res.text()}`)

  const data = await res.json()
  hookId = data.hook_id
  assert.ok(hookId, 'Relay response missing hook_id')

  const [event] = await sql`SELECT * FROM events WHERE hook_id = ${hookId}`
  assert.ok(event, `No event row found for hook_id ${hookId}`)

  assert.equal(event.source, 'stripe')
  assert.equal(event.severity, 'info')
  assert.equal(event.category, 'stripe.charge.refunded')
  assert.equal(event.title, 'charge.refunded: ch_3NzQKL2eZvKYlo2C0Refund')
  assert.equal(event.description, '')
  assert.deepEqual(event.tags, { charge_id: 'ch_3NzQKL2eZvKYlo2C0Refund' })
  assert.deepEqual(event.payload, body)
  assert.equal(event.tenant_id, DEFAULT_TENANT_ID)
  assert.equal(event.occurred_at.getTime(), new Date(1748875800 * 1000).getTime())
})
```

- [ ] **Step 2: Run the test**

```bash
node --test tests/relay-pipeline.test.mjs
```

Expected:
```
✔ stripe charge.failed — deep assertions (... ms)
✔ stripe charge.refunded — deep assertions (... ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

- [ ] **Step 3: Commit**

```bash
git add tests/relay-pipeline.test.mjs
git commit -m "test: stripe charge.refunded deep assertions"
```

---

### Task 5: Stripe payment_intent.succeeded — deep assertions

**Files:**
- Modify: `tests/relay-pipeline.test.mjs`

`payment_intent.succeeded` maps to `severity: info`. No `failure_message` so `description` is `""`. Note: the template uses `$.data.object.id` for both `title` and `tags.charge_id` — the field is named `charge_id` even for payment intents (it's the template key, not the semantic type). `occurred_at` from `data.object.created: 1748879400`.

- [ ] **Step 1: Append the test case**

```javascript
test('stripe payment_intent.succeeded — deep assertions', async (t) => {
  let hookId

  t.after(async () => {
    if (hookId) await sql`DELETE FROM events WHERE hook_id = ${hookId}`
  })

  const body = fixture('stripe-payment-intent-succeeded.json')
  const res = await postToRelay('stripe', body)
  assert.equal(res.status, 200, `Relay returned ${res.status}: ${await res.text()}`)

  const data = await res.json()
  hookId = data.hook_id
  assert.ok(hookId, 'Relay response missing hook_id')

  const [event] = await sql`SELECT * FROM events WHERE hook_id = ${hookId}`
  assert.ok(event, `No event row found for hook_id ${hookId}`)

  assert.equal(event.source, 'stripe')
  assert.equal(event.severity, 'info')
  assert.equal(event.category, 'stripe.payment_intent.succeeded')
  assert.equal(event.title, 'payment_intent.succeeded: pi_3NzQKL2eZvKYlo2C0PISucc')
  assert.equal(event.description, '')
  assert.deepEqual(event.tags, { charge_id: 'pi_3NzQKL2eZvKYlo2C0PISucc' })
  assert.deepEqual(event.payload, body)
  assert.equal(event.tenant_id, DEFAULT_TENANT_ID)
  assert.equal(event.occurred_at.getTime(), new Date(1748879400 * 1000).getTime())
})
```

- [ ] **Step 2: Run the test**

```bash
node --test tests/relay-pipeline.test.mjs
```

Expected:
```
✔ stripe charge.failed — deep assertions (... ms)
✔ stripe charge.refunded — deep assertions (... ms)
✔ stripe payment_intent.succeeded — deep assertions (... ms)
ℹ tests 3
ℹ pass 3
ℹ fail 0
```

- [ ] **Step 3: Commit**

```bash
git add tests/relay-pipeline.test.mjs
git commit -m "test: stripe payment_intent.succeeded deep assertions"
```

---

### Task 6: GitHub workflow-run-failed — shallow smoke test

**Files:**
- Modify: `tests/relay-pipeline.test.mjs`

Shallow test: confirms Relay accepts the GitHub fixture without error and writes a row with `source = "github"`. No field-level assertions — this validates the mapping layer handles a non-Stripe provider without crashing.

- [ ] **Step 1: Append the test case**

```javascript
test('github workflow-run-failed — shallow smoke test', async (t) => {
  let hookId

  t.after(async () => {
    if (hookId) await sql`DELETE FROM events WHERE hook_id = ${hookId}`
  })

  const body = fixture('github-workflow-run-failed.json')
  const res = await postToRelay('github', body)
  assert.equal(res.status, 200, `Relay returned ${res.status}: ${await res.text()}`)

  const data = await res.json()
  hookId = data.hook_id
  assert.ok(hookId, 'Relay response missing hook_id')

  const [event] = await sql`SELECT * FROM events WHERE hook_id = ${hookId}`
  assert.ok(event, `No event row found for hook_id ${hookId}`)
  assert.equal(event.source, 'github')
  assert.equal(event.tenant_id, DEFAULT_TENANT_ID)
})
```

- [ ] **Step 2: Run the test**

```bash
node --test tests/relay-pipeline.test.mjs
```

Expected:
```
✔ stripe charge.failed — deep assertions (... ms)
✔ stripe charge.refunded — deep assertions (... ms)
✔ stripe payment_intent.succeeded — deep assertions (... ms)
✔ github workflow-run-failed — shallow smoke test (... ms)
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

- [ ] **Step 3: Commit**

```bash
git add tests/relay-pipeline.test.mjs
git commit -m "test: github workflow-run-failed shallow smoke test"
```

---

### Task 7: PagerDuty incident-triggered — shallow smoke test

**Files:**
- Modify: `tests/relay-pipeline.test.mjs`

- [ ] **Step 1: Append the test case**

```javascript
test('pagerduty incident-triggered — shallow smoke test', async (t) => {
  let hookId

  t.after(async () => {
    if (hookId) await sql`DELETE FROM events WHERE hook_id = ${hookId}`
  })

  const body = fixture('pagerduty-incident-triggered.json')
  const res = await postToRelay('pagerduty', body)
  assert.equal(res.status, 200, `Relay returned ${res.status}: ${await res.text()}`)

  const data = await res.json()
  hookId = data.hook_id
  assert.ok(hookId, 'Relay response missing hook_id')

  const [event] = await sql`SELECT * FROM events WHERE hook_id = ${hookId}`
  assert.ok(event, `No event row found for hook_id ${hookId}`)
  assert.equal(event.source, 'pagerduty')
  assert.equal(event.tenant_id, DEFAULT_TENANT_ID)
})
```

- [ ] **Step 2: Run the test**

```bash
node --test tests/relay-pipeline.test.mjs
```

Expected:
```
✔ stripe charge.failed — deep assertions (... ms)
✔ stripe charge.refunded — deep assertions (... ms)
✔ stripe payment_intent.succeeded — deep assertions (... ms)
✔ github workflow-run-failed — shallow smoke test (... ms)
✔ pagerduty incident-triggered — shallow smoke test (... ms)
ℹ tests 5
ℹ pass 5
ℹ fail 0
```

- [ ] **Step 3: Commit**

```bash
git add tests/relay-pipeline.test.mjs
git commit -m "test: pagerduty incident-triggered shallow smoke test"
```

---

### Task 8: Run full test suite

**Files:** none

- [ ] **Step 1: Run the full suite**

```bash
npm test
```

Expected: all tests in both `tenancy-boundary.test.mjs` and `relay-pipeline.test.mjs` pass with no failures.

- [ ] **Step 2: Confirm output shows both files passing**

Look for both test file names in the output and `fail 0` in the summary.
