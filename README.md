# ExceptAlert

A webhook event monitor and human-in-the-loop (HITL) action runner. ExceptAlert sits downstream of [Relay](https://github.com/soularise/relay), a Rust/Axum service that normalises incoming webhooks into a standard schema and writes them to a shared Postgres database. ExceptAlert provides the dashboard UI, event filtering, status management, action templates, idempotent action execution, and threshold-based alerting.

## Features

- **Multi-tenant dashboard** — filter, search, and inspect webhook events by source, severity, category, and status
- **HITL action templates** — define outbound HTTP actions with variable interpolation, executed idempotently per event
- **Baselines and alerting** — set per-category event rate thresholds; receive Slack or Telegram alerts when thresholds are exceeded, with per-window cooldowns
- **Team management** — invite teammates, manage roles (owner / member) per tenant
- **Settings** — configure notification providers, password reset flows, and tenant details

## Architecture

```
Webhook source
      │
      ▼
   Relay (:3800)          ← normalises webhooks, writes to Postgres
      │
      ▼
  Postgres (:5432)        ← shared database
      │
      ▼
ExceptAlert (:3000)       ← dashboard, alerting, HITL execution
```

ExceptAlert is a read-mostly consumer of Relay's `events` table. It owns `action_templates` and `actions`, and extends the `events` table with a `status` column via its own migrations.

## Tech Stack

- **Next.js 16** (App Router, standalone output)
- **Drizzle ORM** + `postgres` npm package
- **Postgres 16**
- **Better Auth** (credential login, sessions, invitations)
- **shadcn/ui** + Tailwind CSS v4

## Quick Start (Docker Compose)

The `docker-compose.yml` in this repo runs ExceptAlert, Relay, and Postgres together.

> **Prerequisite:** Clone both `relay` and `except-alert` into sibling directories. The Compose file builds Relay from `../relay`.

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env — set BETTER_AUTH_SECRET at minimum

# 2. Start the stack
docker compose up -d --build

# 3. Apply ExceptAlert migrations (first boot only)
docker exec -i except-alert-postgres-1 psql -U relay relay < drizzle/migrations/0001_extend_events.sql
docker exec -i except-alert-postgres-1 psql -U relay relay < drizzle/migrations/0002_exceptalert_tables.sql

# 4. Open the app
open http://localhost:3000
```

> **Note:** Always use `docker compose down` to stop the stack — not `docker stop`. Stopping containers individually leaves them disconnected from the Compose network; the postgres hostname becomes unresolvable on the next `docker compose up`.

## Local Development

The `dev` script starts Postgres and Relay via Compose before launching the Next.js dev server:

```bash
npm install
DATABASE_URL=postgres://relay:relay@localhost:5432/relay npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes | Secret for session signing (min 32 chars in production) |
| `BETTER_AUTH_URL` | Yes | Public URL of the app (e.g. `https://app.example.com`) |
| `EXCEPTALERT_ADMIN_EMAILS` | Yes | Comma-separated list of admin email addresses |
| `EXCEPTALERT_APP_URL` | Yes | Public URL used in outbound emails and links |
| `RELAY_URL` | No | URL of the Relay service (default: `http://relay:3800`) |
| `EXCEPTALERT_PASSWORD_RESET_EVENT_TENANT_ID` | No | Tenant ID used for password reset event routing |
| `EXCEPTALERT_PASSWORD_RESET_EVENT_TENANT_SLUG` | No | Tenant slug used for password reset event routing |

## Migrations

Migrations are plain SQL files in `drizzle/migrations/`. They are not applied automatically on container boot — apply them manually after first boot or after a volume wipe:

```bash
docker exec -i except-alert-postgres-1 psql -U relay relay < drizzle/migrations/0001_extend_events.sql
docker exec -i except-alert-postgres-1 psql -U relay relay < drizzle/migrations/0002_exceptalert_tables.sql
```

During local development you can run migrations directly against the local database:

```bash
DATABASE_URL=postgres://relay:relay@localhost:5432/relay npx drizzle-kit migrate
```

## Admin Provisioning

The provisioning page at `/admin/provision` is accessible to emails listed in `EXCEPTALERT_ADMIN_EMAILS`. It creates a new tenant, owner user, and credential login, and displays a one-time temporary password. The user should change it from Settings → Account after first sign-in.

## Baselines

Baselines monitor event rates per category and alert when a threshold is exceeded.

- **Category** — the event category to watch, e.g. `github.workflow_run`
- **Threshold** — the maximum number of matching events allowed within the window before an alert fires
- **Window** — lookback period: 15 min, 30 min, 60 min, 6 hours, or 24 hours

A threshold of `1` with a 15-minute window alerts on the second matching event within 15 minutes. After an alert fires, the baseline cools down for the duration of its window before it can alert again. Configure Slack or Telegram notification channels from Settings → Providers.

## HITL Action Templates

Templates define outbound HTTP calls that can be triggered manually from an event's detail page. The URL, headers, and body support `{{variable}}` interpolation using event fields:

| Variable | Description |
|---|---|
| `{{source}}` | Event source |
| `{{severity}}` | Event severity |
| `{{title}}` | Event title |
| `{{category}}` | Event category |
| `{{hook_id}}` | Relay hook ID |
| `{{tags.KEY}}` | Value from the event's tags map |

Each execution is idempotent per `eventId + templateId` pair — submitting the same action twice is safe.

## Contributing

Pull requests are welcome. Please open an issue first for significant changes.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Open a pull request

## License

MIT
