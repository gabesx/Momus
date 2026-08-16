import { redirect } from 'next/navigation';
import { AtlassianSettings, type SettingsTab } from '@/components/settings/atlassian-settings';
import { getSessionUser } from '@/lib/auth';

type SearchParams = Promise<{ tab?: string }>;

function resolveTab(tab?: string): SettingsTab {
  if (tab === 'bug-budget') return 'bug-budget';
  if (tab === 'roster') return 'roster';
  // Legacy Connection / Confluence / Shared / Jira → Atlassian
  return 'atlassian';
}

export default async function AtlassianSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSessionUser();
  if (
    'error' in session ||
    session.access !== 'ok' ||
    !session.user.permissions.includes('access_settings')
  ) {
    redirect('/');
  }

  const sp = await searchParams;
  return (
    <main>
      <AtlassianSettings initialTab={resolveTab(sp.tab)} />
    </main>
  );
}
