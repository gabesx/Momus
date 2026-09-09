import { redirect } from 'next/navigation';
import { DefectAnalyticsDashboard } from '@/components/analytics/defect-analytics-dashboard';
import { loadMenuFlagsForUser } from '@/lib/menu-visibility-gate';
import { requirePagePermission } from '@/lib/page-guard';

export default async function HomePage() {
  const user = await requirePagePermission('view_analytics');
  const flags = await loadMenuFlagsForUser(user.id);
  if (!flags.show_defect_analytics) {
    redirect('/bug-budget');
  }
  return <DefectAnalyticsDashboard />;
}
