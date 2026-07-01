CREATE TABLE IF NOT EXISTS abuse_rate_limits (
  id            BIGSERIAL PRIMARY KEY,
  key           TEXT NOT NULL,
  scope         TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS abuse_rate_limits_key_window_unique
  ON abuse_rate_limits(key, window_start);

CREATE INDEX IF NOT EXISTS abuse_rate_limits_scope_window_idx
  ON abuse_rate_limits(scope, window_start);
