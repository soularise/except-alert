# Baselines & Slack Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-category count thresholds that fire Slack alerts when breached, evaluated on every dashboard poll, with CRUD UI for baselines and a settings page for the Slack webhook URL.

**Architecture:** Evaluation piggybacks on `GET /api/events` — `evaluateBaselines()` is called fire-and-forget at the end of the handler. Two new DB tables (`baselines`, `settings`) owned by ExceptAlert. Slack delivery is a thin `fetch` wrapper; failed delivery skips cooldown update so the next poll retries. All UI pages follow the existing `'use client'` + fetch pattern from the templates page.

**Tech Stack:** Next.js App Router, Drizzle ORM + `postgres` npm package, Postgres 16, shadcn/ui, lucide-react

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `drizzle/migrations/0003_baselines_settings.sql` | DB migration for both new tables |
| Modify | `src/lib/db/schema.ts` | Add `baselines` and `settings` Drizzle table definitions |
| Create | `src/lib/slack.ts` | `sendSlackAlert(url, message)` — thin fetch wrapper |
| Create | `src/lib/baselines.ts` | `evaluateBaselines()` — fetch baselines, count events, fire Slack |
| Create | `src/app/api/baselines/route.ts` | `GET` + `POST /api/baselines` |
| Create | `src/app/api/baselines/[id]/route.ts` | `PATCH` + `DELETE /api/baselines/[id]` |
| Create | `src/app/api/settings/route.ts` | `GET` + `PATCH /api/settings` |
| Create | `src/app/api/settings/slack-test/route.ts` | `POST /api/settings/slack-test` |
| Modify | `src/app/api/events/route.ts` | Call `evaluateBaselines()` fire-and-forget at end of GET |
| Modify | `src/components/AppSidebar.tsx` | Add Baselines + Settings nav items; update `isActive` |
| Create | `src/app/dashboard/baselines/page.tsx` | Baselines CRUD UI |
| Create | `src/app/dashboard/settings/page.tsx` | Slack webhook URL settings UI |

---

## Task 1: Migration + Drizzle schema

**Files:**
- Create: `drizzle/migrations/0003_baselines_settings.sql`
- Modify: `src/lib/db/schema.ts`

No unit tests — verified by the API routes in later tasks compiling and querying successfully.

- [ ] **Step 1: Create the migration file**

Create `drizzle/migrations/0003_baselines_settings.sql`:

