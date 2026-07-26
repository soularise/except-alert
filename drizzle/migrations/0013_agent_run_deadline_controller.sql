ALTER TABLE controller_jobs
  DROP CONSTRAINT IF EXISTS controller_jobs_type_check;

ALTER TABLE controller_jobs
  ADD CONSTRAINT controller_jobs_type_check
  CHECK (type IN ('health_ping', 'dead_letter', 'cron_deadline', 'agent_run_deadline', 'deviation'));
