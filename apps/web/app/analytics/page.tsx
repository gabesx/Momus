import { redirect } from 'next/navigation';
import { loadMenuFlagsForUser } from '@/lib/menu-visibility-gate';
import { landingPathFor, requirePagePermission } from '@/lib/page-guard';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy path — analytics lives on the homepage. */
export default async function AnalyticsRedirectPage({ searchParams }: Props) {
  const user = await requirePagePermission('view_analytics');
  const flags = await loadMenuFlagsForUser(user.id);
  if (!flags.show_defect_analytics) {
    redirect(landingPathFor(user.permissions, { flags }));
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
