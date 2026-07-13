'use client';

import type { AnalyticsDistributionEntry, AnalyticsSummaryResult } from '@momus/domain';

type Props = {
  summary: AnalyticsSummaryResult | null;
  loading?: boolean;
};

const TOP_N = 8;

function DistList({
  title,
  entries,
  metric,
}: {
  title: string;
  entries: AnalyticsDistributionEntry[];
  /** Which count drives the bar and the number shown */
  metric: 'total' | 'open';
}) {
  const top = entries.slice(0, TOP_N);
  const rest = entries.length - top.length;
  const max = Math.max(0, ...top.map((e) => e[metric]));

  return (
    <div>
      <h3 className="bb-analytics-risk__section-title">{title}</h3>
      {top.length === 0 ? (
        <p className="muted">No issues in scope.</p>
      ) : (
        <div className="bb-analytics-risk__sev-list">
          {top.map((e) => (
            <div
              key={e.key}
              className="bb-analytics-dist__row"
              title={`${e.open} open (${e.open_critical_major} critical/major) of ${e.total} total`}
            >
              <span>{e.key}</span>
              <div className="bb-analytics-risk__sev-track">
                <div
                  className="bb-analytics-risk__sev-fill"
                  style={{ width: max ? `${(e[metric] / max) * 100}%` : '0%' }}
                />
              </div>
              <span>{e[metric]}</span>
            </div>
          ))}
          {rest > 0 ? <p className="muted bb-analytics-dist__more">+{rest} more</p> : null}
        </div>
      )}
    </div>
  );
}

export function DistributionPanel({ summary, loading }: Props) {
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
        <DistList title="By squad" entries={distribution.by_squad} metric="total" />
        <DistList title="By service / feature" entries={distribution.by_service} metric="total" />
        <DistList
          title="Engineer workload (open)"
          entries={distribution.by_engineer.filter((e) => e.open > 0)}
          metric="open"
        />
      </div>
    </section>
  );
}
