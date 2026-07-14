'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api-client';
import { AnalyticsTab } from './tabs/analytics-tab';
import { AtlassianTab } from './tabs/atlassian-tab';
import { BugBudgetTab } from './tabs/bug-budget-tab';
import { RosterTab } from './tabs/roster-tab';

export type SettingsTab = 'atlassian' | 'bug-budget' | 'analytics' | 'roster';

export type ConnectionState = {
  site_url: string;
  email: string;
  api_token: string;
  enabled: boolean;
  configured: boolean;
};

type Props = {
  initialTab: SettingsTab;
};

function normalizeTab(raw: string | null | undefined): SettingsTab | null {
  if (!raw) return null;
  if (
    raw === 'shared' ||
    raw === 'jira' ||
    raw === 'connection' ||
    raw === 'confluence' ||
    raw === 'atlassian'
  ) {
    return 'atlassian';
  }
  if (raw === 'bug-budget') return 'bug-budget';
  if (raw === 'analytics') return 'analytics';
  if (raw === 'roster') return 'roster';
  return null;
}

function tabFromHash(): SettingsTab | null {
  if (typeof window === 'undefined') return null;
  return normalizeTab(window.location.hash.replace(/^#/, ''));
}

export function AtlassianSettings({ initialTab }: Props) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  );

  const showAlert = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setAlert({ type, text });
    if (type === 'success') {
      window.setTimeout(() => setAlert((a) => (a?.text === text ? null : a)), 8000);
    }
  }, []);

  const loadConnection = useCallback(async () => {
    const res = await apiJson<{ connection?: ConnectionState }>(
      '/api/settings/bug-budget/save-connection',
    );
    if (res.success && res.connection) setConnection(res.connection);
  }, []);

  useEffect(() => {
    void loadConnection();
    const fromHash = tabFromHash();
    if (fromHash) setTab(fromHash);
  }, [loadConnection]);

  const selectTab = (next: SettingsTab) => {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <h1>Atlassian Settings</h1>
          <p>Configure Atlassian credentials and Bug Budget sync.</p>
        </div>
        <Link href="/bug-budget" className="btn btn-outline">
          ← Back to Bug Budget
        </Link>
      </header>

      {alert && (
        <div className={`settings-alert settings-alert--${alert.type}`} role="status">
          <span>{alert.text}</span>
          <button type="button" className="settings-alert__close" onClick={() => setAlert(null)}>
            ×
          </button>
        </div>
      )}

      <nav className="settings-tabs" aria-label="Settings sections">
        {(
          [
            ['atlassian', 'Atlassian'],
            ['bug-budget', 'Bug Budget'],
            ['analytics', 'Analytics'],
            ['roster', 'Roster'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`settings-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => selectTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="settings-body">
        {tab === 'atlassian' && (
          <AtlassianTab
            connection={connection}
            onJiraSaved={async () => {
              await loadConnection();
              showAlert('success', 'Jira connection saved successfully!');
            }}
            onConfluenceSaved={() =>
              showAlert('success', 'Confluence settings saved successfully!')
            }
            onError={(m) => showAlert('error', m)}
            onInfo={(m) => showAlert('info', m)}
          />
        )}
        {tab === 'bug-budget' && (
          <BugBudgetTab
            connection={connection}
            onAlert={showAlert}
            onOpenConnection={() => selectTab('atlassian')}
          />
        )}
        {tab === 'analytics' && <AnalyticsTab onAlert={showAlert} />}
        {tab === 'roster' && <RosterTab onAlert={showAlert} />}
      </div>
    </div>
  );
}
