'use client';

import {
  ANALYTICS_KPI_THRESHOLDS,
  avgAgeTone,
  openIssuesTone,
  resolutionRateTone,
  type AnalyticsSummaryResult,
} from '@momus/domain';

type Props = {
  summary: AnalyticsSummaryResult | null;
  loading?: boolean;
};

type Sentiment = 'higher-is-bad' | 'higher-is-good' | 'lower-is-good';

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

export function SummaryCards({ summary, loading }: Props) {
  if (loading && !summary) {
    return (
      <div className="bb-analytics-metrics">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bb-skeleton" style={{ minHeight: 88 }} />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const cards = [
    {
      key: 'total' as const,
      label: 'Total Issues',
      value: String(summary.total),
      variant: 'bb-analytics-metric-card--primary',
      sentiment: 'higher-is-bad' as const,
      threshold: '' as string,
    },
    {
      key: 'open' as const,
      label: 'Open Issues',
      value: String(summary.open),
      variant: 'bb-analytics-metric-card--danger',
      sentiment: 'higher-is-bad' as const,
      threshold: thresholdClass(openIssuesTone(summary.open)),
      hint:
        summary.open >= ANALYTICS_KPI_THRESHOLDS.open_warning
          ? `≥ ${ANALYTICS_KPI_THRESHOLDS.open_warning} warning`
          : undefined,
    },
    {
      key: 'resolved' as const,
      label: 'Resolved Issues',
      value: String(summary.resolved),
      variant: 'bb-analytics-metric-card--success',
      sentiment: 'higher-is-good' as const,
      threshold: '',
    },
    {
      key: 'resolution_rate' as const,
      label: 'Resolution Rate',
      value: `${summary.resolution_rate}%`,
      variant: 'bb-analytics-metric-card--info',
      sentiment: 'higher-is-good' as const,
      threshold: thresholdClass(resolutionRateTone(summary.resolution_rate)),
      hint:
        summary.resolution_rate < ANALYTICS_KPI_THRESHOLDS.resolution_rate_healthy_pct
          ? `< ${ANALYTICS_KPI_THRESHOLDS.resolution_rate_healthy_pct}% healthy`
          : undefined,
    },
    {
      key: 'avg_age' as const,
      label: 'Avg Age (days)',
      value: String(Math.round(summary.avg_age)),
      variant: '',
      sentiment: 'lower-is-good' as const,
      threshold: thresholdClass(avgAgeTone(summary.avg_age)),
      hint:
        summary.avg_age >= ANALYTICS_KPI_THRESHOLDS.avg_age_warning_days
          ? `≥ ${ANALYTICS_KPI_THRESHOLDS.avg_age_warning_days}d warning`
          : undefined,
    },
  ];

  return (
    <div className="bb-analytics-metrics">
      {cards.map((card) => {
        const mom = summary.mom[card.key];
        const momText = formatMom(mom);
        const trendClass = momText ? momClass(mom, card.sentiment) : '';

        return (
          <div
            key={card.key}
            className={`bb-analytics-metric-card ${card.variant} ${card.threshold}`.trim()}
          >
            <div className="bb-analytics-metric-card__label">{card.label}</div>
            <div className="bb-analytics-metric-card__value">{card.value}</div>
            {momText ? (
              <div className={`bb-analytics-metric-card__trend ${trendClass}`.trim()}>{momText}</div>
            ) : null}
            {card.hint ? (
              <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                {card.hint}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
