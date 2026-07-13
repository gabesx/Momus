'use client';

import {
  ANALYTICS_KPI_THRESHOLDS,
  criticalMajorPctTone,
  longOverduePctTone,
  type AnalyticsSummaryResult,
} from '@momus/domain';

type Props = {
  summary: AnalyticsSummaryResult | null;
  loading?: boolean;
};

type Sentiment = 'higher-is-bad' | 'higher-is-good' | 'lower-is-good';

const AGE_ORDER = [
  { key: 'fresh' as const, label: 'Fresh' },
  { key: 'aging' as const, label: 'Aging' },
  { key: 'stale' as const, label: 'Stale' },
  { key: 'long_overdue' as const, label: 'Long overdue' },
];

const SEV_ORDER = ['Critical', 'Major', 'Minor', 'Low', 'Unknown'];

function momClass(delta: number | null, sentiment: Sentiment): string {
  if (delta === null || delta === 0) return '';
  if (sentiment === 'lower-is-good') {
    return delta < 0 ? 'metric-trend-positive' : 'metric-trend-negative';
  }
  if (sentiment === 'higher-is-good') {
    return delta > 0 ? 'metric-trend-positive' : 'metric-trend-negative';
  }
  return delta > 0 ? 'metric-trend-negative' : 'metric-trend-positive';
}

function formatMom(delta: number | null): string | null {
  if (delta === null) return null;
  if (delta === 0) return '→ 0% vs previous month';
  const arrow = delta > 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(delta)}% vs previous month`;
}

function thresholdClass(tone: 'ok' | 'warning' | 'danger' | 'neutral'): string {
  if (tone === 'danger') return 'bb-analytics-metric-card--threshold-danger';
  if (tone === 'warning') return 'bb-analytics-metric-card--threshold-warning';
  if (tone === 'ok') return 'bb-analytics-metric-card--threshold-ok';
  return '';
}

export function RiskPanel({ summary, loading }: Props) {
  if (loading && !summary) {
    return (
      <div className="bb-analytics-risk">
        <div className="bb-skeleton" style={{ minHeight: 180 }} />
      </div>
    );
  }
  if (!summary) return null;

  const { risk } = summary;
  const buckets = risk.open_age_buckets;
  const bucketTotal =
    buckets.fresh + buckets.aging + buckets.stale + buckets.long_overdue;

  const sevEntries: Array<[string, number]> = [
    ...SEV_ORDER.filter((k) => (risk.open_severity[k] ?? 0) > 0).map(
      (k) => [k, risk.open_severity[k]!] as [string, number],
    ),
    ...Object.entries(risk.open_severity)
      .filter(([k, n]) => !SEV_ORDER.includes(k) && n > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  ];
  const sevMax = Math.max(0, ...sevEntries.map(([, n]) => n));

  const cmMom = formatMom(risk.mom.open_critical_major);
  const loMom = formatMom(risk.mom.open_long_overdue);

  return (
    <section className="bb-analytics-risk" aria-label="Open risk">
      <div className="bb-analytics-risk__header">
        <h2>Open risk</h2>
        <p>Aging and severity of currently open issues</p>
      </div>

      <div className="bb-analytics-risk__kpis">
        <div
          className={`bb-analytics-metric-card bb-analytics-metric-card--danger ${thresholdClass(
            criticalMajorPctTone(risk.open_critical_major_pct_of_open),
          )}`.trim()}
        >
          <div className="bb-analytics-metric-card__label">Open Critical / Major</div>
          <div className="bb-analytics-metric-card__value">{risk.open_critical_major}</div>
          <div className="bb-analytics-risk__meta">
            {risk.open_critical_major_pct_of_open}% of open
          </div>
          {cmMom ? (
            <div
              className={`bb-analytics-metric-card__trend ${momClass(
                risk.mom.open_critical_major,
                'higher-is-bad',
              )}`.trim()}
            >
              {cmMom}
            </div>
          ) : null}
          {risk.open_critical_major_pct_of_open >=
          ANALYTICS_KPI_THRESHOLDS.open_critical_major_pct_warning ? (
            <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
              ≥ {ANALYTICS_KPI_THRESHOLDS.open_critical_major_pct_warning}% of open warning
            </div>
          ) : null}
        </div>

        <div
          className={`bb-analytics-metric-card bb-analytics-metric-card--danger ${thresholdClass(
            longOverduePctTone(risk.open_long_overdue_pct_of_open),
          )}`.trim()}
        >
          <div className="bb-analytics-metric-card__label">Long overdue</div>
          <div className="bb-analytics-metric-card__value">{risk.open_long_overdue}</div>
          <div className="bb-analytics-risk__meta">
            {risk.open_long_overdue_pct_of_open}% of open
          </div>
          {loMom ? (
            <div
              className={`bb-analytics-metric-card__trend ${momClass(
                risk.mom.open_long_overdue,
                'higher-is-bad',
              )}`.trim()}
            >
              {loMom}
            </div>
          ) : null}
          {risk.open_long_overdue_pct_of_open >=
          ANALYTICS_KPI_THRESHOLDS.open_long_overdue_pct_warning ? (
            <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
              ≥ {ANALYTICS_KPI_THRESHOLDS.open_long_overdue_pct_warning}% of open warning
            </div>
          ) : null}
        </div>
      </div>

      <h3 className="bb-analytics-risk__section-title">Aging (open)</h3>
      {summary.open === 0 || bucketTotal === 0 ? (
        <p className="muted">
          {summary.open === 0
            ? 'No open issues in scope.'
            : 'No open issues with a positive age in scope.'}
        </p>
      ) : (
        <>
          <div
            className="bb-analytics-risk__age-bar"
            role="img"
            aria-label="Open issue age distribution"
          >
            {AGE_ORDER.map(({ key }) => {
              const n = buckets[key];
              if (!n) return null;
              return (
                <div
                  key={key}
                  className={`bb-analytics-risk__age-seg bb-analytics-risk__age-seg--${key}`}
                  style={{ flexGrow: n, flexBasis: 0 }}
                  title={`${key}: ${n}`}
                />
              );
            })}
          </div>
          <div className="bb-analytics-risk__age-legend">
            {AGE_ORDER.map(({ key, label }) => (
              <span key={key}>
                {label}: {buckets[key]}
              </span>
            ))}
          </div>
        </>
      )}

      <h3 className="bb-analytics-risk__section-title">Severity (open)</h3>
      {sevEntries.length === 0 ? (
        <p className="muted">No open issues in scope.</p>
      ) : (
        <div className="bb-analytics-risk__sev-list">
          {sevEntries.map(([label, count]) => (
            <div key={label} className="bb-analytics-risk__sev-row">
              <span>{label}</span>
              <div className="bb-analytics-risk__sev-track">
                <div
                  className="bb-analytics-risk__sev-fill"
                  style={{ width: sevMax ? `${(count / sevMax) * 100}%` : '0%' }}
                />
              </div>
              <span>{count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
