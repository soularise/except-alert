# ExceptAlert Dashboard Visual Redesign

**Date:** 2026-06-07  
**Scope:** Option B — Layout + Theme + Dashboard Tiles across all five app pages

---

## Overview

Replace the current flat, unstyled dashboard with a design that feels like a real product: dark navy/teal sidebar, white elevated main content area, page header bar, dashboard summary tiles, severity-striped event cards, and grouped filter toolbar. A two-palette toggle (Healthcare blue / Monitoring teal) enables industry-specific demos without code changes.

---

## 1. Color System & Palettes

### Mechanism

`globals.css` defines all token values inside two `[data-palette="..."]` selectors on `:root`. A default palette (healthcare) applies when no attribute is set. JavaScript sets `document.documentElement.dataset.palette` and persists to `localStorage` on toggle. No Tailwind config changes required.

### Healthcare palette (default)

| Token | Value | Role |
|---|---|---|
| `--sidebar` | `oklch(0.16 0.04 245)` | Deep navy sidebar background |
| `--sidebar-foreground` | `oklch(0.90 0 0)` | Sidebar text |
| `--sidebar-border` | `oklch(0.25 0.03 245)` | Sidebar dividers |
| `--primary` | `oklch(0.52 0.18 245)` | Blue accent — active states, stripes, rings |
| `--primary-foreground` | `oklch(1 0 0)` | Text on primary backgrounds |
| `--background` | `oklch(1 0 0)` | Main content area |
| `--card` | `oklch(1 0 0)` | Card surface |
| `--border` | `oklch(0.90 0.02 245)` | Faint blue-gray borders |

### Monitoring palette

| Token | Value | Role |
|---|---|---|
| `--sidebar` | `oklch(0.14 0.02 195)` | Very dark slate with cyan hint |
| `--sidebar-foreground` | `oklch(0.90 0 0)` | Sidebar text |
| `--sidebar-border` | `oklch(0.22 0.02 195)` | Sidebar dividers |
| `--primary` | `oklch(0.55 0.10 195)` | Desaturated teal accent |
| `--primary-foreground` | `oklch(1 0 0)` | Text on primary backgrounds |
| `--background` | `oklch(0.97 0.005 195)` | Near-white with cool tint |
| `--card` | `oklch(1 0 0)` | Card surface |
| `--border` | `oklch(0.88 0.015 195)` | Faint teal-gray borders |

### Severity colors (palette-invariant)

These never change between palettes — they carry semantic meaning.

| Severity | Color |
|---|---|
| critical | `red-600` |
| error | `orange-500` |
| warning | `yellow-500` |
| info | `blue-500` |

---

## 2. Sidebar Redesign

**File:** `src/components/AppSidebar.tsx`

### Brand area
- `ShieldAlert` icon (lucide-react) + "ExceptAlert" in `font-semibold` on same line
- Tenant name / "Event monitor" subtitle below in small muted text
- `Separator` divider below the brand block

### Nav items
- Section label: `NAVIGATION` in `text-xs uppercase tracking-widest` muted text above the nav group
- Active state: `bg-primary/10 text-primary` pill — replaces the current amber treatment
- Inactive: `text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground`
- Icon and label color both follow the active/inactive state

### Sidebar footer
- Palette toggle: two small pill buttons (`Healthcare` | `Monitoring`) with a colored dot each
  - Active palette button: `bg-primary/20 text-primary font-medium`
  - Inactive: `text-sidebar-foreground/50 hover:text-sidebar-foreground`
- `PaletteToggle` is a `'use client'` component — reads/writes `localStorage` and sets `document.documentElement.dataset.palette`
- Sign out button below, unchanged in function

---

## 3. Page Header Bar

**New file:** `src/components/PageHeader.tsx`

A consistent `h-14` header rendered at the top of each page's content, inside `<main>` but above the page-specific content.

```
Props:
  title: string
  breadcrumb?: { label: string; href: string }  // shown as "← label / title"
  action?: React.ReactNode                        // right-side slot
```

- `border-b border-border bg-background` — sits flush with the top of main
- Title: `font-semibold text-foreground` left-aligned, vertically centered
- Breadcrumb: back-arrow + link + `/` separator + current title, for event detail page
- Action slot: right-aligned, used for the live-event badge on the Events page

### Per-page usage

| Page | Title | Breadcrumb | Action slot |
|---|---|---|---|
| Events | "Events" | — | — (last-60s count shown in summary tile) |
| Event Detail | event title (truncated) | "← Events" | — |
| Templates | "Templates" | — | — |
| Baselines | "Baselines" | — | — |
| Settings | "Settings" | — | — |

