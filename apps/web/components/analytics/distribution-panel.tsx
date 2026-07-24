'use client';

import { useState } from 'react';
import type { AnalyticsDistributionEntry, AnalyticsSummaryResult } from '@momus/domain';
import { ListModal } from './list-modal';

type Props = {
  summary: AnalyticsSummaryResult | null;
  loading?: boolean;
  /** Year filter to carry into Tracker drill-through links */
  year?: string;
};

const TOP_N = 8;

function trackerHref(drillKey: 'squad' | 'service' | 'engineer', value: string, year?: string) {
  const sp = new URLSearchParams({ tab: 'all', year: year || 'all' });
  sp.set(drillKey, value);
  return `/tracker?${sp.toString()}`;
}

function DistList({
  title,
  entries,
  metric,
  drillKey,
  year,
}: {
  title: string;
  entries: AnalyticsDistributionEntry[];
  /** Which count drives the bar and the number shown */
  metric: 'total' | 'open';
  drillKey: 'squad' | 'service' | 'engineer';
  year?: string;
}) {
  const [open, setOpen] = useState(false);
  const top = entries.slice(0, TOP_N);
  const rest = entries.length - top.length;
  const max = Math.max(0, ...entries.map((e) => e[metric]));

  const renderRow = (e: AnalyticsDistributionEntry) => (
    <a
      key={e.key}
      className="bb-analytics-dist__row bb-analytics-dist__row--link"
      href={trackerHref(drillKey, e.key, year)}
      title={`${e.open} open (${e.open_critical_major} critical/major) of ${e.total} total — open in Tracker`}
    >
      <span>{e.key}</span>
      <div className="bb-analytics-risk__sev-track">
        <div
          className="bb-analytics-risk__sev-fill"
          style={{ width: max ? `${(e[metric] / max) * 100}%` : '0%' }}
        />
      </div>
      <span>{e[metric]}</span>
    </a>
  );

  return (
    <div>
      <h3 className="bb-analytics-risk__section-title">{title}</h3>
      {top.length === 0 ? (
        <p className="muted">No issues in scope.</p>
      ) : (
        <div className="bb-analytics-risk__sev-list">
          {top.map(renderRow)}
          {rest > 0 ? (
            <button
              type="button"
              className="btn btn-ghost bb-analytics-dist__more"
              onClick={() => setOpen(true)}
            >
              +{rest} more
            </button>
          ) : null}
        </div>
      )}
      <ListModal open={open} title={title} onClose={() => setOpen(false)}>
        <div className="bb-analytics-risk__sev-list">{entries.map(renderRow)}</div>
      </ListModal>
    </div>
  );
}

export function DistributionPanel({ summary, loading, year }: Props) {
  if (loading && !summary) {
    return (
      <div className="bb-analytics-risk">
        <div className="bb-skeleton" style={{ minHeight: 200 }} />
      </div>
    );
  }
  if (!summary) return null;

  const { distribution } = summary;

  return (
    <section className="bb-analytics-risk" aria-label="Defect distribution">
      <div className="bb-analytics-risk__header">
        <h2>Where defects concentrate</h2>
        <p>Issues by squad and service, and open workload per engineer</p>
      </div>

      <div className="bb-analytics-dist__cols">
        <DistList
          title="By squad"
          entries={distribution.by_squad}
          metric="total"
          drillKey="squad"
          year={year}
        />
        <DistList
          title="By service / feature"
          entries={distribution.by_service}
          metric="total"
          drillKey="service"
          year={year}
        />
        <DistList
          title="Engineer workload (open)"
          entries={distribution.by_engineer.filter((e) => e.open > 0)}
          metric="open"
          drillKey="engineer"
          year={year}
        />
      </div>
    </section>
  );
}
