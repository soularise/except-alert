ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open'
  CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed'));
