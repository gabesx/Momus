import { redirect } from 'next/navigation';
import { LeaderboardDashboard } from '@/components/leaderboard/leaderboard-dashboard';
import { leaderboardParamsFromUrl } from '@/lib/leaderboard-params';
import { loadLeaderboard } from '@/lib/load-leaderboard';
import { landingPathFor, requirePagePermission } from '@/lib/page-guard';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeaderboardPage({ searchParams }: Props) {
  const user = await requirePagePermission('view_leaderboard');
  const sp = await searchParams;
  const url = new URL('http://local/leaderboard');
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') url.searchParams.set(k, v);
    else if (Array.isArray(v)) {
      for (const item of v) url.searchParams.append(k, item);
    }
  }
  const params = leaderboardParamsFromUrl(url);
  if (!params.period_type) params.period_type = 'quarterly';

  const result = await loadLeaderboard(params);
  if ('error' in result) {
    // The guard above already cleared the permission, so a 401 here means the
    // session lapsed mid-request. Anything else lands somewhere reachable
    // rather than /sign-in, which would just bounce a signed-in user back.
    if (result.error.status === 401) {
      const next = encodeURIComponent(`/leaderboard${url.search}`);
      redirect(`/sign-in?next=${next}`);
    }
    redirect(landingPathFor(user.permissions));
  }

  return <LeaderboardDashboard initialData={result.data} initialParams={params} />;
}
