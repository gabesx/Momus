import {
  filterReporterDrilldown,
  missingFieldsForLeaderboardRow,
  TRACKER_MISSING_FIELD_LABELS,
  type LeaderboardDrillContext,
  type LeaderboardIssueRow,
  type TrackerMissingFieldKey,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient, getJiraSettings } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { mapBugBudgetToLeaderboardRow } from '@/lib/leaderboard-map';
import { leaderboardParamsFromUrl } from '@/lib/leaderboard-params';
import { leaderboardSqlRange } from '@/lib/load-leaderboard';
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

    const range = leaderboardSqlRange(params, nowIso);
    const repo = new BugBudgetQueryRepository(createServerClient());
    const all = await repo.listForLeaderboard(range);
    const rows: LeaderboardIssueRow[] = all.map(mapBugBudgetToLeaderboardRow);

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
      issues: issues.map((i) => {
        const missingKeys = missingFieldsForLeaderboardRow(i);
        return {
          ...i,
          jira_url: i.jira_key && jira_browse_base ? `${jira_browse_base}/${i.jira_key}` : null,
          missing_fields: missingKeys,
          missing_field_labels: missingKeys.map(
            (key) => TRACKER_MISSING_FIELD_LABELS[key as TrackerMissingFieldKey] ?? key,
          ),
        };
      }),
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load reporter issues', 500);
  }
}
