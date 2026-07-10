ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS trigger_mode TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE actions
  DROP CONSTRAINT IF EXISTS actions_trigger_mode_check;

ALTER TABLE actions
  ADD CONSTRAINT actions_trigger_mode_check
  CHECK (trigger_mode IN ('manual', 'automatic'));

CREATE TABLE IF NOT EXISTS controller_job_action_bindings (
  controller_job_id UUID NOT NULL REFERENCES controller_jobs(id) ON DELETE CASCADE,
  action_template_id UUID NOT NULL REFERENCES action_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (controller_job_id, action_template_id)
);

CREATE INDEX IF NOT EXISTS idx_controller_action_bindings_template
  ON controller_job_action_bindings(action_template_id);
