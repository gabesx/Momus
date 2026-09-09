import { redirect } from 'next/navigation';
import { DefectAnalyticsDashboard } from '@/components/analytics/defect-analytics-dashboard';
import { loadShowDefectAnalytics } from '@/lib/defect-analytics-gate';
import { requirePagePermission } from '@/lib/page-guard';

export default async function HomePage() {
  await requirePagePermission('view_analytics');
  if (!(await loadShowDefectAnalytics())) {
    redirect('/bug-budget');
  }
  return <DefectAnalyticsDashboard />;
}
