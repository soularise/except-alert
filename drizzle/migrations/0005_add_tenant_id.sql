-- Add tenant_id to existing data tables (nullable first for backfill)
ALTER TABLE events           ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE actions          ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE action_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE baselines        ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Seed default tenant (backward-compat for auth-disabled mode)
INSERT INTO tenants (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Default', 'default')
ON CONFLICT DO NOTHING;

-- Backfill existing rows
UPDATE events           SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE actions          SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE action_templates SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE baselines        SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Make NOT NULL
ALTER TABLE events           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE actions          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE action_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE baselines        ALTER COLUMN tenant_id SET NOT NULL;

-- Settings: add tenant_id and change to composite PK
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (tenant_id, key);

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_events_tenant    ON events          (tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_tenant   ON actions         (tenant_id);
CREATE INDEX IF NOT EXISTS idx_baselines_tenant ON baselines       (tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON action_templates(tenant_id);
