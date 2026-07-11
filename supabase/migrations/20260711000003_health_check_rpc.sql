-- Applied remotely as momus_health_check_rpc on performance (puwugzzvxvatgjhpdagy)
CREATE OR REPLACE FUNCTION public.momus_health_check()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'settings_reachable', EXISTS (SELECT 1 FROM public.settings LIMIT 1),
    'bug_budget_config_count', (SELECT count(*)::int FROM public.bug_budget_config),
    'bug_budget_table', to_regclass('public.bug_budget') IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.momus_health_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.momus_health_check() TO anon, authenticated, service_role;
