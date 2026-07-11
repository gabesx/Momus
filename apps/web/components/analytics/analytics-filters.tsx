'use client';

import type { AnalyticsFilterParams } from '@momus/domain';

type FilterOptions = {
  projects: string[];
  years: number[];
};

type Props = {
  year: string;
  project: string;
  issue_type: '' | 'bugs' | 'defects';
  status: '' | 'open' | 'in-progress' | 'resolved' | 'closed';
  options: FilterOptions;
  scope_hint?: string;
  onChange: (patch: Partial<AnalyticsFilterParams>) => void;
  onReset: () => void;
};

export function AnalyticsFilters({
  year,
  project,
  issue_type,
  status,
  options,
  scope_hint,
  onChange,
  onReset,
}: Props) {
  const years = options.years ?? [];
  const projects = options.projects ?? [];

  return (
    <section className="settings-card bb-analytics-filters">
      <div className="bb-analytics-filter-grid">
        <label className="field">
          Year
          <select value={year} onChange={(e) => onChange({ year: e.target.value || undefined })}>
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
            value={issue_type}
            onChange={(e) =>
              onChange({
                issue_type: (e.target.value as Props['issue_type']) || undefined,
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
          <select value={project} onChange={(e) => onChange({ project: e.target.value || undefined })}>
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
            value={status}
            onChange={(e) =>
              onChange({
                status: (e.target.value as Props['status']) || undefined,
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

        <div className="bb-analytics-filter-actions">
          <button type="button" className="btn btn-outline" onClick={onReset}>
            Reset Filters
          </button>
        </div>
      </div>

      {scope_hint ? <p className="bb-analytics-scope">{scope_hint}</p> : null}
    </section>
  );
}
