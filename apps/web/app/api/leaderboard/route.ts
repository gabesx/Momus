import {
  availableYears,
  computeLeaderboard,
  type LeaderboardIssueRow,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { leaderboardParamsFromUrl } from '@/lib/leaderboard-params';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;
  try {
    const params = leaderboardParamsFromUrl(new URL(request.url));
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
    const board = computeLeaderboard(rows, params, nowIso);
    return jsonOk({
      ...board,
      filter_options: {
        years: availableYears(nowIso),
        period_types: [
          { value: 'all', label: 'All Time' },
          { value: 'yearly', label: 'Yearly' },
          { value: 'semester', label: 'Semester' },
          { value: 'quarterly', label: 'Quarterly' },
        ],
      },
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load leaderboard', 500);
  }
}
