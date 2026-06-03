# Navigation & Design Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent dark sidebar with amber accent, replace the bare layout with a full app shell, and apply a zinc-based dark theme across all three pages.

**Architecture:** Force dark mode via a `dark` class on `<html>`, override the shadcn CSS variables in `.dark` to match the zinc+amber palette, and add a single new `AppSidebar` component used in `layout.tsx`. All data/API/HITL code is untouched.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, shadcn/ui, lucide-react (already installed)

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/app/globals.css` | Update `.dark` CSS variables: darker background, amber primary, force dark on body |
| Modify | `src/app/layout.tsx` | Add `dark` class to `<html>`, render `AppSidebar` + content wrapper, fix metadata title |
| Create | `src/components/AppSidebar.tsx` | Sidebar with wordmark, Events + Templates nav items, active state via `usePathname` |
| Modify | `src/components/DashboardClient.tsx` | Remove inline app title/subtitle, replace with "Events" page heading |
| Modify | `src/app/dashboard/page.tsx` | Remove `max-w-3xl`, use `px-6 py-6` padding |
| Modify | `src/app/dashboard/templates/page.tsx` | Remove `max-w-5xl`, use `px-6 py-6` padding |
| Modify | `src/app/dashboard/[eventId]/page.tsx` | Add back-link to `/dashboard`, use `px-6 py-6` padding |

---

## Task 1: Dark theme CSS variables

**Files:**
- Modify: `src/app/globals.css`

No unit tests — verification is visual (dev server).

- [ ] **Step 1: Update the `.dark` block in `globals.css`**

Replace the entire `.dark { ... }` block (lines 86–118) with:

```css
.dark {
  --background: oklch(0.07 0 0);
  --foreground: oklch(0.94 0 0);
  --card: oklch(0.13 0 0);
  --card-foreground: oklch(0.94 0 0);
  --popover: oklch(0.13 0 0);
  --popover-foreground: oklch(0.94 0 0);
  --primary: oklch(0.769 0.188 70.08);
  --primary-foreground: oklch(0.07 0 0);
  --secondary: oklch(0.20 0 0);
  --secondary-foreground: oklch(0.94 0 0);
  --muted: oklch(0.20 0 0);
  --muted-foreground: oklch(0.60 0 0);
  --accent: oklch(0.20 0 0);
  --accent-foreground: oklch(0.94 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 8%);
  --input: oklch(1 0 0 / 12%);
  --ring: oklch(0.769 0.188 70.08);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.13 0 0);
  --sidebar-foreground: oklch(0.94 0 0);
  --sidebar-primary: oklch(0.769 0.188 70.08);
  --sidebar-primary-foreground: oklch(0.07 0 0);
  --sidebar-accent: oklch(0.20 0 0);
  --sidebar-accent-foreground: oklch(0.94 0 0);
  --sidebar-border: oklch(1 0 0 / 8%);
  --sidebar-ring: oklch(0.769 0.188 70.08);
}
```

Key changes from the default: `--background` is now near-black (zinc-950 level), `--card` is slightly lighter (zinc-900 level), `--primary` and `--ring` are now amber-500.

- [ ] **Step 2: Start the dev server and confirm it still compiles**

```bash
DATABASE_URL=postgres://relay:relay@localhost:5432/relay npm run dev
```

Expected: compiles without errors. The app will still look light because `dark` class isn't on `<html>` yet — that's fine, that's Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update dark CSS variables — zinc base, amber primary"
```

---

## Task 2: App shell layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `layout.tsx` entirely**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/AppSidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExceptAlert",
  description: "Webhook event monitor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex h-full bg-background text-foreground">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
```

Note: `AppSidebar` doesn't exist yet — the app will fail to compile until Task 3 is done. That's expected.

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add app shell layout with sidebar slot"
```

---

## Task 3: AppSidebar component

**Files:**
- Create: `src/components/AppSidebar.tsx`

