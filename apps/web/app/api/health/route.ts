import { NextResponse } from 'next/server';
import { createServerClient, getJiraSettings, maskJiraToken } from '@momus/infra/supabase';

type HealthProbe = {
  ok?: boolean;
  settings_reachable?: boolean;
  bug_budget_config_count?: number;
  bug_budget_table?: boolean;
};

export async function GET() {
  const checks: Record<string, string | number | boolean> = {
    app: 'ok',
    database: 'unknown',
  };

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc('momus_health_check');

    if (error) {
      checks.database = `error: ${error.message}`;
    } else {
      const probe = data as HealthProbe;
      checks.database = probe?.ok ? 'ok' : 'degraded';
      checks.settings_reachable = Boolean(probe?.settings_reachable);
      checks.bug_budget_config_count = probe?.bug_budget_config_count ?? 0;
      checks.bug_budget_table = Boolean(probe?.bug_budget_table);
    }

    try {
      const jira = await getJiraSettings();
      checks.jira_url = jira.url;
      checks.jira_enabled = jira.enabled;
      checks.jira_username_set = Boolean(jira.username);
      checks.jira_token = maskJiraToken(jira.apiToken);
    } catch (jiraErr) {
      checks.jira_settings = jiraErr instanceof Error ? jiraErr.message : 'unavailable';
    }
  } catch (err) {
    checks.database = err instanceof Error ? err.message : 'unavailable';
  }

  const healthy = checks.database === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      service: 'momus',
      version: '0.0.0',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
