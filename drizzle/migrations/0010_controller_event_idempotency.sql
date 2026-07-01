CREATE UNIQUE INDEX IF NOT EXISTS events_controller_hook_unique
  ON events(tenant_id, hook_id)
  WHERE source = 'controller';
