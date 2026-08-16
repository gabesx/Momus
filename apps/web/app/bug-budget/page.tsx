import { BugBudgetDashboard } from '@/components/bug-budget/bug-budget-dashboard';
import { requirePagePermission } from '@/lib/page-guard';

export default async function BugBudgetPage() {
  await requirePagePermission('view_analytics');
  return <BugBudgetDashboard />;
}