---

## 4. Dashboard Summary Tiles

**Files:** `src/app/(app)/[slug]/dashboard/page.tsx`, `src/components/DashboardClient.tsx`  
**New component:** `src/components/SummaryTiles.tsx`

### Tiles

| Tile | Query | Accent |
|---|---|---|
| Open Events | `COUNT WHERE status = 'open'` | Primary (blue/teal) |
| Critical | `COUNT WHERE severity = 'critical' AND status NOT IN ('resolved','dismissed')` | `red-600` |
| Last 60s | Passed from `EventTimeline` via existing `onRecentCount` callback | `amber-500` |

### Data flow
- `DashboardPage` runs two `COUNT` queries server-side (Open, Critical) and passes them as props to `DashboardClient`
- `DashboardClient` holds `recentCount` in state (existing) and passes all three values to `SummaryTiles`
- The floating live-event `Badge` in the current `DashboardClient` header is removed — the tile replaces it

### Visual treatment
- Three equal-width cards in a row (`grid grid-cols-3 gap-4`)
- Each: `shadow-sm border border-border/50 rounded-xl bg-card`
- Left edge accent: `border-l-4` with tile-specific color
- Number: `text-3xl font-bold text-foreground`
- Label: `text-sm text-muted-foreground` below the number
- Critical number turns `text-destructive` when count > 0

---

## 5. EventCard Redesign

**File:** `src/components/EventCard.tsx`

### Left severity stripe
- `border-l-4` on the `Card` element, color class determined by severity
- Severity-to-class map: `critical → border-red-600`, `error → border-orange-500`, `warning → border-yellow-500`, `info → border-blue-500`, default → `border-border`
- `SeverityBadge` removed from the card body (stripe carries the information)

### Elevation
- `shadow-sm hover:shadow-md transition-shadow` on the Card
- Border lightened: `border-border/50`
- Rounded corners stay at `rounded-xl`

### Layout
- Top row: status badge only (right-aligned) — severity badge removed
- Title row: `font-semibold text-sm` with more vertical breathing room
- Description and meta row unchanged
- `SeverityBadge` component itself is not deleted — still used on the event detail page

---

## 6. FilterBar Redesign

**File:** `src/components/FilterBar.tsx`

### Container
- Wrap all controls in `bg-muted/40 rounded-lg px-3 py-2 border border-border/50`
- Gives the filter row a "toolbar" identity, visually separated from the event list

### Input enhancements
- `Source` and `Category` inputs get a `Search` icon prefix (lucide-react) rendered inside the input using a relative-positioned wrapper
- Active filter inputs/selects: `ring-1 ring-primary/40` applied conditionally when a value is set

### Clear button
- Moved to the far right of the toolbar
- Preceded by a `Separator` (vertical, shadcn) to distinguish it from filter controls
- Styling unchanged (ghost button)

### No logic changes
All `router.push`, `updateParam`, and `clearFilters` logic stays identical.

---

## 7. Files Changed

| File | Change |
|---|---|
| `src/app/globals.css` | Add palette CSS variable blocks; update dark theme defaults |
| `src/components/AppSidebar.tsx` | Brand area, nav styles, palette toggle |
| `src/components/PaletteToggle.tsx` | New `'use client'` component |
| `src/components/PageHeader.tsx` | New shared header bar component |
| `src/app/(app)/[slug]/dashboard/page.tsx` | Add COUNT queries, pass to DashboardClient, render PageHeader |
| `src/app/(app)/[slug]/dashboard/[eventId]/page.tsx` | Render PageHeader with breadcrumb |
| `src/app/(app)/[slug]/templates/page.tsx` | Render PageHeader |
| `src/app/(app)/[slug]/baselines/page.tsx` | Render PageHeader |
| `src/app/(app)/[slug]/settings/page.tsx` | Render PageHeader |
| `src/components/DashboardClient.tsx` | Accept tile counts as props, render SummaryTiles, remove floating badge |
| `src/components/SummaryTiles.tsx` | New tiles component |
| `src/components/EventCard.tsx` | Severity stripe, elevation, remove SeverityBadge from card |
| `src/components/FilterBar.tsx` | Container wrap, icon prefixes, active ring, clear button position |

---

## 8. Out of Scope

- Templates, Baselines, Settings page content (only PageHeader is added)
- Charts, sparklines, or any charting library
- Responsive/mobile layout
- Light mode (the main area is light, but no light-mode sidebar is defined)
- Adding more palettes (CSS structure makes this a ~20-line addition later)
