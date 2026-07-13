import { redirect } from 'next/navigation';
import { LeaderboardDashboard } from '@/components/leaderboard/leaderboard-dashboard';
import { leaderboardParamsFromUrl } from '@/lib/leaderboard-params';
import { loadLeaderboard } from '@/lib/load-leaderboard';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeaderboardPage({ searchParams }: Props) {
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
    const next = encodeURIComponent(`/leaderboard${url.search}`);
    redirect(`/sign-in?next=${next}`);
  }

  return <LeaderboardDashboard initialData={result.data} initialParams={params} />;
}
