import { redirect } from 'next/navigation';
import { BugBudgetDashboard } from '@/components/bug-budget/bug-budget-dashboard';
import { loadMenuFlagsForUser } from '@/lib/menu-visibility-gate';
import { landingPathFor, requirePagePermission } from '@/lib/page-guard';

export default async function BugBudgetPage() {
  const user = await requirePagePermission('view_analytics');
  const flags = await loadMenuFlagsForUser(user.id);
  if (!flags.show_bug_budget) {
    redirect(landingPathFor(user.permissions, { flags }));
  }
  return <BugBudgetDashboard />;
}
