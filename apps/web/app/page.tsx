import { DefectAnalyticsDashboard } from '@/components/analytics/defect-analytics-dashboard';
import { requirePagePermission } from '@/lib/page-guard';

export default async function HomePage() {
  await requirePagePermission('view_analytics');
  return <DefectAnalyticsDashboard />;
}