```sql
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

- [ ] **Step 2: Apply the migration**

```bash
docker exec -i except-alert-postgres-1 psql -U relay relay < drizzle/migrations/0003_baselines_settings.sql
```

Expected output:
```
CREATE TABLE
CREATE TABLE
```

- [ ] **Step 3: Add `integer` import and table definitions to `src/lib/db/schema.ts`**

Add `integer` to the existing import (line 1):

```ts
import {
  bigserial,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
```

Append to the bottom of the file (after the `actions` table):

```ts
export const baselines = pgTable('baselines', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  threshold: integer('threshold').notNull(),
  windowMinutes: integer('window_minutes').notNull(),
  lastAlertedAt: timestamptz('last_alerted_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add drizzle/migrations/0003_baselines_settings.sql src/lib/db/schema.ts
git commit -m "feat: add baselines and settings DB tables"
```

---

## Task 2: Slack library

**Files:**
- Create: `src/lib/slack.ts`

- [ ] **Step 1: Create `src/lib/slack.ts`**

```ts
export async function sendSlackAlert(webhookUrl: string, message: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  })
  if (!res.ok) {
    throw new Error(`Slack delivery failed: ${res.status} ${res.statusText}`)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/slack.ts
git commit -m "feat: add Slack webhook delivery helper"
```

---

## Task 3: Baselines evaluation library

**Files:**
- Create: `src/lib/baselines.ts`

Depends on Task 1 (schema) and Task 2 (slack.ts).

- [ ] **Step 1: Create `src/lib/baselines.ts`**

```ts
import { and, count, eq, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { baselines, events, settings } from '@/lib/db/schema'
import { sendSlackAlert } from '@/lib/slack'

export async function evaluateBaselines(): Promise<void> {
  const allBaselines = await db.select().from(baselines)
  if (allBaselines.length === 0) return

  const [slackSetting] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'slack_webhook_url'))
    .limit(1)
  const slackUrl = slackSetting?.value ?? null

  const now = new Date()

  for (const baseline of allBaselines) {
    if (baseline.lastAlertedAt) {
      const cooldownExpiry = new Date(
        baseline.lastAlertedAt.getTime() + baseline.windowMinutes * 60_000
      )
      if (now < cooldownExpiry) continue
    }

    const windowStart = new Date(now.getTime() - baseline.windowMinutes * 60_000)
    const [result] = await db
      .select({ value: count() })
      .from(events)
      .where(
        and(
          eq(events.category, baseline.category),
          gte(events.receivedAt, windowStart)
        )
      )

    const eventCount = result?.value ?? 0
    if (eventCount <= baseline.threshold) continue

    if (slackUrl) {
      const message = [
        '🚨 *ExceptAlert — Baseline breached*',
        `*Category:* ${baseline.category}`,
        `*Threshold:* ${baseline.threshold} events / ${baseline.windowMinutes} min`,
        `*Actual:* ${eventCount} events in the last ${baseline.windowMinutes} min`,
      ].join('\n')

      try {
        await sendSlackAlert(slackUrl, message)
      } catch (err) {
        console.error('[baselines] Slack delivery failed:', err)
        continue
      }
    }

    await db
      .update(baselines)
      .set({ lastAlertedAt: now })
      .where(eq(baselines.id, baseline.id))
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/baselines.ts
git commit -m "feat: add baseline evaluation logic"
```

---

## Task 4: Baselines API routes

**Files:**
- Create: `src/app/api/baselines/route.ts`
- Create: `src/app/api/baselines/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/baselines/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { baselines } from '@/lib/db/schema'

export async function GET() {
  try {
    const rows = await db.select().from(baselines).orderBy(desc(baselines.createdAt))
    return NextResponse.json({ baselines: rows })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { category, threshold, window_minutes } = body as {
    category?: unknown
    threshold?: unknown
    window_minutes?: unknown
  }

  if (typeof category !== 'string' || !category.trim()) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }
  if (typeof threshold !== 'number' || threshold < 1) {
    return NextResponse.json({ error: 'threshold must be a positive number' }, { status: 400 })
  }
  if (typeof window_minutes !== 'number' || window_minutes < 1) {
    return NextResponse.json({ error: 'window_minutes must be a positive number' }, { status: 400 })
  }

  try {
    const [created] = await db
      .insert(baselines)
      .values({ category, threshold, windowMinutes: window_minutes })
      .returning()
    return NextResponse.json({ baseline: created }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `src/app/api/baselines/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { baselines } from '@/lib/db/schema'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { category, threshold, window_minutes } = body as {
    category?: unknown
    threshold?: unknown
    window_minutes?: unknown
  }

  const updates: Record<string, unknown> = {}
  if (typeof category === 'string') updates.category = category
  if (typeof threshold === 'number' && threshold >= 1) updates.threshold = threshold
  if (typeof window_minutes === 'number' && window_minutes >= 1) updates.windowMinutes = window_minutes

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const [updated] = await db
      .update(baselines)
      .set(updates)
      .where(eq(baselines.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Baseline not found' }, { status: 404 })
    }

    return NextResponse.json({ baseline: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const [deleted] = await db
      .delete(baselines)
      .where(eq(baselines.id, id))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Baseline not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Smoke-test the routes with the dev server**

Start dev server:
```bash
DATABASE_URL=postgres://relay:relay@localhost:5432/relay npm run dev
```

Create a baseline:
```bash
curl -s -X POST http://localhost:3000/api/baselines \
  -H "Content-Type: application/json" \
  -d '{"category":"stripe.charge.failed","threshold":10,"window_minutes":60}' | jq .
```

Expected: `{"baseline": {"id": "...", "category": "stripe.charge.failed", ...}}`

List baselines:
```bash
curl -s http://localhost:3000/api/baselines | jq .
```

Expected: `{"baselines": [{"id": "...", ...}]}`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/baselines/
git commit -m "feat: add baselines CRUD API routes"
```

---

## Task 5: Settings API routes

**Files:**
- Create: `src/app/api/settings/route.ts`
- Create: `src/app/api/settings/slack-test/route.ts`

- [ ] **Step 1: Create `src/app/api/settings/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'

export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'slack_webhook_url'))
      .limit(1)
    return NextResponse.json({ slack_webhook_url: row?.value ?? null })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slack_webhook_url } = body as { slack_webhook_url?: unknown }

  if (typeof slack_webhook_url !== 'string' || !slack_webhook_url.trim()) {
    return NextResponse.json({ error: 'slack_webhook_url is required' }, { status: 400 })
  }

  try {
    await db
      .insert(settings)
      .values({ key: 'slack_webhook_url', value: slack_webhook_url })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: slack_webhook_url, updatedAt: new Date() },
      })
    return NextResponse.json({ slack_webhook_url })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `src/app/api/settings/slack-test/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { sendSlackAlert } from '@/lib/slack'

export async function POST() {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'slack_webhook_url'))
      .limit(1)

    if (!row?.value) {
      return NextResponse.json({ error: 'No Slack webhook URL configured' }, { status: 400 })
    }

    await sendSlackAlert(
      row.value,
      '✅ *ExceptAlert* — Test message. Slack alerts are working.'
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Smoke-test with dev server**

Save a Slack URL:
```bash
curl -s -X PATCH http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"slack_webhook_url":"https://hooks.slack.com/services/test"}' | jq .
```

Expected: `{"slack_webhook_url": "https://hooks.slack.com/services/test"}`

Fetch it back:
```bash
curl -s http://localhost:3000/api/settings | jq .
```

Expected: `{"slack_webhook_url": "https://hooks.slack.com/services/test"}`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/settings/
git commit -m "feat: add settings API routes and Slack test endpoint"
```

---

## Task 6: Wire evaluation into GET /api/events

**Files:**
- Modify: `src/app/api/events/route.ts`

- [ ] **Step 1: Add `evaluateBaselines` import and call to `src/app/api/events/route.ts`**

Add the import at the top of the file (after the existing imports):

```ts
import { evaluateBaselines } from '@/lib/baselines'
```

Add the fire-and-forget call inside the `GET` handler, immediately before the `return NextResponse.json(...)` line:

```ts
    evaluateBaselines().catch((err) =>
      console.error('[events] baseline evaluation error:', err)
    )

    return NextResponse.json({ events: responseEvents, nextCursor, recentCount })
```

The full updated file:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { and, eq, lt, gte, desc, count } from 'drizzle-orm'
import { evaluateBaselines } from '@/lib/baselines'

const VALID_SEVERITIES = new Set(['critical', 'error', 'warning', 'info'])
const VALID_STATUSES = new Set(['open', 'acknowledged', 'resolved', 'dismissed'])

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const source = searchParams.get('source')
  const severity = searchParams.get('severity')
  const category = searchParams.get('category')
  const status = searchParams.get('status')
  const cursor = searchParams.get('cursor')

  const rawLimit = searchParams.get('limit')
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 50
  const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 200)

  try {
    const conditions = []

    if (source) conditions.push(eq(events.source, source))
    if (severity && VALID_SEVERITIES.has(severity)) conditions.push(eq(events.severity, severity))
    if (category) conditions.push(eq(events.category, category))
    if (status && VALID_STATUSES.has(status)) conditions.push(eq(events.status, status))
    if (cursor) {
      const cursorDate = new Date(cursor)
      if (!isNaN(cursorDate.getTime())) {
        conditions.push(lt(events.receivedAt, cursorDate))
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db
      .select({
        id: events.id,
        hookId: events.hookId,
        source: events.source,
        severity: events.severity,
        title: events.title,
        description: events.description,
        category: events.category,
        tags: events.tags,
        receivedAt: events.receivedAt,
        occurredAt: events.occurredAt,
        status: events.status,
      })
      .from(events)
      .where(where)
      .orderBy(desc(events.receivedAt))
      .limit(limit + 1)

    let nextCursor: string | null = null
    if (rows.length > limit) {
      const last = rows.pop()!
      nextCursor = last.receivedAt.toISOString()
    }

    const sixtySecondsAgo = new Date(Date.now() - 60_000)
    const [recentResult] = await db
      .select({ value: count() })
      .from(events)
      .where(gte(events.receivedAt, sixtySecondsAgo))

    const recentCount = recentResult?.value ?? 0

    const responseEvents = rows.map((row) => ({
      ...row,
      receivedAt: row.receivedAt.toISOString(),
      occurredAt: row.occurredAt.toISOString(),
    }))

    evaluateBaselines().catch((err) =>
      console.error('[events] baseline evaluation error:', err)
    )

    return NextResponse.json({ events: responseEvents, nextCursor, recentCount })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/route.ts
git commit -m "feat: wire baseline evaluation into GET /api/events"
```

---

## Task 7: Sidebar additions

**Files:**
- Modify: `src/components/AppSidebar.tsx`

- [ ] **Step 1: Update `src/components/AppSidebar.tsx`**

Replace the entire file with:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileCode2, BarChart2, Settings } from 'lucide-react'

const navItems = [
  { label: 'Events', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Templates', href: '/dashboard/templates', icon: FileCode2 },
  { label: 'Baselines', href: '/dashboard/baselines', icon: BarChart2 },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') {
      return (
        pathname === '/dashboard' ||
        (pathname.startsWith('/dashboard/') &&
          !pathname.startsWith('/dashboard/templates') &&
          !pathname.startsWith('/dashboard/baselines') &&
          !pathname.startsWith('/dashboard/settings'))
      )
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-4 py-5">
        <p className="text-sm font-semibold text-sidebar-foreground">ExceptAlert</p>
        <p className="text-xs text-zinc-400">Event monitor</p>
      </div>

      <nav className="flex flex-col gap-1 px-2">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive(href)
                ? 'bg-amber-500/10 text-amber-500'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Verify TypeScript and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat: add Baselines and Settings to sidebar nav"
```

---

## Task 8: Baselines page UI

**Files:**
- Create: `src/app/dashboard/baselines/page.tsx`

- [ ] **Step 1: Create `src/app/dashboard/baselines/page.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const WINDOW_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
  { label: '6 hours', value: 360 },
  { label: '24 hours', value: 1440 },
]

interface Baseline {
  id: string
  category: string
  threshold: number
  windowMinutes: number
  lastAlertedAt: string | null
  createdAt: string
}

export default function BaselinesPage() {
  const [baselineList, setBaselineList] = useState<Baseline[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBaseline, setEditingBaseline] = useState<Baseline | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [category, setCategory] = useState('')
  const [threshold, setThreshold] = useState('')
  const [windowMinutes, setWindowMinutes] = useState('60')

  const fetchBaselines = useCallback(async () => {
    try {
      const res = await fetch('/api/baselines')
      const data = await res.json()
      setBaselineList(data.baselines ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBaselines()
  }, [fetchBaselines])

  function openAddDialog() {
    setEditingBaseline(null)
    setCategory('')
    setThreshold('')
    setWindowMinutes('60')
    setFormError(null)
    setDialogOpen(true)
  }

  function openEditDialog(baseline: Baseline) {
    setEditingBaseline(baseline)
    setCategory(baseline.category)
    setThreshold(String(baseline.threshold))
    setWindowMinutes(String(baseline.windowMinutes))
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const thresholdNum = parseInt(threshold, 10)
    if (!category.trim()) { setFormError('Category is required'); return }
    if (isNaN(thresholdNum) || thresholdNum < 1) { setFormError('Threshold must be a positive number'); return }

    setSubmitting(true)
    try {
      const url = editingBaseline ? `/api/baselines/${editingBaseline.id}` : '/api/baselines'
      const method = editingBaseline ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          threshold: thresholdNum,
          window_minutes: parseInt(windowMinutes, 10),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error ?? 'Something went wrong')
        return
      }
      setDialogOpen(false)
      await fetchBaselines()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(baseline: Baseline) {
    if (!window.confirm(`Delete baseline for "${baseline.category}"?`)) return
    await fetch(`/api/baselines/${baseline.id}`, { method: 'DELETE' })
    await fetchBaselines()
  }

  function formatLastAlerted(iso: string | null) {
    if (!iso) return 'Never'
    const diffMs = Date.now() - new Date(iso).getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return `${Math.floor(diffHr / 24)}d ago`
  }

  function windowLabel(minutes: number) {
    return WINDOW_OPTIONS.find((o) => o.value === minutes)?.label ?? `${minutes} min`
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Baselines</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alert when event counts exceed thresholds
          </p>
        </div>
        <Button onClick={openAddDialog}>Add Baseline</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : baselineList.length === 0 ? (
        <p className="text-sm text-muted-foreground">No baselines yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Last Alerted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {baselineList.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.category}</TableCell>
                <TableCell>{b.threshold} events</TableCell>
                <TableCell>{windowLabel(b.windowMinutes)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatLastAlerted(b.lastAlertedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(b)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(b)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBaseline ? 'Edit Baseline' : 'Add Baseline'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bl-category">Category</Label>
              <Input
                id="bl-category"
                placeholder="e.g. stripe.charge.failed"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bl-threshold">Threshold (events)</Label>
              <Input
                id="bl-threshold"
                type="number"
                min={1}
                placeholder="e.g. 10"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Window</Label>
              <Select value={windowMinutes} onValueChange={setWindowMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WINDOW_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingBaseline ? 'Save Changes' : 'Create Baseline'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Verify in browser (dev server)**

Visit `http://localhost:3000/dashboard/baselines`. Expected:
- Sidebar shows "Baselines" as active (amber)
- "Add Baseline" button opens dialog with Category, Threshold, Window fields
- Creating a baseline adds a row to the table
- Edit pre-populates the dialog
- Delete prompts confirm and removes the row

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/baselines/page.tsx
git commit -m "feat: add baselines CRUD page"
```

---

## Task 9: Settings page UI

**Files:**
- Create: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Create `src/app/dashboard/settings/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SettingsPage() {
  const [slackUrl, setSlackUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setSlackUrl(data.slack_webhook_url ?? ''))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMessage(null)
    setTestMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slack_webhook_url: slackUrl }),
      })
      setSaveMessage(res.ok ? 'Saved.' : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestMessage(null)
    try {
      const res = await fetch('/api/settings/slack-test', { method: 'POST' })
      const data = await res.json()
      setTestMessage(
        res.ok
          ? { ok: true, text: 'Test message sent.' }
          : { ok: false, text: data.error ?? 'Test failed.' }
      )
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-6">
      <h1 className="mb-6 text-lg font-semibold text-zinc-100">Settings</h1>
      <div className="max-w-lg space-y-4">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack-url">Slack webhook URL</Label>
            <Input
              id="slack-url"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing || !slackUrl.trim()}
              onClick={handleTest}
            >
              {testing ? 'Sending...' : 'Send Test Message'}
            </Button>
            {saveMessage && (
              <p className="text-sm text-muted-foreground">{saveMessage}</p>
            )}
          </div>
          {testMessage && (
            <p className={`text-sm ${testMessage.ok ? 'text-green-400' : 'text-destructive'}`}>
              {testMessage.text}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Verify in browser (dev server)**

Visit `http://localhost:3000/dashboard/settings`. Expected:
- Sidebar shows "Settings" as active (amber)
- Slack URL input loads existing value (or empty)
- Save updates the value; fetch again confirms persistence
- "Send Test Message" is disabled when URL field is empty
- With a real Slack webhook URL: clicking Send Test delivers a message to Slack

- [ ] **Step 4: Run lint one final time**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat: add settings page with Slack webhook URL and test button"
```
