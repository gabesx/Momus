'use client';

import { useEffect, useState } from 'react';
import { MESSAGES } from '@momus/shared';
import { apiJson } from '@/lib/api-client';
import type { ConnectionState } from '../atlassian-settings';

type Props = {
  connection: ConnectionState | null;
  onJiraSaved: () => Promise<void>;
  onConfluenceSaved: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
};

export function AtlassianTab({
  connection,
  onJiraSaved,
  onConfluenceSaved,
  onError,
  onInfo,
}: Props) {
  const [siteUrl, setSiteUrl] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [savingJira, setSavingJira] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);

  const [confUrl, setConfUrl] = useState('');
  const [confEmail, setConfEmail] = useState('');
  const [spaces, setSpaces] = useState('');
  const [defaultSpace, setDefaultSpace] = useState('');
  const [loadingConf, setLoadingConf] = useState(true);
  const [savingConf, setSavingConf] = useState(false);

  useEffect(() => {
    if (!connection) return;
    setSiteUrl(connection.site_url);
    setJiraEmail(connection.email);
    setApiToken(connection.api_token || '');
    setEnabled(connection.enabled);
    setTokenSaved(connection.configured);
  }, [connection]);

  useEffect(() => {
    void (async () => {
      setLoadingConf(true);
      try {
        const res = await apiJson<{
          confluence?: {
            url: string;
            email: string;
            space_keys: string;
            default_space: string;
          };
        }>('/api/settings/confluence');
        if (res.success && res.confluence) {
          setConfUrl(res.confluence.url);
          setConfEmail(res.confluence.email);
          setSpaces(res.confluence.space_keys);
          setDefaultSpace(res.confluence.default_space);
        }
      } finally {
        setLoadingConf(false);
      }
    })();
  }, []);

  const saveJira = async () => {
    setSavingJira(true);
    try {
      const res = await apiJson('/api/settings/bug-budget/save-connection', {
        method: 'POST',
        body: JSON.stringify({
          site_url: siteUrl,
          email: jiraEmail,
          api_token: apiToken || '****************',
          enabled,
        }),
      });
      if (!res.success) {
        onError(res.message ?? 'Failed to save connection');
        return;
      }
      await onJiraSaved();
    } finally {
      setSavingJira(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await apiJson<{ user?: string }>('/api/settings/bug-budget/test-connection', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!res.success) {
        onError(res.message ?? MESSAGES.M08);
        return;
      }
      onInfo(`${MESSAGES.M07}${res.user ? ` — ${res.user}` : ''}`);
    } finally {
      setTesting(false);
    }
  };

  const saveConfluence = async () => {
    setSavingConf(true);
    try {
      const res = await apiJson('/api/settings/confluence', {
        method: 'POST',
        body: JSON.stringify({
          url: confUrl,
          email: confEmail,
          space_keys: spaces,
          default_space: defaultSpace,
        }),
      });
      if (!res.success) {
        onError(res.message ?? 'Failed to save Confluence settings');
        return;
      }
      onConfluenceSaved();
    } finally {
      setSavingConf(false);
    }
  };

  const statusLabel = connection?.configured
    ? enabled
      ? 'Ready'
      : 'Disabled'
    : 'Not configured';

  return (
    <div className="settings-grid">
      <div className="atlassian-stack">
        <section className="settings-card" id="jira-connection">
          <h2>Jira Connection</h2>
          <p className="muted">Credentials used by Bug Budget sync.</p>

          <label className="toggle-row">
            <span>Enable Jira Integration</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </label>

          <label className="field">
            <span>Atlassian Site URL *</span>
            <input
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://your-site.atlassian.net"
            />
            <small className="hint">Your Jira site URL (no trailing slash).</small>
          </label>

          <label className="field">
            <span>Account Email *</span>
            <input
              type="email"
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>

          <label className="field">
            <span>API Token *</span>
            <div className="input-with-action">
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => {
                  setApiToken(e.target.value);
                  setTokenSaved(false);
                }}
                placeholder={tokenSaved ? 'Leave masked to keep current token' : 'Paste API token'}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            {tokenSaved ? (
              <small className="hint hint-success">
                A token is saved. Leave masked to keep it, or paste a new one.
              </small>
            ) : (
              <small className="hint">
                Create a token at id.atlassian.com → Security → API tokens.
              </small>
            )}
          </label>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingJira}
              onClick={() => void saveJira()}
            >
              {savingJira ? 'Saving…' : 'Save Jira Connection'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={testing || !connection?.configured}
              onClick={() => void test()}
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        </section>

        <section className="settings-card" id="confluence">
          <h2>Confluence</h2>
          <p className="muted">Optional — separate from Jira if needed.</p>
          {loadingConf ? (
            <p className="muted">Loading…</p>
          ) : (
            <>
              <label className="field">
                <span>Confluence URL</span>
                <input
                  value={confUrl}
                  onChange={(e) => setConfUrl(e.target.value)}
                  placeholder="https://your-site.atlassian.net/wiki"
                />
              </label>
              <label className="field">
                <span>Confluence Email</span>
                <input
                  type="email"
                  value={confEmail}
                  onChange={(e) => setConfEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </label>
              <label className="field">
                <span>Space Keys</span>
                <input
                  value={spaces}
                  onChange={(e) => setSpaces(e.target.value)}
                  placeholder="Comma-separated space keys"
                />
              </label>
              <label className="field">
                <span>Default Space</span>
                <input
                  value={defaultSpace}
                  onChange={(e) => setDefaultSpace(e.target.value)}
                  placeholder="Default space key"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingConf}
                onClick={() => void saveConfluence()}
              >
                {savingConf ? 'Saving…' : 'Save Confluence'}
              </button>
            </>
          )}
        </section>
      </div>

      <aside className="settings-card settings-card--side">
        <h3>Status</h3>
        <dl className="kv">
          <div>
            <dt>Jira</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>Site</dt>
            <dd>{connection?.site_url || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{connection?.email || '—'}</dd>
          </div>
          <div>
            <dt>Confluence</dt>
            <dd>
              {loadingConf
                ? '…'
                : confUrl || confEmail || spaces || defaultSpace
                  ? 'Configured'
                  : 'Not set'}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
