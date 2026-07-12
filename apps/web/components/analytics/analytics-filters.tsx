'use client';

import type { AnalyticsFilterParams, AnalyticsTrendGrain } from '@momus/domain';

type FilterOptions = {
  projects: string[];
  years: number[];
};

type Props = {
  state: AnalyticsFilterParams;
  options: FilterOptions;
  scope_hint?: string;
  onChange: (patch: Partial<AnalyticsFilterParams>) => void;
  onReset: () => void;
};

export function AnalyticsFilters({ state, options, scope_hint, onChange, onReset }: Props) {
  const years = options.years ?? [];
  const projects = options.projects ?? [];
  const grain: AnalyticsTrendGrain = state.trend_grain ?? 'month';

  return (
    <section className="settings-card bb-analytics-filters">
      <div className="bb-analytics-filter-grid">
        <label className="field">
          Year
          <select
            value={state.year ? String(state.year) : ''}
            onChange={(e) => onChange({ year: e.target.value || undefined })}
          >
            <option value="">All</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Issue Type
          <select
            value={state.issue_type ?? ''}
            onChange={(e) =>
              onChange({
                issue_type: (e.target.value as AnalyticsFilterParams['issue_type']) || undefined,
              })
            }
          >
            <option value="">All</option>
            <option value="bugs">Bugs</option>
            <option value="defects">Defects</option>
          </select>
        </label>

        <label className="field">
          Project
          <select
            value={state.project ?? ''}
            onChange={(e) => onChange({ project: e.target.value || undefined })}
          >
            <option value="">All</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Status
          <select
            value={state.status ?? ''}
            onChange={(e) =>
              onChange({
                status: (e.target.value as AnalyticsFilterParams['status']) || undefined,
              })
            }
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className="field">
          Trend grain
          <select
            value={grain}
            onChange={(e) =>
              onChange({ trend_grain: e.target.value as AnalyticsTrendGrain })
            }
          >
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="year">Yearly</option>
          </select>
        </label>

        <div className="bb-analytics-filter-actions">
          <button type="button" className="btn btn-outline" onClick={onReset}>
            Reset Filters
          </button>
        </div>
      </div>

      <details className="bb-analytics-advanced" style={{ marginTop: '1rem' }}>
        <summary>Advanced filters</summary>
        <div className="bb-analytics-filter-grid" style={{ marginTop: '0.75rem' }}>
          <label className="field">
            Severity
            <select
              value={state.severity ?? ''}
              onChange={(e) => onChange({ severity: e.target.value || undefined })}
            >
              <option value="">All</option>
              <option value="Critical">Critical</option>
              <option value="Major">Major</option>
              <option value="Moderate">Moderate</option>
              <option value="Minor">Minor</option>
              <option value="Low">Low</option>
            </select>
          </label>
          <label className="field">
            AC related
            <select
              value={state.ac_related ?? ''}
              onChange={(e) =>
                onChange({
                  ac_related: (e.target.value as AnalyticsFilterParams['ac_related']) || undefined,
                })
              }
            >
              <option value="">All</option>
              <option value="yes">AC-related</option>
              <option value="no">Not AC-related</option>
            </select>
          </label>
          <label className="field">
            Priority
            <select
              value={state.priority ?? ''}
              onChange={(e) => onChange({ priority: e.target.value || undefined })}
            >
              <option value="">All</option>
              <option value="Highest">Highest</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Lowest">Lowest</option>
              <option value="__none__">No priority</option>
            </select>
          </label>
          <label className="field">
            Date from
            <input
              type="date"
              value={state.date_from ?? ''}
              onChange={(e) => onChange({ date_from: e.target.value || undefined })}
            />
          </label>
          <label className="field">
            Date to
            <input
              type="date"
              value={state.date_to ?? ''}
              onChange={(e) => onChange({ date_to: e.target.value || undefined })}
            />
          </label>
        </div>
      </details>

      {scope_hint ? <p className="muted" style={{ marginTop: '0.75rem' }}>{scope_hint}</p> : null}
    </section>
  );
}
