import { DefectTrackerDashboard } from '@/components/tracker/defect-tracker-dashboard';
import { requirePagePermission } from '@/lib/page-guard';

export default async function TrackerPage() {
  await requirePagePermission('view_analytics');
  return <DefectTrackerDashboard />;
}
