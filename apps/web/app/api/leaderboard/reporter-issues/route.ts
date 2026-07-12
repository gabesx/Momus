import {
  filterReporterDrilldown,
  type LeaderboardDrillContext,
  type LeaderboardIssueRow,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient, getJiraSettings } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { leaderboardParamsFromUrl } from '@/lib/leaderboard-params';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;
  try {
    const url = new URL(request.url);
    const reporter = url.searchParams.get('reporter')?.trim();
    if (!reporter) return jsonFail('reporter is required', 422);
    const context = (url.searchParams.get('context') as LeaderboardDrillContext | null) ?? 'global';
    const group = url.searchParams.get('group');
    const params = leaderboardParamsFromUrl(url);
    const nowIso = new Date().toISOString();

    const repo = new BugBudgetQueryRepository(createServerClient());
    const all = await repo.listAllForFilters();
    const rows: LeaderboardIssueRow[] = all.map((r) => ({
      reporter: r.reporter ?? null,
      issue_type: r.issue_type ?? null,
      project: r.project ?? null,
      status: r.status ?? null,
      created_date: r.created_date ?? null,
      jira_key: r.jira_key ?? null,
      summary: r.summary ?? null,
      severity_issue: r.severity_issue ?? null,
      priority: r.priority ?? null,
    }));

    const issues = filterReporterDrilldown(rows, params, nowIso, reporter, context, group);
    let jira_browse_base = '';
    try {
      const jira = await getJiraSettings();
      jira_browse_base = jira.url ? `${jira.url.replace(/\/$/, '')}/browse` : '';
    } catch {
      jira_browse_base = '';
    }

    return jsonOk({
      count: issues.length,
      issues: issues.map((i) => ({
        ...i,
        jira_url: i.jira_key && jira_browse_base ? `${jira_browse_base}/${i.jira_key}` : null,
      })),
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load reporter issues', 500);
  }
}
