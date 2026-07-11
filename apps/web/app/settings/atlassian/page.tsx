import { AtlassianSettings, type SettingsTab } from '@/components/settings/atlassian-settings';

type SearchParams = Promise<{ tab?: string }>;

function resolveTab(tab?: string): SettingsTab {
  if (tab === 'bug-budget') return 'bug-budget';
  // Legacy Connection / Confluence / Shared / Jira → Atlassian
  return 'atlassian';
}

export default async function AtlassianSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  return (
    <main>
      <AtlassianSettings initialTab={resolveTab(sp.tab)} />
    </main>
  );
}
