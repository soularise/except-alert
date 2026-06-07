# Dashboard Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat dark dashboard with a professional two-palette design: dark navy/teal sidebar, white elevated main area, page header bar, dashboard summary tiles, severity-striped event cards, and grouped filter toolbar.

**Architecture:** CSS custom properties drive all theming — a `data-palette` attribute on `<html>` switches between Healthcare (navy/blue) and Monitoring (slate/teal) by overriding a small set of tokens. The `dark` class is removed from the root layout so the main content area renders light; the sidebar stays dark via its own `--sidebar-*` tokens.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, shadcn/ui, Tailwind CSS v4, lucide-react

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/app/layout.tsx` | Modify | Remove `dark` class; add anti-flash palette script |
| `src/app/globals.css` | Rewrite | Two-palette CSS variable system; drop old `.dark` block |
| `src/components/PaletteToggle.tsx` | Create | `'use client'` palette switcher with localStorage persistence |
| `src/components/AppSidebar.tsx` | Modify | Brand area, nav active styles, palette toggle in footer |
| `src/components/PageHeader.tsx` | Create | Shared `h-14` header bar with title, optional breadcrumb, action slot |
| `src/app/(app)/[slug]/dashboard/page.tsx` | Modify | Add COUNT queries; render `PageHeader`; pass counts to `DashboardClient` |
| `src/app/(app)/[slug]/dashboard/[eventId]/page.tsx` | Modify | Swap manual breadcrumb for `PageHeader` |
| `src/app/(app)/[slug]/templates/page.tsx` | Modify | Add `PageHeader` |
| `src/app/(app)/[slug]/baselines/page.tsx` | Modify | Add `PageHeader` |
| `src/app/(app)/[slug]/settings/page.tsx` | Modify | Add `PageHeader` |
| `src/components/DashboardClient.tsx` | Modify | Accept tile counts; render `SummaryTiles`; remove floating badge |
| `src/components/SummaryTiles.tsx` | Create | Three stat tiles: Open, Critical, Last 60s |
| `src/components/EventCard.tsx` | Modify | Left severity stripe; elevation; remove `SeverityBadge` from card body |
| `src/components/FilterBar.tsx` | Modify | Container wrap; search icon prefixes; active ring; clear button position |
| `src/lib/tenancy.ts` | Modify | Add `getServerTenantId(slug)` helper for server components |

---

## Task 1: CSS Palette System + Root Layout

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

The current app has `dark` hardcoded on `<html>`, making everything dark. We remove it and replace the CSS variable blocks with a palette system. The main content area becomes light; the sidebar stays dark via its own tokens.

- [ ] **Step 1: Rewrite `src/app/globals.css`**

Replace the entire file with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-geist-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

/* ── Healthcare palette (default) ──────────────────────────────────── */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.52 0.18 245);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.90 0.02 245);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.52 0.18 245);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.16 0.04 245);
  --sidebar-foreground: oklch(0.90 0 0);
  --sidebar-primary: oklch(0.52 0.18 245);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.22 0.035 245);
  --sidebar-accent-foreground: oklch(0.90 0 0);
  --sidebar-border: oklch(0.25 0.03 245);
  --sidebar-ring: oklch(0.52 0.18 245);
}

/* ── Monitoring palette override ───────────────────────────────────── */
html[data-palette="monitoring"] {
  --background: oklch(0.97 0.005 195);
  --border: oklch(0.88 0.015 195);
  --primary: oklch(0.55 0.10 195);
  --ring: oklch(0.55 0.10 195);
  --sidebar: oklch(0.14 0.02 195);
  --sidebar-primary: oklch(0.55 0.10 195);
  --sidebar-accent: oklch(0.20 0.015 195);
  --sidebar-border: oklch(0.22 0.02 195);
  --sidebar-ring: oklch(0.55 0.10 195);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 2: Update `src/app/layout.tsx`**

Remove `dark` from the `<html>` className and add the anti-flash palette script. Replace the entire file:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ExceptAlert',
  description: 'Webhook event monitor',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var p=localStorage.getItem('ea-palette');if(p==='monitoring')document.documentElement.dataset.palette='monitoring'}catch(e){}})()`,
        }} />
      </head>
      <body className="flex h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Start the dev server and verify the main content area is now white**

