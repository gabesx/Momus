'use client';

import type { AnalyticsSummaryResult } from '@momus/domain';

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

type CardConfig = {
  key: keyof AnalyticsSummaryResult['mom'];
  label: string;
  value: string;
  variant: string;
  sentiment: Sentiment;
};

function cardsFromSummary(summary: AnalyticsSummaryResult): CardConfig[] {
  return [
    {
      key: 'total',
      label: 'Total Issues',
      value: String(summary.total),
      variant: 'bb-analytics-metric-card--primary',
      sentiment: 'higher-is-bad',
    },
    {
      key: 'open',
      label: 'Open Issues',
      value: String(summary.open),
      variant: 'bb-analytics-metric-card--danger',
      sentiment: 'higher-is-bad',
    },
    {
      key: 'resolved',
      label: 'Resolved Issues',
      value: String(summary.resolved),
      variant: 'bb-analytics-metric-card--success',
      sentiment: 'higher-is-good',
    },
    {
      key: 'resolution_rate',
      label: 'Resolution Rate',
      value: `${summary.resolution_rate}%`,
      variant: 'bb-analytics-metric-card--info',
      sentiment: 'higher-is-good',
    },
    {
      key: 'avg_age',
      label: 'Avg Age (days)',
      value: String(Math.round(summary.avg_age)),
      variant: '',
      sentiment: 'lower-is-good',
    },
  ];
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

  const cards = cardsFromSummary(summary);

  return (
    <div className="bb-analytics-metrics">
      {cards.map((card) => {
        const mom = summary.mom[card.key];
        const momText = formatMom(mom);
        const trendClass = momText ? momClass(mom, card.sentiment) : '';

        return (
          <div key={card.key} className={`bb-analytics-metric-card ${card.variant}`.trim()}>
            <div className="bb-analytics-metric-card__label">{card.label}</div>
            <div className="bb-analytics-metric-card__value">{card.value}</div>
            {momText ? (
              <div className={`bb-analytics-metric-card__trend ${trendClass}`.trim()}>{momText}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
