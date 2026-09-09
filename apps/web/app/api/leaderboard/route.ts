import { requireViewLeaderboard } from '@/lib/auth';
import { leaderboardParamsFromUrl } from '@/lib/leaderboard-params';
import { loadLeaderboard } from '@/lib/load-leaderboard';
import { assertModuleVisible } from '@/lib/menu-visibility-gate';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET(request: Request) {
  try {
    const auth = await requireViewLeaderboard();
    if ('error' in auth) return auth.error;
    const denied = await assertModuleVisible('leaderboard', auth.user.id);
    if (denied) return denied;

    const params = leaderboardParamsFromUrl(new URL(request.url));
    const result = await loadLeaderboard(params);
    if ('error' in result) return result.error;
    return jsonOk(result.data);
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load leaderboard', 500);
  }
}
