'use client';

import type { AnalyticsSummaryResult, AnalyticsTrendsResult } from '@momus/domain';

type Props = {
  summary: AnalyticsSummaryResult | null;
  trends: AnalyticsTrendsResult | null;
  loading?: boolean;
};

const MAX_PERIODS = 12;

function formatCost(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function CostQualityPanel({ summary, trends, loading }: Props) {
  if (loading && !summary) {
    return (
      <div className="bb-analytics-risk">
        <div className="bb-skeleton" style={{ minHeight: 160 }} />
      </div>
    );
  }
  if (!summary) return null;

  const cost = trends?.cost ?? [];
  const labels = trends?.labels ?? [];
  const totalCost = cost.reduce((a, b) => a + b, 0);
  const periods = labels
    .map((label, i) => ({ label, value: cost[i] ?? 0 }))
    .slice(-MAX_PERIODS);
  const maxCost = Math.max(0, ...periods.map((p) => p.value));
  const { traceability } = summary.distribution;

  return (
    <section className="bb-analytics-risk" aria-label="Bug cost and test traceability">
      <div className="bb-analytics-risk__header">
        <h2>Bug cost &amp; test traceability</h2>
        <p>Cost of incoming issues (priority × severity weights) and test-execution linkage</p>
      </div>

      <div className="bb-analytics-risk__kpis">
        <div className="bb-analytics-metric-card">
          <div className="bb-analytics-metric-card__label">Bug cost (scope)</div>
          <div className="bb-analytics-metric-card__value">{formatCost(totalCost)}</div>
          <div className="bb-analytics-risk__meta">sum of per-issue cost in scope</div>
        </div>

        <div className="bb-analytics-metric-card">
          <div className="bb-analytics-metric-card__label">Test traceability</div>
          <div className="bb-analytics-metric-card__value">{traceability.pct}%</div>
          <div className="bb-analytics-risk__meta">
            {traceability.linked}/{traceability.total} linked to a test execution
          </div>
        </div>
      </div>

      <h3 className="bb-analytics-risk__section-title">
        Cost by period{labels.length > MAX_PERIODS ? ` (last ${MAX_PERIODS})` : ''}
      </h3>
      {periods.length === 0 || maxCost === 0 ? (
        <p className="muted">No cost data in scope.</p>
      ) : (
        <div className="bb-analytics-risk__sev-list">
          {periods.map((p) => (
            <div key={p.label} className="bb-analytics-dist__row">
              <span>{p.label}</span>
              <div className="bb-analytics-risk__sev-track">
                <div
                  className="bb-analytics-risk__sev-fill"
                  style={{ width: `${(p.value / maxCost) * 100}%` }}
                />
              </div>
              <span>{formatCost(p.value)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
