-- Momus initial schema — PRD §4 (BB-DATA-01 through BB-DATA-05)
-- Timezone: Asia/Jakarta (application layer)

-- ---------------------------------------------------------------------------
-- Shared: updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users — legacy-compatible bigint IDs for migration (BB-DATA-03 FK)
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  is_candidate BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_permissions — BB-PERM-01
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_permissions (
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('view_analytics', 'access_settings', 'manage_users')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);

CREATE INDEX user_permissions_permission_idx ON public.user_permissions (permission);

-- ---------------------------------------------------------------------------
-- bug_budget — BB-DATA-01, BB-DATA-02 (denormalized Jira mirror, no FKs)
-- ---------------------------------------------------------------------------
CREATE TABLE public.bug_budget (
  id BIGSERIAL PRIMARY KEY,
  jira_key VARCHAR(255) NOT NULL,
  project VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  linked_issues JSONB,
  has_linked_test_execution BOOLEAN NOT NULL DEFAULT false,
  tester_assignee VARCHAR(255),
  test_engineer_assignee VARCHAR(255),
  assignee VARCHAR(255),
  engineer_assignee VARCHAR(255),
  assignee_final VARCHAR(255),
  qa_checker VARCHAR(255),
  tested_by VARCHAR(255),
  owner VARCHAR(255),
  reporter VARCHAR(255),
  creator VARCHAR(255),
  labels JSONB,
  status VARCHAR(255),
  issue_type VARCHAR(255),
  final_issue_type VARCHAR(255),
  priority VARCHAR(255),
  severity_issue VARCHAR(255),
  sprint VARCHAR(255),
  status_category VARCHAR(255),
  status_category_changed TIMESTAMPTZ,
  created_date TIMESTAMPTZ,
  start_date DATE,
  begin_date DATE,
  due_date DATE,
  end_date DATE,
  chart_date_first_response TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  story_point_estimate NUMERIC(8, 2),
  story_points NUMERIC(8, 2),
  epic_link VARCHAR(255),
  epic_name VARCHAR(255),
  parent VARCHAR(255),
  parent_link VARCHAR(255),
  epic_level_epic VARCHAR(255),
  story_task_level_epic_name VARCHAR(255),
  parent_epic_layer_2_key VARCHAR(255),
  parent_epic_key VARCHAR(255),
  final_epic_name VARCHAR(255),
  linked_parent_epic_info TEXT,
  pic_story_task_link_summary TEXT,
  epic_task_story_name_summary TEXT,
  components JSONB,
  fix_versions JSONB,
  is_open BOOLEAN NOT NULL DEFAULT true,
  time_spent_seconds INTEGER,
  progress_percentage NUMERIC(5, 2),
  time_to_resolution_hours NUMERIC(10, 2),
  service_feature VARCHAR(255),
  service_feature_final VARCHAR(255),
  created_year INTEGER,
  created_num_month INTEGER,
  created_month_alpha VARCHAR(255),
  first_response_month VARCHAR(255),
  closed_month VARCHAR(255),
  closed_year INTEGER,
  closed_alpha_month VARCHAR(255),
  quarter VARCHAR(255),
  first_response_age_days INTEGER,
  defect_age_days INTEGER,
  defect_age_bucket VARCHAR(255),
  defect_count INTEGER,
  bug_count INTEGER,
  reports TEXT,
  pic_report TEXT,
  ac_related_labels JSONB,
  issue_level_type_layer_1 VARCHAR(255),
  issue_level_layer_2_type VARCHAR(255),
  final_issue VARCHAR(255),
  epic_final_issue_type VARCHAR(255),
  real_project VARCHAR(255),
  bug_cost NUMERIC(10, 2),
  raw_jira_data JSONB,
  updated_date TIMESTAMPTZ,
  resolved_date TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT bug_budget_jira_key_unique UNIQUE (jira_key)
);

CREATE INDEX bug_budget_created_year_project_idx ON public.bug_budget (created_year, project);
CREATE INDEX bug_budget_created_year_is_open_idx ON public.bug_budget (created_year, is_open);
CREATE INDEX bug_budget_quarter_idx ON public.bug_budget (quarter);
CREATE INDEX bug_budget_created_date_idx ON public.bug_budget (created_date);
CREATE INDEX bug_budget_linked_test_year_project_idx
  ON public.bug_budget (has_linked_test_execution, created_year, project);

