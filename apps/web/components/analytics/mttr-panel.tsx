'use client';

import {
  ANALYTICS_KPI_THRESHOLDS,
  mttrCriticalMajorTone,
  type AnalyticsMttrStats,
  type AnalyticsSummaryResult,
} from '@momus/domain';

type Props = {
  summary: AnalyticsSummaryResult | null;
  loading?: boolean;
};

const SEV_ORDER = ['Critical', 'Major', 'Minor', 'Low', 'Unknown'];

function formatHours(hours: number): string {
  if (hours >= 48) return `${Math.round((hours / 24) * 10) / 10}d`;
  return `${Math.round(hours * 10) / 10}h`;
}

function formatMom(delta: number | null): string | null {
  if (delta === null) return null;
  if (delta === 0) return '→ 0% vs previous month';
  const arrow = delta > 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(delta)}% vs previous month`;
}

/** For MTTR lower is better: a drop reads as positive. */
function momClass(delta: number | null): string {
  if (delta === null || delta === 0) return '';
  return delta < 0 ? 'metric-trend-positive' : 'metric-trend-negative';
}

function thresholdClass(tone: 'ok' | 'warning' | 'danger' | 'neutral'): string {
  if (tone === 'danger') return 'bb-analytics-metric-card--threshold-danger';
  if (tone === 'warning') return 'bb-analytics-metric-card--threshold-warning';
  if (tone === 'ok') return 'bb-analytics-metric-card--threshold-ok';
  return '';
}

export function MttrPanel({ summary, loading }: Props) {
  if (loading && !summary) {
    return (
      <div className="bb-analytics-risk">
        <div className="bb-skeleton" style={{ minHeight: 180 }} />
      </div>
    );
  }
  if (!summary) return null;

  const { resolution } = summary;

  const sevEntries: Array<[string, AnalyticsMttrStats]> = [
    ...SEV_ORDER.filter((k) => (resolution.by_severity[k]?.resolved_count ?? 0) > 0).map(
      (k) => [k, resolution.by_severity[k]!] as [string, AnalyticsMttrStats],
    ),
    ...Object.entries(resolution.by_severity)
      .filter(([k, s]) => !SEV_ORDER.includes(k) && s.resolved_count > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  ];
  const sevMax = Math.max(0, ...sevEntries.map(([, s]) => s.avg_hours));

  const overallMom = formatMom(resolution.mom.avg_hours);
  const cmTone = mttrCriticalMajorTone(resolution.critical_major.avg_hours);

  return (
    <section className="bb-analytics-risk" aria-label="Resolution speed">
      <div className="bb-analytics-risk__header">
        <h2>Resolution speed</h2>
        <p>Mean time to resolution (MTTR) of resolved issues in scope</p>
      </div>

      {resolution.overall.resolved_count === 0 ? (
        <p className="muted">No resolved issues with a resolution time in scope.</p>
      ) : (
        <>
          <div className="bb-analytics-risk__kpis">
            <div
              className={`bb-analytics-metric-card bb-analytics-metric-card--danger ${
                resolution.critical_major.resolved_count > 0 ? thresholdClass(cmTone) : ''
              }`.trim()}
            >
              <div className="bb-analytics-metric-card__label">MTTR Critical / Major</div>
              <div className="bb-analytics-metric-card__value">
                {resolution.critical_major.resolved_count > 0
                  ? formatHours(resolution.critical_major.avg_hours)
                  : '—'}
              </div>
              <div className="bb-analytics-risk__meta">
                {resolution.critical_major.resolved_count > 0
                  ? `median ${formatHours(resolution.critical_major.median_hours)} · ${resolution.critical_major.resolved_count} resolved`
                  : 'no Critical/Major resolved in scope'}
              </div>
              {resolution.critical_major.resolved_count > 0 && cmTone !== 'ok' ? (
                <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                  ≥ {ANALYTICS_KPI_THRESHOLDS.mttr_critical_major_warning_hours}h warning
                </div>
              ) : null}
            </div>

            <div className="bb-analytics-metric-card">
              <div className="bb-analytics-metric-card__label">MTTR overall</div>
              <div className="bb-analytics-metric-card__value">
                {formatHours(resolution.overall.avg_hours)}
              </div>
              <div className="bb-analytics-risk__meta">
                median {formatHours(resolution.overall.median_hours)} ·{' '}
                {resolution.overall.resolved_count} resolved
              </div>
              {overallMom ? (
                <div
                  className={`bb-analytics-metric-card__trend ${momClass(
                    resolution.mom.avg_hours,
                  )}`.trim()}
                >
                  {overallMom}
                </div>
              ) : null}
            </div>
          </div>

          <h3 className="bb-analytics-risk__section-title">Avg time to resolve by severity</h3>
          <div className="bb-analytics-risk__sev-list">
            {sevEntries.map(([label, stats]) => (
              <div key={label} className="bb-analytics-risk__sev-row">
                <span>{label}</span>
                <div className="bb-analytics-risk__sev-track">
                  <div
                    className="bb-analytics-risk__sev-fill"
                    style={{
                      width: sevMax ? `${(stats.avg_hours / sevMax) * 100}%` : '0%',
                    }}
                  />
                </div>
                <span title={`median ${formatHours(stats.median_hours)} · ${stats.resolved_count} resolved`}>
                  {formatHours(stats.avg_hours)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