```bash
DATABASE_URL=postgres://relay:relay@localhost:5432/relay npm run dev
```

Navigate to `http://localhost:3000`. The app should redirect to login or dashboard. Confirm the main content area background is white, not dark. The sidebar will look broken until Task 3 — that's expected.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: replace dark-mode globals with two-palette CSS variable system"
```

---

## Task 2: PaletteToggle Component

**Files:**
- Create: `src/components/PaletteToggle.tsx`

A client component that renders two pill buttons in the sidebar footer, persisting the choice to `localStorage` and applying it by setting `document.documentElement.dataset.palette`.

- [ ] **Step 1: Create `src/components/PaletteToggle.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

type Palette = 'healthcare' | 'monitoring'

const STORAGE_KEY = 'ea-palette'

export function PaletteToggle() {
  const [palette, setPalette] = useState<Palette>('healthcare')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'monitoring') setPalette('monitoring')
  }, [])

  function apply(p: Palette) {
    setPalette(p)
    localStorage.setItem(STORAGE_KEY, p)
    if (p === 'healthcare') {
      delete document.documentElement.dataset.palette
    } else {
      document.documentElement.dataset.palette = p
    }
  }

  return (
    <div className="flex gap-1 px-3 pb-2">
      <button
        onClick={() => apply('healthcare')}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
          palette === 'healthcare'
            ? 'bg-primary/20 text-primary font-medium'
            : 'text-sidebar-foreground/50 hover:text-sidebar-foreground'
        }`}
      >
        <span className="size-2 rounded-full bg-blue-500" />
        Healthcare
      </button>
      <button
        onClick={() => apply('monitoring')}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
          palette === 'monitoring'
            ? 'bg-primary/20 text-primary font-medium'
            : 'text-sidebar-foreground/50 hover:text-sidebar-foreground'
        }`}
      >
        <span className="size-2 rounded-full bg-teal-500" />
        Monitoring
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PaletteToggle.tsx
git commit -m "feat: add PaletteToggle client component"
```

---

## Task 3: Sidebar Redesign

**Files:**
- Modify: `src/components/AppSidebar.tsx`

Replace the current flat sidebar with a structured layout: brand area with icon + divider, `NAVIGATION` section label, primary-colored active state, and palette toggle + sign-out in the footer.

- [ ] **Step 1: Rewrite `src/components/AppSidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FileCode2, BarChart2, Settings, LogOut, ShieldAlert } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Separator } from '@/components/ui/separator'
import { PaletteToggle } from '@/components/PaletteToggle'

interface AppSidebarProps {
  slug: string
  authDisabled?: boolean
}

