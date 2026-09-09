import { redirect } from 'next/navigation';
import { DefectTrackerDashboard } from '@/components/tracker/defect-tracker-dashboard';
import { loadMenuFlagsForUser } from '@/lib/menu-visibility-gate';
import { landingPathFor, requirePagePermission } from '@/lib/page-guard';

export default async function TrackerPage() {
  const user = await requirePagePermission('view_analytics');
  const flags = await loadMenuFlagsForUser(user.id);
  if (!flags.show_defect_tracker) {
    redirect(landingPathFor(user.permissions, { flags }));
  }
  return <DefectTrackerDashboard />;
}
