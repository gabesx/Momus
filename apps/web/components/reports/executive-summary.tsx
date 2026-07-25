'use client';

import { useEffect, useState } from 'react';
import type { ExecutiveSummary as ExecutiveSummaryData } from '@momus/domain';
import { apiJson } from '@/lib/api-client';

type ReportResponse = {
  success: boolean;
  message?: string;
  summary: ExecutiveSummaryData;
  meta: { last_updated: string | null; generated_at: string; jira_browse_base: string };
};

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function issueUrl(base: string, key: string | null): string | null {
  if (!base || !key) return null;
  return `${base.replace(/\/$/, '')}/${key}`;
}

export function ExecutiveSummary() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await apiJson<ReportResponse>('/api/reports/executive');
        if (!res.success) setError(res.message ?? 'Failed to load executive report');
        else setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load executive report');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading && !data) {
    return (
      <div className="bb-analytics-metrics">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bb-skeleton" style={{ minHeight: 88 }} />
        ))}
      </div>
    );
  }
  if (error) {
    return <div className="settings-alert settings-alert--error">{error}</div>;
  }
  if (!data) return null;

  const s = data.summary;
  const base = data.meta.jira_browse_base;
  const netLabel = `${s.net_this_week >= 0 ? '+' : ''}${s.net_this_week}`;
  const backlogTone =
    s.net_this_week > 0
      ? 'bb-analytics-metric-card--threshold-danger'
      : s.net_this_week < 0
        ? 'bb-analytics-metric-card--threshold-ok'
        : '';

  const tiles = [
    { label: 'Total Open Bugs', value: String(s.total_open), variant: 'bb-analytics-metric-card--danger' },
    { label: 'New This Week', value: String(s.created_this_week), variant: 'bb-analytics-metric-card--primary' },
    { label: 'Closed This Week', value: String(s.resolved_this_week), variant: 'bb-analytics-metric-card--success' },
    {
      label: 'Backlog Change (WoW)',
      value: netLabel,
      variant: backlogTone,
      hint: `${s.backlog_prev} → ${s.backlog_now}`,
    },
    {
      label: 'Release Blocking',
      value: String(s.release_blocking_count),
      variant:
        s.release_blocking_count > 0 ? 'bb-analytics-metric-card--threshold-danger' : '',
      hint: 'open · Highest · Critical',
    },
    {
      label: 'Riskiest Squad',
      value: s.top_squad ? s.top_squad.key : '—',
      variant: '',
      hint: s.top_squad ? `${s.top_squad.open} open` : undefined,
    },
  ];

  return (
    <main className="bb-analytics">
      <header className="bb-analytics-header">
        <div>
          <h1>Executive Report</h1>
          <p>Weekly QA health for leadership — updated {formatWhen(data.meta.last_updated)}</p>
        </div>
      </header>

      <section aria-label="Executive summary">
        <h2 className="bb-analytics-risk__section-title">Executive Summary</h2>
        <div className="bb-analytics-metrics">
          {tiles.map((t) => (
            <div key={t.label} className={`bb-analytics-metric-card ${t.variant}`.trim()}>
              <div className="bb-analytics-metric-card__label">{t.label}</div>
              <div className="bb-analytics-metric-card__value">{t.value}</div>
              {t.hint ? (
                <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                  {t.hint}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="bb-analytics-risk" aria-label="Release-blocking bugs" style={{ marginTop: '1.5rem' }}>
        <div className="bb-analytics-risk__header">
          <h2>Critical Bugs Blocking Release</h2>
          <p>Open issues at top priority and severity (Highest · Critical), oldest first</p>
        </div>
        {s.release_blockers.length === 0 ? (
          <p className="muted">No release-blocking bugs. 🎉</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="bb-analytics-heat" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  {['Issue', 'Summary', 'Age (days)', 'Assignee', 'Reporter'].map((h) => (
                    <th key={h} scope="col" style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.release_blockers.map((b, i) => {
                  const url = issueUrl(base, b.jira_key);
                  return (
                    <tr key={b.jira_key ?? i}>
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            {b.jira_key}
                          </a>
                        ) : (
                          (b.jira_key ?? '—')
                        )}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{b.summary ?? '—'}</td>
                      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>
                        {b.age_days ?? '—'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{b.assignee ?? 'Unassigned'}</td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{b.reporter ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
