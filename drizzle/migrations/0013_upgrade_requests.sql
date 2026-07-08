CREATE TABLE IF NOT EXISTS tenant_plan_changes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  previous_plan TEXT NOT NULL,
  next_plan     TEXT NOT NULL,
  actor_user_id TEXT REFERENCES "user"(id),
  reason        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_plan_changes_tenant_created
  ON tenant_plan_changes(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS upgrade_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requester_user_id   TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  current_plan        TEXT NOT NULL CHECK (current_plan IN ('free', 'pro', 'growth')),
  requested_plan      TEXT NOT NULL CHECK (requested_plan IN ('pro', 'growth')),
  status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'payment_sent', 'paid', 'approved', 'declined', 'cancelled')),
  source              TEXT NOT NULL DEFAULT 'manual',
  request_reason      TEXT,
  admin_note          TEXT,
  resolved_by_user_id TEXT REFERENCES "user"(id),
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status_created
  ON upgrade_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_tenant_created
  ON upgrade_requests(tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS upgrade_requests_one_active_per_tenant
  ON upgrade_requests(tenant_id)
  WHERE status IN ('open', 'payment_sent', 'paid');