export function AppSidebar({ slug, authDisabled = false }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/${slug}`

  const navItems = [
    { label: 'Events',    href: `${base}/dashboard`,  icon: LayoutDashboard },
    { label: 'Templates', href: `${base}/templates`,  icon: FileCode2 },
    { label: 'Baselines', href: `${base}/baselines`,  icon: BarChart2 },
    { label: 'Settings',  href: `${base}/settings`,   icon: Settings },
  ]

  function isActive(href: string) {
    if (href === `${base}/dashboard`) {
      return (
        pathname === href ||
        (pathname.startsWith(`${base}/dashboard/`) &&
          !pathname.includes('/templates') &&
          !pathname.includes('/baselines') &&
          !pathname.includes('/settings'))
      )
    }
    return pathname.startsWith(href)
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex w-60 flex-col bg-sidebar">
      {/* Brand */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary shrink-0" />
          <p className="font-semibold text-sidebar-foreground">ExceptAlert</p>
        </div>
        <p className="mt-0.5 text-xs text-sidebar-foreground/50 pl-7">Event monitor</p>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-2 pt-4">
        <p className="mb-1 px-3 text-xs font-medium uppercase tracking-widest text-sidebar-foreground/30">
          Navigation
        </p>
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive(href)
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto">
        <Separator className="bg-sidebar-border mb-3" />
        <PaletteToggle />
        {!authDisabled && (
          <div className="px-2 pb-4">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Check the dev server — sidebar should now show navy background, ShieldAlert icon, NAVIGATION label, and blue active state**

Active nav item should show a faint blue pill background with blue text. PaletteToggle shows in the footer. Sign out is below it.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat: redesign sidebar with brand area, nav labels, and palette toggle"
```

---

## Task 4: PageHeader Component

**Files:**
- Create: `src/components/PageHeader.tsx`

Shared `h-14` header bar rendered at the top of each page's content area.

- [ ] **Step 1: Create `src/components/PageHeader.tsx`**

```tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  breadcrumb?: { label: string; href: string }
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, breadcrumb, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6',
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {breadcrumb && (
          <>
            <Link
              href={breadcrumb.href}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {breadcrumb.label}
            </Link>
            <span className="text-muted-foreground shrink-0">/</span>
          </>
        )}
        <h1 className="font-semibold text-foreground truncate">{title}</h1>
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PageHeader.tsx
git commit -m "feat: add PageHeader shared component"
```

---

## Task 5: Wire PageHeader into All Pages

**Files:**
- Modify: `src/app/(app)/[slug]/dashboard/page.tsx`
- Modify: `src/app/(app)/[slug]/dashboard/[eventId]/page.tsx`
- Modify: `src/app/(app)/[slug]/templates/page.tsx`
- Modify: `src/app/(app)/[slug]/baselines/page.tsx`
- Modify: `src/app/(app)/[slug]/settings/page.tsx`

Note: `dashboard/page.tsx` will be updated again in Task 7 for the COUNT queries. This task only adds the header.

- [ ] **Step 1: Update `src/app/(app)/[slug]/dashboard/page.tsx`**

```tsx
import { DashboardClient } from '@/components/DashboardClient'
import { PageHeader } from '@/components/PageHeader'

interface DashboardPageProps {
  searchParams: Promise<{
    source?: string
    severity?: string
    category?: string
    status?: string
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const filters = {
    source:   params.source,
    severity: params.severity,
    category: params.category,
    status:   params.status,
  }
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Events" />
      <div className="px-6 py-6">
        <DashboardClient initialFilters={filters} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/app/(app)/[slug]/dashboard/[eventId]/page.tsx`**

Replace the manual back-link with `PageHeader` breadcrumb:

```tsx
import { EventDetail } from '@/components/EventDetail'
import { PageHeader } from '@/components/PageHeader'

interface EventDetailPageProps {
  params: Promise<{ slug: string; eventId: string }>
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { slug, eventId } = await params
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Event Detail"
        breadcrumb={{ label: 'Events', href: `/${slug}/dashboard` }}
      />
      <div className="px-6 py-6">
        <EventDetail eventId={eventId} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `src/app/(app)/[slug]/templates/page.tsx`**

Two edits — add the import and wrap the return. The Dialog and all other content stay exactly as-is.

Add import at line 1 (alongside other imports):
```tsx
import { PageHeader } from '@/components/PageHeader'
```

Change the opening of the return statement (currently line 183–184):
```tsx
// BEFORE:
  return (
    <div className="px-6 py-6">

// AFTER:
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Templates" />
      <div className="px-6 py-6">
```

Add one closing `</div>` before the final `</div>` at the very end of the return (to close the new outer wrapper):
```tsx
      </div>  {/* closes px-6 py-6 */}
    </div>    {/* closes flex flex-col h-full */}
  )
```

- [ ] **Step 4: Update `src/app/(app)/[slug]/baselines/page.tsx`**

Same two-edit pattern. Add the import:
```tsx
import { PageHeader } from '@/components/PageHeader'
```

Change line 149 (the opening of the return):
```tsx
// BEFORE:
  return (
    <div className="px-6 py-6">

// AFTER:
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Baselines" />
      <div className="px-6 py-6">
```

Also fix the hardcoded `text-zinc-100` on the `<h1>` at line 153:
```tsx
// BEFORE:
          <h1 className="text-lg font-semibold text-zinc-100">Baselines</h1>
// AFTER:
          <h1 className="text-lg font-semibold text-foreground">Baselines</h1>
```

Add one closing `</div>` before the final `</div>` to close the outer wrapper.

- [ ] **Step 5: Update `src/app/(app)/[slug]/settings/page.tsx`**

This file has two `return` statements (loading state + main). Add `PageHeader` to both. Also update the hardcoded `text-zinc-100` on the h1 to `text-foreground`, and the `text-amber-500` on the "Manage team" link to `text-primary`.

```tsx
// Add this import at the top with the other imports:
import { PageHeader } from '@/components/PageHeader'

// Replace the early-return loading block (lines 60-65):
  if (loading) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="px-6 py-6">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </>
    )
  }

