'use client';

import type { TrackerFilterParams, TrackerMissingFieldKey } from '@momus/domain';
import { TRACKER_MISSING_FIELD_LABELS } from '@momus/domain';

type MissingFieldOption = { value: string; label: string };

type FilterOptions = {
  projects: string[];
  years: number[];
  missing_fields?: MissingFieldOption[];
};

type Props = {
  /** Draft filter values edited in the panel (applied on Apply). */
  draft: TrackerFilterParams;
  options: FilterOptions;
  open: boolean;
  onDraftChange: (patch: Partial<TrackerFilterParams>) => void;
  onApply: () => void;
  onReset: () => void;
};

export function TrackerFilters({
  draft,
  options,
  open,
  onDraftChange,
  onApply,
  onReset,
}: Props) {
  if (!open) return null;

  const years = options.years ?? [];
  const missingFields = options.missing_fields ?? [];
  const projects = options.projects ?? [];
  const excluded = new Set(draft.exclude_projects ?? []);

  const toggleExclude = (project: string) => {
    const next = new Set(excluded);
    if (next.has(project)) next.delete(project);
    else next.add(project);
    onDraftChange({
      exclude_projects: next.size ? [...next].sort((a, b) => a.localeCompare(b)) : undefined,
      page: 1,
    });
  };

  return (
    <section className="bb-tracker-advanced-filters">
      <div className="bb-tracker-filter-grid">
        <label className="field">
          Issue Type
          <select
            value={draft.issue_type ?? ''}
            onChange={(e) =>
              onDraftChange({
                issue_type: (e.target.value as TrackerFilterParams['issue_type']) || undefined,
                page: 1,
              })
            }
          >
            <option value="">All Issues</option>
            <option value="bugs">Bug</option>
            <option value="defects">Defect Group</option>
          </select>
        </label>

        <label className="field">
          Missing Field
          <select
            value={draft.missing_field ?? ''}
            onChange={(e) =>
              onDraftChange({ missing_field: e.target.value || undefined, page: 1 })
            }
          >
            <option value="">All Missing Fields</option>
            {missingFields.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Missing {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Year
          <select
            value={draft.year != null && draft.year !== '' ? String(draft.year) : 'all'}
            onChange={(e) => onDraftChange({ year: e.target.value || 'all', page: 1 })}
          >
            <option value="all">All Years</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Search
          <input
            type="search"
            placeholder="Search by JIRA key or summary"
            value={draft.q ?? ''}
            onChange={(e) => onDraftChange({ q: e.target.value || undefined, page: 1 })}
          />
        </label>
      </div>

      {projects.length ? (
        <div className="bb-tracker-exclude">
          <div className="bb-tracker-exclude__label">
            <span className="bb-tracker-exclude__icon" aria-hidden>
              −
            </span>
            Exclude Projects
          </div>
          <div className="bb-tracker-exclude__list">
            {projects.map((project) => {
              const checked = excluded.has(project);
              return (
                <label
                  key={project}
                  className={`bb-tracker-exclude__item${checked ? ' is-checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleExclude(project)}
                  />
                  <span>{project}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="bb-tracker-filter-footer">
        <button type="button" className="btn btn-primary" onClick={onApply}>
          Apply
        </button>
        <button type="button" className="btn btn-outline" onClick={onReset}>
          Reset
        </button>
      </div>
    </section>
  );
}

export function TrackerActiveChips({
  state,
  onRemove,
}: {
  state: TrackerFilterParams;
  onRemove: (
    key:
      | 'year'
      | 'issue_type'
      | 'missing_field'
      | 'q'
      | 'project'
      | 'exclude_projects'
      | 'squad'
      | 'service'
      | 'engineer',
  ) => void;
}) {
  const chips: {
    key:
      | 'year'
      | 'issue_type'
      | 'missing_field'
      | 'q'
      | 'project'
      | 'exclude_projects'
      | 'squad'
      | 'service'
      | 'engineer';
    label: string;
  }[] = [];

  if (state.year && state.year !== 'all') {
    chips.push({ key: 'year', label: `Year: ${state.year}` });
  } else if (state.year === 'all') {
    chips.push({ key: 'year', label: 'All Years' });
  }
  if (state.issue_type === 'bugs') chips.push({ key: 'issue_type', label: 'Issue Type: Bug' });
  if (state.issue_type === 'defects') {
    chips.push({ key: 'issue_type', label: 'Issue Type: Defect Group' });
  }
  if (state.missing_field && state.missing_field !== 'all') {
    const label =
      TRACKER_MISSING_FIELD_LABELS[state.missing_field as TrackerMissingFieldKey] ??
      state.missing_field;
    chips.push({ key: 'missing_field', label: `Missing: ${label}` });
  }
  if (state.q) chips.push({ key: 'q', label: `Search: ${state.q}` });
  if (state.project) chips.push({ key: 'project', label: `Project: ${state.project}` });
  if (state.exclude_projects?.length) {
    chips.push({
      key: 'exclude_projects',
      label: `Excluded: ${state.exclude_projects.join(', ')}`,
    });
  }
  if (state.squad) chips.push({ key: 'squad', label: `Squad: ${state.squad}` });
  if (state.service) chips.push({ key: 'service', label: `Service: ${state.service}` });
  if (state.engineer) chips.push({ key: 'engineer', label: `Engineer: ${state.engineer}` });

  if (!chips.length) return null;

  return (
    <div className="bb-tracker-chips">
      {chips.map((chip) => (
        <span key={chip.key + chip.label} className="bb-tracker-chip">
          {chip.label}
          <button
            type="button"
            className="bb-tracker-chip__remove"
            aria-label={`Remove ${chip.label}`}
            onClick={() => onRemove(chip.key)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export function TrackerProjectNav({
  projects,
  active,
  total,
  onSelect,
}: {
  projects: { project: string; count: number }[];
  active?: string | null;
  total: number;
  onSelect: (project: string | undefined) => void;
}) {
  return (
    <div className="bb-tracker-project-nav">
      <span className="bb-tracker-project-nav__label">Filter by Project:</span>
      <div className="bb-tracker-project-nav__scroll">
        <button
          type="button"
          className={`bb-tracker-project-chip${!active ? ' is-active' : ''}`}
          onClick={() => onSelect(undefined)}
        >
          All
          <span className="bb-tracker-project-chip__count">{total}</span>
        </button>
        {projects.map((p) => (
          <button
            key={p.project}
            type="button"
            className={`bb-tracker-project-chip${active === p.project ? ' is-active' : ''}`}
            onClick={() => onSelect(p.project)}
          >
            {p.project}
            <span className="bb-tracker-project-chip__count">{p.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
