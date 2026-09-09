import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { loadMenuFlagsForUser } from '@/lib/menu-visibility-gate';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy path — analytics lives on the homepage. */
export default async function AnalyticsRedirectPage({ searchParams }: Props) {
  const session = await getSessionUser();
  const userId =
    !('error' in session) && session.access === 'ok' ? session.user.id : 0;
  const flags = await loadMenuFlagsForUser(userId);
  if (!flags.show_defect_analytics) {
    redirect('/bug-budget');
  }

  const params = await searchParams;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') sp.set(key, value);
    else if (Array.isArray(value)) {
      for (const v of value) sp.append(key, v);
    }
  }
  const qs = sp.toString();
  redirect(qs ? `/?${qs}` : '/');
}
