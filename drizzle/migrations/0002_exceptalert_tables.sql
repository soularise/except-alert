CREATE TABLE IF NOT EXISTS action_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  label       TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'webhook',
  config      JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id),
  template_id      UUID NOT NULL REFERENCES action_templates(id),
  label            TEXT NOT NULL,
  config_snapshot  JSONB NOT NULL,
  idempotency_key  TEXT UNIQUE,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','executed','failed')),
  error_info       JSONB,
  executed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);
