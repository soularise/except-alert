CREATE TABLE IF NOT EXISTS controller_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('health_ping', 'dead_letter', 'cron_deadline', 'deviation')),
  config           JSONB NOT NULL DEFAULT '{}',
  cron_expr        TEXT NOT NULL DEFAULT '*/5 * * * *',
  timezone         TEXT NOT NULL DEFAULT 'UTC',
  enabled          BOOLEAN NOT NULL DEFAULT true,
  next_run_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_expires_at TIMESTAMPTZ,
  last_run_at      TIMESTAMPTZ,
  last_status      TEXT NOT NULL DEFAULT 'pending'
                     CHECK (last_status IN ('pending', 'ok', 'alert', 'error')),
  last_result      JSONB,
  last_alerted_at  TIMESTAMPTZ,
  alert_started_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT controller_jobs_tenant_name_unique UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_controller_jobs_due
  ON controller_jobs(next_run_at) WHERE enabled = true;