- [ ] **Step 1: Create `src/components/AppSidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileCode2 } from 'lucide-react'

const navItems = [
  { label: 'Events', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Templates', href: '/dashboard/templates', icon: FileCode2 },
]

export function AppSidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/') && !pathname.startsWith('/dashboard/templates')
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex w-60 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="px-4 py-5">
        <p className="text-sm font-semibold text-white">ExceptAlert</p>
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

- [ ] **Step 2: Start dev server and verify the sidebar renders**

```bash
DATABASE_URL=postgres://relay:relay@localhost:5432/relay npm run dev
```

Visit `http://localhost:3000`. Expected:
- Dark background visible
- Sidebar on the left: "ExceptAlert" wordmark, "Event monitor" subtitle, "Events" and "Templates" nav links
- "Events" is active (amber) when on `/dashboard`
- "Templates" is active (amber) when on `/dashboard/templates`
- Clicking between nav items changes active state

- [ ] **Step 3: Commit**

```bash
git add src/components/AppSidebar.tsx
git commit -m "feat: add AppSidebar with Events and Templates nav"
```

---

## Task 4: Update DashboardClient heading

**Files:**
- Modify: `src/components/DashboardClient.tsx`

- [ ] **Step 1: Remove the app title block, replace with page heading**

Replace lines 17–26 (the `<div>` containing the h1 and subtitle) with a simple page heading:

```tsx
// Replace this block:
<div>
  <h1 className="text-2xl font-semibold tracking-tight">ExceptAlert</h1>
  <p className="text-sm text-muted-foreground">Webhook event monitor</p>
</div>

// With:
<h1 className="text-lg font-semibold text-zinc-100">Events</h1>
```

The full updated return block:

```tsx
return (
  <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-lg font-semibold text-zinc-100">Events</h1>
      {recentCount > 0 && (
        <Badge className="bg-blue-500 text-white border-transparent">
          {recentCount} event{recentCount !== 1 ? 's' : ''} in last 60s
        </Badge>
      )}
    </div>

    <FilterBar filters={initialFilters} />

    <EventTimeline filters={initialFilters} onRecentCount={setRecentCount} />
  </div>
)
```

- [ ] **Step 2: Verify heading in browser**

Visit `http://localhost:3000/dashboard`. Expected: page shows "Events" as the heading (not "ExceptAlert"), sidebar is visible on the left.

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardClient.tsx
git commit -m "feat: replace dashboard app title with Events page heading"
```

---

## Task 5: Update page wrappers

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/templates/page.tsx`
- Modify: `src/app/dashboard/[eventId]/page.tsx`

- [ ] **Step 1: Update `src/app/dashboard/page.tsx`**

Replace:
```tsx
<main className="mx-auto w-full max-w-3xl px-4 py-8">
  <DashboardClient initialFilters={filters} />
</main>
```

With:
```tsx
<div className="px-6 py-6">
  <DashboardClient initialFilters={filters} />
</div>
```

The full file:
```tsx
import { DashboardClient } from '@/components/DashboardClient'

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
    source: params.source,
    severity: params.severity,
    category: params.category,
    status: params.status,
  }

  return (
    <div className="px-6 py-6">
      <DashboardClient initialFilters={filters} />
    </div>
  )
}
```

- [ ] **Step 2: Update `src/app/dashboard/templates/page.tsx`**

Replace the opening `<main>` tag and its closing tag:

```tsx
// Replace:
<main className="mx-auto w-full max-w-5xl px-4 py-8">
// With:
<div className="px-6 py-6">
```

And close with `</div>` instead of `</main>`. The `<main>` is no longer appropriate here since `layout.tsx` already provides `<main>`.

- [ ] **Step 3: Update `src/app/dashboard/[eventId]/page.tsx`**

Replace:
```tsx
import { EventDetail } from '@/components/EventDetail'

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params
  return <EventDetail eventId={eventId} />
}
```

With:
```tsx
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { EventDetail } from '@/components/EventDetail'

interface EventDetailPageProps {
  params: Promise<{ eventId: string }>
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params
  return (
    <div className="px-6 py-6">
      <Link
        href="/dashboard"
        className="mb-4 flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-300 transition-colors w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Events
      </Link>
      <EventDetail eventId={eventId} />
    </div>
  )
}
```

- [ ] **Step 4: Verify all three pages in the browser**

With the dev server running:
1. `/dashboard` — sidebar visible, content fills the area without an off-center max-width
2. `/dashboard/templates` — same shell, Templates nav item is amber
3. Click any event → event detail page loads with a "← Events" back link at top
4. Click "← Events" → navigates back to `/dashboard`

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/templates/page.tsx src/app/dashboard/[eventId]/page.tsx
git commit -m "feat: update page wrappers — remove max-width, add back-link to event detail"
```
