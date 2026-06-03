# ExceptAlert

@~/.claude/CLAUDE.md

## What This Is

ExceptAlert is a webhook event monitor and HITL (human-in-the-loop) action runner. It sits downstream of Relay (a separate Rust/Axum service at `~/claudehome/projects/relay`) which normalises incoming webhooks into a standard schema and writes them to a shared Postgres database. ExceptAlert provides the dashboard UI, filtering, event detail, status management, action templates, and idempotent action execution.

## Tech Stack

- Next.js 16 (App Router, standalone output)
- Drizzle ORM + `postgres` npm package
- Postgres 16 (shared with Relay)
- shadcn/ui + Tailwind CSS
- Docker Compose for the full stack

## Key Directories

- `src/app/api/` — route handlers (events, templates, HITL execute)
- `src/app/dashboard/` — dashboard page, event detail page, templates page
- `src/components/` — DashboardClient, FilterBar, EventTimeline, EventDetail, HitlActionPanel
- `src/lib/db/` — Drizzle client (`index.ts`) and schema (`schema.ts`)
- `src/lib/hitl.ts` — action execution logic (outbound HTTP, idempotency)
- `drizzle/migrations/` — SQL migration files (applied manually, see Gotchas)

## Commands

```bash
# Local dev (pointed at Docker postgres)
DATABASE_URL=postgres://relay:relay@localhost:5432/relay npm run dev

# Production build
npm run build

# Full stack (Relay + ExceptAlert + Postgres)
docker compose up -d --build

# Apply ExceptAlert migrations (drizzle-kit is NOT in the prod image)
docker exec -i except-alert-postgres-1 psql -U relay relay < drizzle/migrations/0001_extend_events.sql
docker exec -i except-alert-postgres-1 psql -U relay relay < drizzle/migrations/0002_exceptalert_tables.sql

# Tail logs
docker compose logs -f exceptalert
docker compose logs -f relay
```

## Architecture Notes

**Shared database with Relay.** Relay owns the `events`, `audit_log`, `schemas`, and `mappings` tables and runs its own sqlx migrations on boot. ExceptAlert owns `action_templates` and `actions`, and adds the `status` column to `events` via its own migrations. Never let Relay and ExceptAlert migrations conflict on the `events` table.

**Filters are URL-driven.** `DashboardPage` (server component) reads `searchParams` and passes them as `initialFilters` to `DashboardClient`. `FilterBar` writes to the URL via `router.push`. Do not wrap `initialFilters` in `useState` — it captures the mount value and never updates on navigation.

**`postgres` npm package and raw SQL templates.** The `sql` tagged template from drizzle-orm does not serialise `Date` objects — the postgres driver throws `ERR_INVALID_ARG_TYPE`. Always use Drizzle's typed operators (`gte`, `lte`, `lt`, `gt`) for date comparisons rather than raw `sql` templates.

**HITL idempotency key** is `{eventId}:{templateId}`, enforced by a UNIQUE constraint on `actions.idempotency_key`. The execute route checks for an existing row before making the outbound HTTP call. The UI shows "Already executed" only after the second click in the current session — on page load it does not yet check existing action state.

**Relay Stripe template** (`relay/config/templates/stripe.json`) requires `$.data.object.created` (Unix timestamp) for `occurred_at` and only maps severity for `charge.failed`, `charge.refunded`, and `payment_intent.succeeded`. Other event types will fail normalization with `enum_map: no mapping defined`.

## Gotchas

- **Always use `docker compose down` to stop the stack**, not `docker stop`. Using `docker stop` leaves containers disconnected from the Compose network; on the next `docker compose up` the postgres container starts healthy but with no network, so other services can't resolve the `postgres` hostname.
- **Migrations are not auto-run on container boot.** Apply them manually with `docker exec -i ... psql` after first boot or after a volume wipe (see Commands above).
- **`drizzle-kit` is not in the production Docker image.** It's a dev dependency used only at build time. Never rely on `docker compose exec exceptalert npx drizzle-kit` in production or CI.
- **Relay Stripe test payloads must include `"created": <unix_timestamp>`** on `data.object` or normalization fails silently (event lands in `audit_log` with `status=failed`).
- **Port assignments:** Postgres `5432`, Relay `3800`, ExceptAlert `3000`.