CREATE TRIGGER bug_budget_updated_at
  BEFORE UPDATE ON public.bug_budget
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bug_budget_sync_runs — BB-DATA-03
-- ---------------------------------------------------------------------------
CREATE TABLE public.bug_budget_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  requested_by BIGINT NOT NULL REFERENCES public.users(id),
  sync_type VARCHAR(32) NOT NULL DEFAULT 'custom',
  jql TEXT NOT NULL,
  batch_size SMALLINT NOT NULL DEFAULT 50 CHECK (batch_size > 0 AND batch_size <= 5000),
  max_total_issues INTEGER NOT NULL DEFAULT 0 CHECK (max_total_issues >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  total_issues INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  current_batch SMALLINT NOT NULL DEFAULT 0,
  percentage SMALLINT NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bug_budget_sync_runs_requested_by_idx ON public.bug_budget_sync_runs (requested_by);
CREATE INDEX bug_budget_sync_runs_status_idx ON public.bug_budget_sync_runs (status);
CREATE INDEX bug_budget_sync_runs_status_created_at_idx
  ON public.bug_budget_sync_runs (status, created_at);

CREATE TRIGGER bug_budget_sync_runs_updated_at
  BEFORE UPDATE ON public.bug_budget_sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- cron_schedules — BB-DATA-04
-- ---------------------------------------------------------------------------
CREATE TABLE public.cron_schedules (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  command VARCHAR(255) NOT NULL,
  schedule_type VARCHAR(32) NOT NULL DEFAULT 'daily'
    CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  interval_days INTEGER NOT NULL DEFAULT 1,
  time VARCHAR(5) NOT NULL DEFAULT '00:00',
  day_of_week VARCHAR(16),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  command_params JSONB,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_result TEXT,
  last_run_status VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cron_schedules_name_unique UNIQUE (name)
);

CREATE INDEX cron_schedules_active_next_run_idx ON public.cron_schedules (is_active, next_run_at);

CREATE TRIGGER cron_schedules_updated_at
  BEFORE UPDATE ON public.cron_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- settings — BB-DATA-05
-- ---------------------------------------------------------------------------
CREATE TABLE public.settings (
  id BIGSERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL,
  value TEXT,
  type VARCHAR(64) NOT NULL DEFAULT 'string',
  "group" VARCHAR(64) NOT NULL DEFAULT 'general',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settings_key_unique UNIQUE (key)
);

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bug_budget_config — DEV-1 (multipliers, budgets, mappings, exclusions)
-- ---------------------------------------------------------------------------
CREATE TABLE public.bug_budget_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER bug_budget_config_updated_at
  BEFORE UPDATE ON public.bug_budget_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- jira_field_mappings — DEV-5
-- ---------------------------------------------------------------------------
CREATE TABLE public.jira_field_mappings (
  id BIGSERIAL PRIMARY KEY,
  jira_field_id VARCHAR(64) NOT NULL,
  column_name VARCHAR(128) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT jira_field_mappings_field_unique UNIQUE (jira_field_id)
);

CREATE TRIGGER jira_field_mappings_updated_at
  BEFORE UPDATE ON public.jira_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- qa_checker_names — DEV-4
-- ---------------------------------------------------------------------------
CREATE TABLE public.qa_checker_names (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qa_checker_names_name_unique UNIQUE (name)
);

-- ---------------------------------------------------------------------------
-- indonesian_holidays — DEV-3
-- ---------------------------------------------------------------------------
CREATE TABLE public.indonesian_holidays (
  id BIGSERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL,
  name TEXT,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT indonesian_holidays_date_unique UNIQUE (holiday_date)
);

CREATE INDEX indonesian_holidays_year_idx ON public.indonesian_holidays (year);

-- ---------------------------------------------------------------------------
-- audit_logs — DEV-10, BB-LIFE-05
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_key TEXT,
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_key);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at);

-- ---------------------------------------------------------------------------
-- cache_version — BB-CACHE-01
-- ---------------------------------------------------------------------------
CREATE TABLE public.cache_versions (
  key TEXT PRIMARY KEY,
  version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.cache_versions (key, version) VALUES ('bug_budget', 0);
