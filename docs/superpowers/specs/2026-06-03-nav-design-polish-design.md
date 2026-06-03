# ExceptAlert v0.2 — Navigation & Design Polish

**Date:** 2026-06-03  
**Status:** Approved  
**Scope:** App shell, sidebar navigation, dark theme

---

## Overview

Add a persistent sidebar navigation and apply a dark design system across the app. No data layer changes. This is purely structural and visual — the goal is a coherent app shell that can grow as more sections (Baselines, Alerts) land in subsequent v0.2 tasks.

---

## Layout Structure

Root `layout.tsx` becomes a full-height flex row:

- **Sidebar** — 240px fixed width, never scrolls, `zinc-900` background, `zinc-800` right border
- **Content area** — `flex-1`, scrolls independently, `zinc-950` background

Each page controls its own internal padding (`px-6 py-6`) and width — no global max-width constraint at the layout level.

---

## Sidebar

Single new component: `src/components/AppSidebar.tsx`.

**Top section:**
- "ExceptAlert" wordmark — `text-sm font-semibold text-white`
- Subtitle "Event monitor" — `text-xs text-zinc-400`

**Nav items** (lucide-react icons):
- Events — `LayoutDashboard` icon → `/dashboard`
- Templates — `FileCode2` icon → `/dashboard/templates`

**Active state** (determined via `usePathname`):
- Text: `amber-500`
- Background: `amber-500/10` pill

**Inactive state:**
- Text: `zinc-400`
- Hover: `zinc-300` text, `zinc-800` background

---

## Color System

| Layer | Token |
|---|---|
| App / page background | `zinc-950` |
| Cards, panels, sidebar | `zinc-900` |
| Inputs, hover states, dividers | `zinc-800` |
| Primary text | `zinc-100` |
| Secondary / muted text | `zinc-400` |
| Active accent | `amber-500` |
| Accent background (subtle) | `amber-500/10` |

**Severity palette (unchanged):**

| Severity | Color |
|---|---|
| error | `red-500` |
| warning | `amber-500` |
| info | `blue-400` |
| unknown | `zinc-400` |

`globals.css` sets `background-color: theme(colors.zinc.950)` and `color: theme(colors.zinc.100)` on `html, body` — no per-page background class needed.

---

## Typography

Geist Sans (already in stack). Scale tightened:

- Page headings: `text-lg font-semibold text-zinc-100`
- Body / labels: `text-sm text-zinc-400`
- Mono values (IDs, timestamps): `font-mono text-xs text-zinc-400`

Page headings are section labels ("Events", "Templates") — the sidebar already carries app identity, so the inline "ExceptAlert" h1 in `DashboardClient` is removed.

---

## Component Changes

### `src/app/layout.tsx`
- Metadata title → "ExceptAlert"
- Body becomes `flex h-full`: `<AppSidebar />` + `<main className="flex-1 overflow-y-auto">{children}</main>`

### `src/components/AppSidebar.tsx` *(new)*
- `'use client'` — needs `usePathname`
- Renders wordmark, subtitle, nav items
- Active route detection: exact match for `/dashboard`, prefix match for `/dashboard/templates`

### `src/components/DashboardClient.tsx`
- Remove `h1` ("ExceptAlert") and subtitle ("Webhook event monitor")
- Replace with `<h1 className="text-lg font-semibold text-zinc-100">Events</h1>`
- Adjust layout padding to match content-area convention

### `src/app/dashboard/page.tsx`
- Remove `max-w-3xl` from `<main>` wrapper
- Padding: `px-6 py-6`

### `src/app/dashboard/templates/page.tsx`
- Remove any centering constraint from `<main>` wrapper
- Padding: `px-6 py-6`

### `src/app/dashboard/[eventId]/page.tsx`
- Add back-link (`<Link href="/dashboard">`) with `ChevronLeft` icon at top of page
- Padding: `px-6 py-6`

### `src/app/globals.css`
- Add `html, body { background-color: theme(colors.zinc.950); color: theme(colors.zinc.100); }`

### `src/app/page.tsx`
- Confirm it redirects to `/dashboard` (no change needed if already true)

---

## Out of Scope

- Collapsible sidebar (revisit when section count grows beyond ~5)
- Mobile/responsive layout
- Any data layer, API routes, Drizzle schema, or HITL logic
- FilterBar, EventTimeline, EventCard, HitlActionPanel internals
