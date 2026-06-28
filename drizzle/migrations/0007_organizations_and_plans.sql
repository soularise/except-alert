ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_plan_check;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_plan_check CHECK (plan IN ('free', 'pro', 'growth'));

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES "user"(id),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingress_key TEXT;

UPDATE tenants
SET ingress_key = 'org_' || encode(gen_random_bytes(16), 'hex')
WHERE ingress_key IS NULL;

ALTER TABLE tenants
  ALTER COLUMN ingress_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_ingress_key_unique
  ON tenants(ingress_key);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_memberships_user_tenant_unique
  ON tenant_memberships(user_id, tenant_id);
