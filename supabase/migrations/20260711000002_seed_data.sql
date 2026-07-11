-- Momus seed data — default config (PRD §4.5C), cron schedule, Jira field mappings

-- Default multipliers and cache TTLs (DEV-1, D-3 single source of truth)
INSERT INTO public.bug_budget_config (key, value, description) VALUES
  ('priority_multipliers', '{"highest": 2, "high": 0.75, "medium": 0.5, "low": 0.25, "lowest": 0.1}', 'BB-CALC-01 priority multipliers'),
  ('severity_multipliers', '{"critical": 75, "major": 50, "moderate": 5, "minor": 2.5, "low": 1}', 'BB-CALC-01 severity multipliers'),
  ('project_budgets', '{}', 'Per-project budgets — filled by user from Jira projects'),
  ('project_mappings', '{}', 'Jira key to display name — filled by user'),
  ('excluded_projects', '[]', 'Dashboard exclusions — filled by user'),
  ('sync_query', '{"jql":"","sync_type":"custom","batch_size":50,"max_total_issues":10000,"year":2026,"quarter":1,"month":1}', 'JQL Query Configuration (manual sync defaults)'),
  ('cache_ttl', '{"filter_options": 1800, "database_total": 300, "summary": 300}', 'BB-CACHE-01 TTLs in seconds');

-- Default cron schedule row (inactive per PRD §4.4)
INSERT INTO public.cron_schedules (
  name, command, schedule_type, interval_days, time, is_active, description, command_params
) VALUES (
  'bug_budget_sync',
  'bug-budget:sync',
  'daily',
  1,
  '00:00',
  false,
  'Automated Bug Budget Jira sync',
  '{"jql": null, "batch_size": 50, "max_total_issues": 0}'::jsonb
);

-- Jira custom field mappings — BB-SYNC-03 (DEV-5 configurable)
INSERT INTO public.jira_field_mappings (jira_field_id, column_name, description) VALUES
  ('customfield_10069', 'severity_issue', 'Severity'),
  ('customfield_10042', 'tester_assignee', 'Tester / test engineer / tested_by'),
  ('customfield_10014', 'epic_link', 'Epic link / parent_epic_key'),
  ('customfield_10011', 'epic_name', 'Epic name'),
  ('customfield_10016', 'story_point_estimate', 'Story point estimate'),
  ('customfield_10029', 'story_points', 'Story points'),
  ('customfield_10020', 'sprint', 'Sprint array'),
  ('customfield_10076', 'service_feature', 'Service/feature'),
  ('customfield_10015', 'start_date', 'Start date'),
  ('customfield_10056', 'begin_date', 'Begin date'),
  ('customfield_10008', 'actual_start', 'Actual start / first response'),
  ('customfield_10024', 'chart_date_first_response', 'Chart date first response');

-- QA checker names — DEV-4
INSERT INTO public.qa_checker_names (name) VALUES
  ('Annisa Novianti'),
  ('Abdul Aziz'),
  ('Abd Aziz'),
  ('Dwi Fitri'),
  ('Hadiyanto'),
  ('Hanasil'),
  ('Fajar Kurniawan'),
  ('Titis');

-- Indonesian holidays 2024–2026 (DEV-3 starter set)
INSERT INTO public.indonesian_holidays (holiday_date, name, year) VALUES
  ('2024-01-01', 'New Year', 2024),
  ('2024-12-25', 'Christmas', 2024),
  ('2025-01-01', 'New Year', 2025),
  ('2025-12-25', 'Christmas', 2025),
  ('2026-01-01', 'New Year', 2026),
  ('2026-12-25', 'Christmas', 2026);

-- Default settings keys (values from env at runtime)
INSERT INTO public.settings (key, value, type, "group", description) VALUES
  ('jira_url', '', 'string', 'jira', 'Jira site URL'),
  ('jira_username', '', 'string', 'jira', 'Jira account email'),
  ('jira_api_token', '', 'secret', 'jira', 'Jira API token (encrypted via Vault in production)'),
  ('jira_enabled', 'false', 'boolean', 'jira', 'Enable Jira sync'),
  ('confluence_url', '', 'string', 'confluence', 'Confluence site URL'),
  ('confluence_email', '', 'string', 'confluence', 'Confluence account email'),
  ('confluence_space_keys', '', 'string', 'confluence', 'Comma-separated Confluence space keys'),
  ('confluence_default_space', '', 'string', 'confluence', 'Default Confluence space key'),
  ('bug_budget_last_sync_user', '', 'string', 'bug_budget', 'Last sync triggered by'),
  ('bug_budget_last_sync_user_id', '', 'string', 'bug_budget', 'Last sync user id');

-- Dev admin user for local testing
INSERT INTO public.users (email, name, is_candidate) VALUES
  ('admin@momus.local', 'Momus Admin', false);

INSERT INTO public.user_permissions (user_id, permission)
SELECT id, perm FROM public.users, unnest(ARRAY['view_analytics', 'access_settings', 'manage_users']) AS perm
WHERE email = 'admin@momus.local';
