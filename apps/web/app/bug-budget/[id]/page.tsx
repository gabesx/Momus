import { Suspense } from 'react';
import { IssueDetail } from '@/components/bug-budget/issue-detail';
import { requirePagePermission } from '@/lib/page-guard';

export default async function BugBudgetDetailPage() {
  await requirePagePermission('view_analytics');

  return (
    <Suspense fallback={<main className="bb-detail"><div className="bb-skeleton" style={{ minHeight: 200 }} /></main>}>
      <IssueDetail />
    </Suspense>
  );
}
