-- Momus RLS policies — Supabase security best practices

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_budget_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_budget_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jira_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_checker_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indonesian_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_versions ENABLE ROW LEVEL SECURITY;

-- Helper: check permission via user_permissions joined to users.auth_user_id
CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    JOIN public.users u ON u.id = up.user_id
    WHERE u.auth_user_id = auth.uid()
      AND up.permission = required_permission
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- bug_budget: read with view_analytics
CREATE POLICY bug_budget_select_analytics ON public.bug_budget
  FOR SELECT TO authenticated
  USING (public.has_permission('view_analytics'));

-- sync runs: read own runs or manage_users
CREATE POLICY sync_runs_select_own ON public.bug_budget_sync_runs
  FOR SELECT TO authenticated
  USING (
    public.has_permission('manage_users')
    OR requested_by IN (
      SELECT id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

-- settings/config: read for analytics, write for access_settings
CREATE POLICY settings_select ON public.settings
  FOR SELECT TO authenticated
  USING (public.has_permission('view_analytics') OR public.has_permission('access_settings'));

CREATE POLICY settings_write ON public.settings
  FOR ALL TO authenticated
  USING (public.has_permission('access_settings'))
  WITH CHECK (public.has_permission('access_settings'));

CREATE POLICY bug_budget_config_select ON public.bug_budget_config
  FOR SELECT TO authenticated
  USING (public.has_permission('view_analytics') OR public.has_permission('access_settings'));

CREATE POLICY bug_budget_config_write ON public.bug_budget_config
  FOR ALL TO authenticated
  USING (public.has_permission('access_settings'))
  WITH CHECK (public.has_permission('access_settings'));

CREATE POLICY cron_schedules_select ON public.cron_schedules
  FOR SELECT TO authenticated
  USING (public.has_permission('access_settings'));

CREATE POLICY cron_schedules_write ON public.cron_schedules
  FOR ALL TO authenticated
  USING (public.has_permission('access_settings'))
  WITH CHECK (public.has_permission('access_settings'));

-- holidays: readable by all authenticated users
CREATE POLICY holidays_select ON public.indonesian_holidays
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY holidays_write ON public.indonesian_holidays
  FOR ALL TO authenticated
  USING (public.has_permission('access_settings'))
  WITH CHECK (public.has_permission('access_settings'));

-- Service role bypasses RLS by default in Supabase
