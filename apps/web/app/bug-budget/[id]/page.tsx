import { Suspense } from 'react';
import { IssueDetail } from '@/components/bug-budget/issue-detail';

export default function BugBudgetDetailPage() {
  return (
    <Suspense fallback={<main className="bb-detail"><div className="bb-skeleton" style={{ minHeight: 200 }} /></main>}>
      <IssueDetail />
    </Suspense>
  );
}
