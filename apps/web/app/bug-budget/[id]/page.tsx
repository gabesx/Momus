import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { IssueDetail } from '@/components/bug-budget/issue-detail';
import { loadMenuFlagsForUser } from '@/lib/menu-visibility-gate';
import { landingPathFor, requirePagePermission } from '@/lib/page-guard';

export default async function BugBudgetDetailPage() {
  const user = await requirePagePermission('view_analytics');
  const flags = await loadMenuFlagsForUser(user.id);
  if (!flags.show_bug_budget) {
    redirect(landingPathFor(user.permissions, { flags }));
  }

  return (
    <Suspense fallback={<main className="bb-detail"><div className="bb-skeleton" style={{ minHeight: 200 }} /></main>}>
      <IssueDetail />
    </Suspense>
  );
}