// Replace the main return block (lines 68-120):
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Settings" />
      <div className="px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
          {canManageSettings && (
            <Link href={`/${tenant.slug}/settings/team`} className="text-sm text-primary hover:underline">
              Manage team
            </Link>
          )}
        </div>
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
                disabled={!canManageSettings}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving || !canManageSettings}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={testing || !slackUrl.trim() || !canManageSettings}
                onClick={handleTest}
              >
                {testing ? 'Sending...' : 'Send Test Message'}
              </Button>
              {saveMessage && (
                <p className="text-sm text-muted-foreground">{saveMessage}</p>
              )}
            </div>
            {testMessage && (
              <p className={`text-sm ${testMessage.ok ? 'text-green-600' : 'text-destructive'}`}>
                {testMessage.text}
              </p>
            )}
            {!canManageSettings && (
              <p className="text-sm text-muted-foreground">
                Ask an admin or owner to change Slack settings.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 6: Verify in the browser**

All five pages should show the `h-14` header bar with title and a bottom border. The Event Detail page should show `← Events / Event Detail`.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/\[slug\]/dashboard/page.tsx \
        src/app/\(app\)/\[slug\]/dashboard/\[eventId\]/page.tsx \
        src/app/\(app\)/\[slug\]/templates/page.tsx \
        src/app/\(app\)/\[slug\]/baselines/page.tsx \
        src/app/\(app\)/\[slug\]/settings/page.tsx
git commit -m "feat: add PageHeader to all app pages"
```

---

## Task 6: SummaryTiles Component

**Files:**
- Create: `src/components/SummaryTiles.tsx`

Three stat tiles: Open Events (primary stripe), Critical (red stripe), Last 60s (amber stripe).

- [ ] **Step 1: Create `src/components/SummaryTiles.tsx`**

```tsx
interface SummaryTilesProps {
  openCount: number
  criticalCount: number
  recentCount: number
}

export function SummaryTiles({ openCount, criticalCount, recentCount }: SummaryTilesProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-xl border border-border/50 border-l-4 border-l-primary bg-card shadow-sm p-4">
        <p className="text-3xl font-bold text-foreground">{openCount}</p>
        <p className="text-sm text-muted-foreground mt-1">Open Events</p>
      </div>
      <div className="rounded-xl border border-border/50 border-l-4 border-l-red-600 bg-card shadow-sm p-4">
        <p className={`text-3xl font-bold ${criticalCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
          {criticalCount}
        </p>
        <p className="text-sm text-muted-foreground mt-1">Critical</p>
      </div>
      <div className="rounded-xl border border-border/50 border-l-4 border-l-amber-500 bg-card shadow-sm p-4">
        <p className="text-3xl font-bold text-foreground">{recentCount}</p>
        <p className="text-sm text-muted-foreground mt-1">Last 60s</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SummaryTiles.tsx
git commit -m "feat: add SummaryTiles component"
```

---

## Task 7: Dashboard COUNT Queries + DashboardClient Update

**Files:**
- Modify: `src/lib/tenancy.ts`
- Modify: `src/app/(app)/[slug]/dashboard/page.tsx`
- Modify: `src/components/DashboardClient.tsx`

Add a `getServerTenantId` helper, run two COUNT queries server-side, and update `DashboardClient` to consume them and render `SummaryTiles`.

- [ ] **Step 1: Add `getServerTenantId` to `src/lib/tenancy.ts`**

The current file imports `{ and, eq }` from `'drizzle-orm'` and has `DEFAULT_TENANT_ID`, `getTenantMembership`, `db`, and the schema already available. Add two new imports at the top and append the helper at the bottom of the file:

```ts
// Add to existing imports at the top of the file:
import { headers } from 'next/headers'
import { auth } from './auth'
```

```ts
// Append at the bottom of the file:
export async function getServerTenantId(slug: string): Promise<string | null> {
  if (process.env.EXCEPTALERT_AUTH_DISABLED === 'true') {
    return DEFAULT_TENANT_ID
  }
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  const membership = await getTenantMembership(slug, session.user.id)
  return membership?.tenant.id ?? null
}
```

- [ ] **Step 2: Update `src/app/(app)/[slug]/dashboard/page.tsx`** with COUNT queries

Replace the entire file:

```tsx
import { count, eq, and, inArray, not } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events } from '@/lib/db/schema'
import { getServerTenantId } from '@/lib/tenancy'
import { DashboardClient } from '@/components/DashboardClient'
import { PageHeader } from '@/components/PageHeader'

interface DashboardPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    source?: string
    severity?: string
    category?: string
    status?: string
  }>
}

async function getEventCounts(tenantId: string) {
  const [openResult] = await db
    .select({ value: count() })
    .from(events)
    .where(and(eq(events.tenantId, tenantId), eq(events.status, 'open')))

  const [criticalResult] = await db
    .select({ value: count() })
    .from(events)
    .where(and(
      eq(events.tenantId, tenantId),
      eq(events.severity, 'critical'),
      not(inArray(events.status, ['resolved', 'dismissed']))
    ))

  return {
    openCount: openResult?.value ?? 0,
    criticalCount: criticalResult?.value ?? 0,
  }
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { slug } = await params
  const raw = await searchParams
  const filters = {
    source:   raw.source,
    severity: raw.severity,
    category: raw.category,
    status:   raw.status,
  }

  const tenantId = await getServerTenantId(slug)
  const { openCount, criticalCount } = tenantId
    ? await getEventCounts(tenantId)
    : { openCount: 0, criticalCount: 0 }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Events" />
      <div className="px-6 py-6">
        <DashboardClient
          initialFilters={filters}
          openCount={openCount}
          criticalCount={criticalCount}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `src/components/DashboardClient.tsx`**

Replace the entire file:

```tsx
'use client'

import { useState } from 'react'
import { FilterBar, type Filters } from '@/components/FilterBar'
import { EventTimeline } from '@/components/EventTimeline'
import { SummaryTiles } from '@/components/SummaryTiles'

interface DashboardClientProps {
  initialFilters: Filters
  openCount: number
  criticalCount: number
}

export function DashboardClient({ initialFilters, openCount, criticalCount }: DashboardClientProps) {
  const [recentCount, setRecentCount] = useState<number>(0)

  return (
    <div className="flex flex-col gap-6">
      <SummaryTiles
        openCount={openCount}
        criticalCount={criticalCount}
        recentCount={recentCount}
      />
      <FilterBar filters={initialFilters} />
      <EventTimeline filters={initialFilters} onRecentCount={setRecentCount} />
    </div>
  )
}
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify in the browser**

Dashboard should show three tiles at the top: "Open Events", "Critical", "Last 60s". The critical tile number turns red if count > 0. The floating badge is gone.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tenancy.ts \
        src/app/\(app\)/\[slug\]/dashboard/page.tsx \
        src/components/DashboardClient.tsx
git commit -m "feat: add dashboard summary tiles with server-side event counts"
```

---

## Task 8: EventCard Redesign

**Files:**
- Modify: `src/components/EventCard.tsx`

Add a left severity stripe via `border-l-4`, elevation via `shadow-sm`, and remove `SeverityBadge` from the card body. The `SeverityBadge` component itself is not deleted — it's still used on the event detail page.

- [ ] **Step 1: Rewrite `src/components/EventCard.tsx`**

```tsx
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'

export interface Event {
  id: string
  hookId: string
  source: string
  severity: string
  title: string
  description: string | null
  category: string
  tags: unknown
  receivedAt: string
  occurredAt: string
  status: string | null
}

const severityStripe: Record<string, string> = {
  critical: 'border-l-red-600',
  error:    'border-l-orange-500',
  warning:  'border-l-yellow-500',
  info:     'border-l-blue-500',
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return diffSec <= 1 ? 'just now' : `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

export function EventCard({ event, slug }: { event: Event; slug: string }) {
  const stripe = severityStripe[event.severity] ?? 'border-l-border'

  return (
    <Link
      href={`/${slug}/dashboard/${event.id}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card
        className={cn(
          'border-l-4 border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer',
          stripe
        )}
      >
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-snug">{event.title}</p>
            <StatusBadge status={event.status ?? 'open'} />
          </div>
          {event.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-muted-foreground/60" />
              {event.source}
            </span>
            <span>{event.category}</span>
            <span className="ml-auto">{formatRelativeTime(event.receivedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Verify in the browser**

The event list should show cards with a colored left stripe. Critical events show a red stripe, errors orange, warnings yellow, info blue. Cards have a subtle shadow that deepens on hover. The severity badge is no longer shown inside the card body.

- [ ] **Step 3: Commit**

```bash
git add src/components/EventCard.tsx
git commit -m "feat: add severity stripe and elevation to EventCard"
```

---

## Task 9: FilterBar Redesign

**Files:**
- Modify: `src/components/FilterBar.tsx`

Wrap all controls in a toolbar container, add search icon prefixes to text inputs, apply a primary ring on active filters, and move "Clear filters" to the far right with a separator.

- [ ] **Step 1: Rewrite `src/components/FilterBar.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export interface Filters {
  source?: string
  severity?: string
  category?: string
  status?: string
}

interface FilterBarProps {
  filters: Filters
}

export function FilterBar({ filters }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  function clearFilters() {
    router.push('?')
  }

  const hasFilters = !!(filters.source || filters.severity || filters.category || filters.status)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Source"
          defaultValue={filters.source ?? ''}
          className={`w-36 pl-8 ${filters.source ? 'ring-1 ring-primary/40' : ''}`}
          onChange={(e) => updateParam('source', e.target.value)}
        />
      </div>

      <Select
        value={filters.severity ?? ''}
        onValueChange={(val) => updateParam('severity', !val || val === 'all' ? '' : val)}
      >
        <SelectTrigger className={`w-36 ${filters.severity ? 'ring-1 ring-primary/40' : ''}`}>
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All severities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="info">Info</SelectItem>
        </SelectContent>
      </Select>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Category"
          defaultValue={filters.category ?? ''}
          className={`w-36 pl-8 ${filters.category ? 'ring-1 ring-primary/40' : ''}`}
          onChange={(e) => updateParam('category', e.target.value)}
        />
      </div>

      <Select
        value={filters.status ?? ''}
        onValueChange={(val) => updateParam('status', !val || val === 'all' ? '' : val)}
      >
        <SelectTrigger className={`w-40 ${filters.status ? 'ring-1 ring-primary/40' : ''}`}>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="acknowledged">Acknowledged</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="dismissed">Dismissed</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in the browser**

The filter controls should appear inside a rounded toolbar container with a muted background. Source and Category inputs show a search icon on the left. When a filter is active, the control gets a faint primary-colored ring. The "Clear filters" button is separated by a vertical line and sits at the far right.

- [ ] **Step 3: Run a final full check**

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/FilterBar.tsx
git commit -m "feat: redesign FilterBar with toolbar container and search icons"
```

---

## Task 10: Final Visual Verification

- [ ] **Step 1: Run the full stack**

```bash
docker compose up -d --build
```

Or for local dev:

```bash
DATABASE_URL=postgres://relay:relay@localhost:5432/relay npm run dev
```

- [ ] **Step 2: Verify the full design**

Check each item:

- [ ] Sidebar background is deep navy (healthcare) or dark teal (monitoring)
- [ ] `ShieldAlert` icon appears in the sidebar brand area
- [ ] `NAVIGATION` label appears above nav items
- [ ] Active nav item has a faint blue/teal pill background
- [ ] PaletteToggle is visible in the sidebar footer with `Healthcare` and `Monitoring` pills
- [ ] Clicking `Monitoring` switches colors — sidebar shifts to dark teal, primary accent shifts to teal
- [ ] Palette preference persists across page refresh (localStorage)
- [ ] All five pages show the `h-14` page header bar with correct titles
- [ ] Event Detail page shows `← Events / Event Detail` breadcrumb
- [ ] Dashboard shows three summary tiles (Open Events, Critical, Last 60s)
- [ ] Critical tile number is red when count > 0
- [ ] Event cards show a colored left stripe matching severity
- [ ] Hovering an event card shows a deeper shadow
- [ ] Severity badge is not shown on the card body (only status badge)
- [ ] FilterBar controls appear inside a rounded muted-background container
- [ ] Source and Category inputs have a search icon on the left
- [ ] Setting a filter adds a faint primary-colored ring to that control
- [ ] Clear filters button appears with a separator only when filters are active
