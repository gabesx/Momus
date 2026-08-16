import { ExecutiveSummary } from '@/components/reports/executive-summary';
import { requirePagePermission } from '@/lib/page-guard';

export default async function ExecutiveReportPage() {
  await requirePagePermission('view_executive_reports');
  return <ExecutiveSummary />;
}
