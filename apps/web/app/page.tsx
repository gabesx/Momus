import { redirect } from 'next/navigation';
import { DefectAnalyticsDashboard } from '@/components/analytics/defect-analytics-dashboard';
import { loadMenuFlagsForUser } from '@/lib/menu-visibility-gate';
import { landingPathFor, requirePagePermission } from '@/lib/page-guard';

export default async function HomePage() {
  const user = await requirePagePermission('view_analytics');
  const flags = await loadMenuFlagsForUser(user.id);
  if (!flags.show_defect_analytics) {
    redirect(landingPathFor(user.permissions, { flags }));
  }
  return <DefectAnalyticsDashboard />;
}
