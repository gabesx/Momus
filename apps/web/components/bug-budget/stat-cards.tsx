'use client';

import type { StatsResult, StatCardId } from '@momus/domain';
import { MESSAGES } from '@momus/shared';

type Props = {
  stats: StatsResult | null;
  loading?: boolean;
  onSelect: (id: StatCardId) => void;
};

export function StatCards({ stats, loading, onSelect }: Props) {
  if (loading && !stats) {
    return (
      <div className="bb-stat-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bb-skeleton" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="bb-stat-grid">
      <button
        type="button"
        className="bb-stat-card bb-stat-card--clickable bb-stat-card--primary"
        onClick={() => onSelect('total')}
      >
        <div className="bb-stat-card__label">Total Issues</div>
        <div className="bb-stat-card__value">{stats.total}</div>
        <div className="bb-stat-card__meta">
          {stats.bugs} bugs · {stats.defects} defects
        </div>
      </button>

      <button
        type="button"
        className="bb-stat-card bb-stat-card--clickable bb-stat-card--danger"
        onClick={() => onSelect('open')}
      >
        <div className="bb-stat-card__label">Open Issues</div>
        <div className="bb-stat-card__value">{stats.open}</div>
        <div className="bb-stat-card__meta">{stats.open_rate}% of current view</div>
      </button>

      <button
        type="button"
        className="bb-stat-card bb-stat-card--clickable bb-stat-card--success"
        onClick={() => onSelect('closed')}
      >
        <div className="bb-stat-card__label">Closed Issues</div>
        <div className="bb-stat-card__value">{stats.closed}</div>
      </button>

      <button
        type="button"
        className="bb-stat-card bb-stat-card--clickable bb-stat-card--critical"
        onClick={() => onSelect('critical')}
      >
        <div className="bb-stat-card__label">Open Critical / Major</div>
        <div className="bb-stat-card__value">{stats.open_critical_major}</div>
        <div className="bb-stat-card__meta">
          {stats.open_critical} critical · {stats.open_high_priority} high priority
        </div>
      </button>

      <button
        type="button"
        className="bb-stat-card bb-stat-card--clickable bb-stat-card--info"
        onClick={() => onSelect('recent')}
      >
        <div className="bb-stat-card__label">Recent (30d)</div>
        <div className="bb-stat-card__value">{stats.recent}</div>
      </button>

      <div className="bb-stat-card bb-stat-card--neutral">
        <div className="bb-stat-card__label">Avg Age (days)</div>
        <div className="bb-stat-card__value">{Math.round(stats.avg_age)}</div>
        <div className="bb-stat-card__meta">{MESSAGES.M02}</div>
      </div>
    </div>
  );
}
