# ExceptAlert v0.2 — Baselines & Slack Alerts

**Date:** 2026-06-03  
**Status:** Approved  
**Scope:** Count-based threshold alerting per event category, Slack delivery, baselines CRUD UI, global settings UI

---

## Overview

Users define per-category count thresholds ("alert if `stripe.charge.failed` exceeds 10 events in the last 60 minutes"). Evaluation piggybacks on the existing `GET /api/events` dashboard poll — no new background infrastructure. When a threshold is breached, ExceptAlert POSTs a message to a globally-configured Slack webhook URL. A per-baseline cooldown prevents alert spam.

---

## Data Model

### `baselines` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `category` | TEXT NOT NULL | e.g. `stripe.charge.failed` |
| `threshold` | INTEGER NOT NULL | Alert when event count exceeds this |
| `window_minutes` | INTEGER NOT NULL | Look-back window in minutes |
| `last_alerted_at` | TIMESTAMPTZ nullable | `null` = never alerted |
| `created_at` | TIMESTAMPTZ NOT NULL | `default now()` |

### `settings` table

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | e.g. `slack_webhook_url` |
| `value` | TEXT NOT NULL | The setting value |
| `updated_at` | TIMESTAMPTZ NOT NULL | `default now()` |

### Migrations

Two new SQL files applied manually via `psql`, following the existing pattern:

```sql
-- drizzle/migrations/0003_baselines_settings.sql
CREATE TABLE baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  window_minutes INTEGER NOT NULL,
  last_alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Evaluation Logic

Runs at the end of `GET /api/events`, after the events query. Does not affect the HTTP response — fire-and-forget from the request's perspective.

### Algorithm (per baseline)

1. Skip if `last_alerted_at > now() - window_minutes` (cooldown active)
2. `COUNT(*) FROM events WHERE category = ? AND received_at > now() - window_minutes`
3. If `count > threshold`:
   a. Fetch `slack_webhook_url` from `settings` (may be absent)
   b. If URL exists, POST Slack message
   c. If Slack delivery fails: log error, do NOT update `last_alerted_at` (retry next poll)
   d. If Slack delivery succeeds (or URL absent): `UPDATE baselines SET last_alerted_at = now()`

All baselines fetched in one query upfront. Each threshold check is one `COUNT` query.

### Slack message format

```
🚨 *ExceptAlert — Baseline breached*
*Category:* stripe.charge.failed
*Threshold:* 10 events / 60 min
*Actual:* 15 events in the last 60 min
```

Sent as `application/json` body: `{ "text": "..." }` (Slack incoming webhook format).

---

## New Library Files

### `src/lib/baselines.ts`

Exports `evaluateBaselines(db: DrizzleDB): Promise<void>`.

- Fetches all baselines
- For each non-cooling-down baseline: runs COUNT query, fires alert if breached
- Fetches Slack URL from settings (cached within the call — one query, not one per baseline)
- Calls `sendSlackAlert` if URL configured and threshold breached
- Updates `last_alerted_at` on success

### `src/lib/slack.ts`

Exports `sendSlackAlert(webhookUrl: string, message: string): Promise<void>`.

Thin wrapper around `fetch`. Throws on non-2xx so the caller can decide whether to update cooldown.

---

## API Routes

### `GET /api/baselines`
Returns `{ baselines: Baseline[] }`.

### `POST /api/baselines`
Body: `{ category, threshold, window_minutes }`. Returns created baseline.

### `PATCH /api/baselines/[id]`
Body: partial `{ category?, threshold?, window_minutes? }`. Returns updated baseline.

### `DELETE /api/baselines/[id]`
Returns `204`.

### `GET /api/settings`
Returns `{ slack_webhook_url: string | null }`.

### `PATCH /api/settings`
Body: `{ slack_webhook_url: string }`. Upserts the row. Returns updated value.

### `POST /api/settings/slack-test`
Sends a test message to the currently configured Slack webhook URL. Returns `{ ok: true }` or `{ error: string }`.

---

## UI

### Sidebar additions (`AppSidebar.tsx`)

Two new nav items added after Templates:
- `BarChart2` icon → `/dashboard/baselines` — label "Baselines"
- `Settings` icon → `/dashboard/settings` — label "Settings"

Active state rules follow the existing pattern (`pathname.startsWith(href)`).

### `/dashboard/baselines`

Table of existing baselines. Columns: Category, Threshold, Window, Last Alerted, Actions.

- **Last Alerted**: "Never" or relative timestamp (e.g. "2h ago")
- **Actions**: Edit button (opens dialog pre-populated), Delete button

"Add Baseline" button opens a dialog form:
- Category: text input (`stripe.charge.failed`)
- Threshold: number input (min 1)
- Window: select — 15 min / 30 min / 60 min / 6 hours (360) / 24 hours (1440)

Page component: `'use client'` (same pattern as templates page). Uses `GET/POST /api/baselines` and `PATCH/DELETE /api/baselines/[id]`.

### `/dashboard/settings`

Single card with a Slack webhook URL form:
- Full-width text input for the URL
- "Save" button — calls `PATCH /api/settings`
- "Send Test Message" button — calls `POST /api/settings/slack-test`, shows inline success/error

---

## Drizzle Schema additions (`src/lib/db/schema.ts`)

```ts
export const baselines = pgTable('baselines', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  threshold: integer('threshold').notNull(),
  windowMinutes: integer('window_minutes').notNull(),
  lastAlertedAt: timestamp('last_alerted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

---

## Out of Scope

- Severity filtering on baselines (future)
- Absence detection ("no events in N minutes")
- Per-baseline Slack URLs
- Alert history / audit log for fired alerts
- Retry backoff for failed Slack delivery
- Multiple notification channels (email, PagerDuty, etc.)
