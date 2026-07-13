import { leaderboardParamsFromUrl } from '@/lib/leaderboard-params';
import { loadLeaderboard } from '@/lib/load-leaderboard';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET(request: Request) {
  try {
    const params = leaderboardParamsFromUrl(new URL(request.url));
    const result = await loadLeaderboard(params);
    if ('error' in result) return result.error;
    return jsonOk(result.data);
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load leaderboard', 500);
  }
}
