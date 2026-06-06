-- Better Auth core tables (Better Auth manages these; do NOT hand-create via Drizzle schema insert)
CREATE TABLE IF NOT EXISTS "user" (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  image        TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  id           TEXT PRIMARY KEY,
  expires_at   TIMESTAMP NOT NULL,
  token        TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address   TEXT,
  user_agent   TEXT,
  user_id      TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  id                        TEXT PRIMARY KEY,
  account_id                TEXT NOT NULL,
  provider_id               TEXT NOT NULL,
  user_id                   TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token              TEXT,
  refresh_token             TEXT,
  id_token                  TEXT,
  access_token_expires_at   TIMESTAMP,
  refresh_token_expires_at  TIMESTAMP,
  scope                     TEXT,
  password                  TEXT,
  created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
  id           TEXT PRIMARY KEY,
  identifier   TEXT NOT NULL,
  value        TEXT NOT NULL,
  expires_at   TIMESTAMP NOT NULL,
  created_at   TIMESTAMP,
  updated_at   TIMESTAMP
);

-- Our business tables
CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  config     JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by  TEXT,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE TABLE tenant_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('admin', 'member', 'viewer')),
  token       TEXT NOT NULL UNIQUE,
  invited_by  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
