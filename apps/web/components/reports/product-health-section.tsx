'use client';

import type { ProductHealth, ProductIssueRef } from '@momus/domain';

const SEV_ORDER = ['Critical', 'Major', 'Minor', 'Low'];
const PRIO_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

function issueUrl(base: string, key: string | null): string | null {
  if (!base || !key) return null;
  return `${base.replace(/\/$/, '')}/${key}`;
}

function orderedEntries(rec: Record<string, number>, order: string[]): Array<[string, number]> {
  const known = order.filter((k) => rec[k] != null).map((k) => [k, rec[k]] as [string, number]);
  const rest = Object.entries(rec)
    .filter(([k]) => !order.includes(k))
    .sort(([a], [b]) => a.localeCompare(b));
  return [...known, ...rest];
}

function Bars({ rec, order }: { rec: Record<string, number>; order: string[] }) {
  const entries = orderedEntries(rec, order);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (entries.length === 0) return <p className="muted">None open.</p>;
  return (
    <div className="bb-analytics-risk__sev-list">
      {entries.map(([k, n]) => (
        <div key={k} className="bb-analytics-dist__row">
          <span>{k}</span>
          <div className="bb-analytics-risk__sev-track">
            <div className="bb-analytics-risk__sev-fill" style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <span>{n}</span>
        </div>
      ))}
    </div>
  );
}

/** Minimal dual-line sparkline: created (teal) vs resolved (red) over the weeks. */
function TrendSparkline({ trend }: { trend: ProductHealth['trend_8w'] }) {
  const w = 220;
  const h = 44;
  const max = Math.max(1, ...trend.flatMap((p) => [p.created, p.resolved]));
  const x = (i: number) => (trend.length <= 1 ? 0 : (i / (trend.length - 1)) * w);
  const y = (v: number) => h - (v / max) * h;
  const line = (key: 'created' | 'resolved') =>
    trend.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="8-week created vs resolved">
      <polyline points={line('created')} fill="none" stroke="#0d7377" strokeWidth={1.5} />
      <polyline points={line('resolved')} fill="none" stroke="#c94c4c" strokeWidth={1.5} strokeDasharray="4 3" />
    </svg>
  );
}

function IssueTable({ issues, base }: { issues: ProductIssueRef[]; base: string }) {
  if (issues.length === 0) return <p className="muted">None.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="bb-analytics-heat" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Issue', 'Summary', 'Sev', 'Priority', 'Age', 'Assignee'].map((c) => (
              <th key={c} scope="col" style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {issues.map((it, i) => {
            const url = issueUrl(base, it.jira_key);
            return (
              <tr key={it.jira_key ?? i}>
                <td style={{ padding: '0.3rem 0.5rem', fontWeight: 600 }}>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {it.jira_key}
                    </a>
                  ) : (
                    (it.jira_key ?? '—')
                  )}
                </td>
                <td style={{ padding: '0.3rem 0.5rem' }}>{it.summary ?? '—'}</td>
                <td style={{ padding: '0.3rem 0.5rem' }}>{it.severity ?? '—'}</td>
                <td style={{ padding: '0.3rem 0.5rem' }}>{it.priority ?? '—'}</td>
                <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>{it.age_days ?? '—'}</td>
                <td style={{ padding: '0.3rem 0.5rem' }}>{it.assignee ?? 'Unassigned'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProductHealthSection({ health, base }: { health: ProductHealth; base: string }) {
  const t = health.this_week;
  return (
    <details id={`product-${health.product}`} className="bb-analytics-risk" style={{ marginBottom: '0.75rem' }}>
      <summary style={{ cursor: 'pointer', padding: '0.25rem 0' }}>
        <strong>{health.product}</strong>{' '}
        <span className="muted">
          · {health.open_total} open · +{t.created} / −{t.resolved} this week
          {health.release_blockers.length > 0
            ? ` · ${health.release_blockers.length} release-blocking`
            : ''}
        </span>
      </summary>

      <div style={{ marginTop: '0.75rem', display: 'grid', gap: '1rem' }}>
        <div className="bb-analytics-dist__cols">
          <div>
            <h4 className="bb-analytics-risk__section-title">Open by severity</h4>
            <Bars rec={health.open_by_severity} order={SEV_ORDER} />
          </div>
          <div>
            <h4 className="bb-analytics-risk__section-title">Open by priority</h4>
            <Bars rec={health.open_by_priority} order={PRIO_ORDER} />
          </div>
          <div>
            <h4 className="bb-analytics-risk__section-title">New vs closed (8 weeks)</h4>
            <TrendSparkline trend={health.trend_8w} />
            <p className="muted" style={{ fontSize: '0.75rem' }}>
              <span style={{ color: '#0d7377' }}>■</span> created ·{' '}
              <span style={{ color: '#c94c4c' }}>■</span> resolved
            </p>
          </div>
        </div>

        {health.release_blockers.length > 0 ? (
          <div>
            <h4 className="bb-analytics-risk__section-title">Release-blocking defects</h4>
            <IssueTable issues={health.release_blockers} base={base} />
          </div>
        ) : null}

        <div>
          <h4 className="bb-analytics-risk__section-title">Top open (by severity)</h4>
          <IssueTable issues={health.top_open} base={base} />
        </div>

        <div>
          <h4 className="bb-analytics-risk__section-title">Oldest open</h4>
          <IssueTable issues={health.oldest_open} base={base} />
        </div>
      </div>
    </details>
  );
}
