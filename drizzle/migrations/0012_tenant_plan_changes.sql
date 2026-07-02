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
