# Relay Pipeline Integration Tests — Design

**Date:** 2026-06-09  
**Status:** Approved

## Goal

A test suite that posts real webhook payloads through Relay and asserts the normalized event rows in Postgres match expected values exactly. The purpose is to lock down the product contract: *when this payload arrives at Relay, ExceptAlert sees exactly this data.*

## Location

`tests/relay-pipeline.test.mjs` in the except-alert repo. Runs as part of `npm test` alongside the existing `tenancy-boundary.test.mjs`.

## Fixtures

Relevant fixture files copied from `relay/tests/fixtures/` into `except-alert/tests/fixtures/`:

- `stripe-charge-failed.json`
- `stripe-charge-refunded.json`
- `stripe-payment-intent-succeeded.json`
- `github-workflow-run-failed.json`
- `pagerduty-incident-triggered.json`

The test file reads them with `fs.readFileSync`. Both repos retain their own copies — no cross-repo path dependency.

## Prerequisites

```bash
npm run dev   # starts postgres + relay (already the local dev command)
npm test      # runs full suite including pipeline tests
```

No ExceptAlert server required. Assertions go directly to the DB.

## Test Runner

`node:test` + `node:assert/strict` — same as the existing suite. The `postgres` npm package (already a dependency) handles DB queries. No new dependencies.

## Lifecycle

```
before()        open postgres connection
  test(...)     run case, capture hook_id
    after()     DELETE FROM events WHERE hook_id = $1
after()         close postgres connection
```

Each test is independent. A failure in one case does not dirty subsequent cases.

## Test Cases

### Stripe `charge.failed` — deep assertions

POST `stripe-charge-failed.json` to `http://localhost:3800/hook/stripe`.

Assert on the row returned by `SELECT * FROM events WHERE hook_id = $1`:

| Field | Expected value |
|---|---|
| `source` | `"stripe"` |
| `severity` | `"error"` |
| `category` | `"stripe.charge.failed"` |
| `title` | `"charge.failed: ch_3NzQKL2eZvKYlo2C0XVz4Y1s"` |
| `description` | `"Your card was declined. Network status: declined_by_network"` |
| `occurred_at` | `new Date(1748872200 * 1000)` |
| `tags` | `{"charge_id": "ch_3NzQKL2eZvKYlo2C0XVz4Y1s"}` |
| `payload` | full original JSON body (the raw Stripe webhook) |
| `tenant_id` | `"00000000-0000-0000-0000-000000000001"` |

### Stripe `charge.refunded` — deep assertions

POST `stripe-charge-refunded.json` to `http://localhost:3800/hook/stripe`.

| Field | Expected value |
|---|---|
| `source` | `"stripe"` |
| `severity` | `"info"` |
| `category` | `"stripe.charge.refunded"` |
| `title` | `"charge.refunded: ch_3NzQKL2eZvKYlo2C0Refund"` |
| `description` | `""` (no `failure_message` in fixture, template defaults to empty) |
| `occurred_at` | `new Date(1748875800 * 1000)` |
| `tags` | `{"charge_id": "ch_3NzQKL2eZvKYlo2C0Refund"}` |
| `payload` | full original JSON body |
| `tenant_id` | `"00000000-0000-0000-0000-000000000001"` |

### Stripe `payment_intent.succeeded` — deep assertions

POST `stripe-payment-intent-succeeded.json` to `http://localhost:3800/hook/stripe`.

| Field | Expected value |
|---|---|
| `source` | `"stripe"` |
| `severity` | `"info"` |
| `category` | `"stripe.payment_intent.succeeded"` |
| `title` | `"payment_intent.succeeded: pi_3NzQKL2eZvKYlo2C0PISucc"` |
| `description` | `""` (no `failure_message` in fixture) |
| `occurred_at` | `new Date(1748879400 * 1000)` |
| `tags` | `{"charge_id": "pi_3NzQKL2eZvKYlo2C0PISucc"}` |
| `payload` | full original JSON body |
| `tenant_id` | `"00000000-0000-0000-0000-000000000001"` |

### GitHub `workflow-run-failed` — shallow

POST to `http://localhost:3800/hook/github`. Assert:
- HTTP 200
- A row exists with `source = "github"`

No field-level assertions — confirms the pipeline handles a non-Stripe provider without error.

### PagerDuty `incident-triggered` — shallow

POST to `http://localhost:3800/hook/pagerduty`. Assert:
- HTTP 200
- A row exists with `source = "pagerduty"`

## Error Handling

- Non-200 from Relay → immediate assertion failure with full response body in the error message
- No DB row after a successful 200 → assertion failure includes `hook_id` for manual investigation
- No retries or polling — Relay writes synchronously, row is present immediately after the 200 response

## What This Suite Does Not Cover (Intentional)

- **Signature verification / auth** — covered by Relay's own Rust integration tests
- **Mapping failures** (e.g. missing `created` field) — Relay's territory
- **ExceptAlert API layer** — deferred; this is the B→C upgrade path once the pipeline contract is solid

## Running in Isolation

```bash
node --test tests/relay-pipeline.test.mjs
```
