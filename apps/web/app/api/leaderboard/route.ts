import {
  availableYears,
  computeLeaderboard,
  type LeaderboardIssueRow,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { mapBugBudgetToLeaderboardRow } from '@/lib/leaderboard-map';
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
    const rows: LeaderboardIssueRow[] = all.map(mapBugBudgetToLeaderboardRow);
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
