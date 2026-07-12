'use client';

import type { TrackerFilterParams, TrackerMissingFieldKey } from '@momus/domain';
import { TRACKER_MISSING_FIELD_KEYS } from '@momus/domain';

type FilterOptions = {
  projects: string[];
  years: number[];
};

type Props = {
  state: TrackerFilterParams;
  options: FilterOptions;
  scope_hint?: string;
  onChange: (patch: Partial<TrackerFilterParams>) => void;
  onReset: () => void;
};

const MISSING_FIELD_LABELS: Record<TrackerMissingFieldKey, string> = {
  summary: 'Summary',
  parent: 'Parent',
  ac_related_labels: 'AC Related Labels',
  service_feature: 'Service Feature',
  severity_issue: 'Severity',
  tester_assignee: 'Tester Assignee',
};

export function TrackerFilters({ state, options, scope_hint, onChange, onReset }: Props) {
  const years = options.years ?? [];
  const projects = options.projects ?? [];

  return (
    <section className="settings-card bb-analytics-filters">
      <div className="bb-analytics-filter-grid">
        <label className="field">
          Year
          <select
            value={state.year ? String(state.year) : ''}
            onChange={(e) => onChange({ year: e.target.value || undefined, page: 1 })}
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
          Project
          <select
            value={state.project ?? ''}
            onChange={(e) => onChange({ project: e.target.value || undefined, page: 1 })}
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
          Issue Type
          <select
            value={state.issue_type ?? ''}
            onChange={(e) =>
              onChange({
                issue_type: (e.target.value as TrackerFilterParams['issue_type']) || undefined,
                page: 1,
              })
            }
          >
            <option value="">All</option>
            <option value="bugs">Bugs</option>
            <option value="defects">Defects</option>
          </select>
        </label>

        <label className="field">
          Missing field
          <select
            value={state.missing_field ?? ''}
            onChange={(e) =>
              onChange({ missing_field: e.target.value || undefined, page: 1 })
            }
          >
            <option value="">All</option>
            {TRACKER_MISSING_FIELD_KEYS.map((key) => (
              <option key={key} value={key}>
                {MISSING_FIELD_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Search
          <input
            type="search"
            placeholder="Jira key or summary"
            value={state.q ?? ''}
            onChange={(e) => onChange({ q: e.target.value || undefined, page: 1 })}
          />
        </label>

        <div className="bb-analytics-filter-actions">
          <button type="button" className="btn btn-outline" onClick={onReset}>
            Reset Filters
          </button>
        </div>
      </div>

      {scope_hint ? <p className="muted" style={{ marginTop: '0.75rem' }}>{scope_hint}</p> : null}
    </section>
  );
}
