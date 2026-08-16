import { redirect } from 'next/navigation';
import { ExecutiveSummary } from '@/components/reports/executive-summary';
import { getSessionUser } from '@/lib/auth';

export default async function ExecutiveReportPage() {
  const session = await getSessionUser();
  if (
    'error' in session ||
    session.access !== 'ok' ||
    !session.user.permissions.includes('view_executive_reports')
  ) {
    redirect('/');
  }

  return <ExecutiveSummary />;
}
