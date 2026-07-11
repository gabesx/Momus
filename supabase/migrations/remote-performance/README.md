-- Applied to remote project: performance (puwugzzvxvatgjhpdagy)
-- Adapted: skips users/settings/audit_logs (pre-existing), requested_by INTEGER FK

-- See supabase/migrations/20260711000000_initial_schema.sql for full comments.
-- This file documents the remote-adapted version applied via Supabase MCP.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- bug_budget, bug_budget_sync_runs (requested_by INTEGER → users.id),
-- cron_schedules, bug_budget_config, jira_field_mappings,
-- qa_checker_names, indonesian_holidays, user_permissions, cache_versions
-- (Full SQL applied remotely as migration momus_initial_schema)
