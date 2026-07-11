'use client';

import type { DashboardQueryState, FilterOptions } from '@momus/domain';

type Props = {
  state: DashboardQueryState;
  options: FilterOptions | null;
  activeCount: number;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: DashboardQueryState) => void;
  onReset: () => void;
};

function setField(
  state: DashboardQueryState,
  key: string,
  value: string,
  onChange: (patch: DashboardQueryState) => void,
) {
  const next: DashboardQueryState = { ...state, page: '1' };
  if (!value) delete next[key];
  else next[key] = value;
  onChange(next);
}

function setAge(
  state: DashboardQueryState,
  min: string | undefined,
  max: string | undefined,
  onChange: (patch: DashboardQueryState) => void,
) {
  const next: DashboardQueryState = { ...state, page: '1' };
  if (min) next.age_min = min;
  else delete next.age_min;
  if (max) next.age_max = max;
  else delete next.age_max;
  onChange(next);
}

export function FilterPanel({
  state,
  options,
  activeCount,
  open,
  onToggle,
  onChange,
  onReset,
}: Props) {
  const projects = options?.projects ?? [];
  const statuses = options?.statuses ?? [];
  const issueTypes = options?.issue_types ?? [];
  const reporters = options?.reporters ?? [];
  const years = options?.years ?? [];

  return (
    <section className="settings-card">
      <button type="button" className="btn btn-outline bb-filters-toggle" onClick={onToggle}>
        Filters ({activeCount}) {open ? '▴' : '▾'}
      </button>
      {open ? (
        <div className="bb-filters-body">
          <label className="field">
            Project
            <select
              value={state.project ?? ''}
              onChange={(e) => setField(state, 'project', e.target.value, onChange)}
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
              onChange={(e) => setField(state, 'status', e.target.value, onChange)}
            >
              <option value="">All</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Status Category
            <select
              value={state.status_category ?? ''}
              onChange={(e) => setField(state, 'status_category', e.target.value, onChange)}
            >
              <option value="">All</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </label>

          <label className="field">
            Issue Type
            <select
              value={state.issue_type ?? ''}
              onChange={(e) => setField(state, 'issue_type', e.target.value, onChange)}
            >
              <option value="">All</option>
              {issueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Issue Group
            <select
              value={state.issue_type_group ?? ''}
              onChange={(e) => setField(state, 'issue_type_group', e.target.value, onChange)}
            >
              <option value="">All</option>
              <option value="bug">Bug</option>
              <option value="defect">Defect</option>
            </select>
          </label>

          <label className="field">
            Reporter
            <select
              value={state.reporter ?? ''}
              onChange={(e) => setField(state, 'reporter', e.target.value, onChange)}
            >
              <option value="">All</option>
              {reporters.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Year
            <select
              value={state.year ?? ''}
              onChange={(e) => setField(state, 'year', e.target.value, onChange)}
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
            Quarter
            <select
              value={state.quarter ?? ''}
              onChange={(e) => setField(state, 'quarter', e.target.value, onChange)}
            >
              <option value="">All</option>
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </label>

          <label className="field">
            AC Related
            <select
              value={state.ac_related ?? ''}
              onChange={(e) => setField(state, 'ac_related', e.target.value, onChange)}
            >
              <option value="">All</option>
              <option value="ac_related">AC-related</option>
              <option value="non_ac_related">Non-AC-related</option>
            </select>
          </label>

          <label className="field">
            Assignee
            <input
              type="text"
              value={state.assignee ?? ''}
              placeholder="Contains…"
              onChange={(e) => setField(state, 'assignee', e.target.value, onChange)}
            />
          </label>

          <label className="field">
            Date From
            <input
              type="date"
              value={state.date_from ?? ''}
              onChange={(e) => setField(state, 'date_from', e.target.value, onChange)}
            />
          </label>

          <label className="field">
            Date To
            <input
              type="date"
              value={state.date_to ?? ''}
              onChange={(e) => setField(state, 'date_to', e.target.value, onChange)}
            />
          </label>

          <div className="bb-filters-actions field-span-2">
            <span className="muted">Age:</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAge(state, undefined, '6', onChange)}
            >
              &lt;7d
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAge(state, '7', '30', onChange)}
            >
              7–30d
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAge(state, '30', '120', onChange)}
            >
              30–120d
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAge(state, '121', undefined, onChange)}
            >
              &gt;120d
            </button>
          </div>

          <label className="bb-switch">
            <input
              type="checkbox"
              checked={Boolean(state.show_all)}
              onChange={(e) =>
                setField(state, 'show_all', e.target.checked ? '1' : '', onChange)
              }
            />
            Show all issue types
          </label>

          <label className="bb-switch">
            <input
              type="checkbox"
              checked={Boolean(state.include_all_projects)}
              onChange={(e) =>
                setField(state, 'include_all_projects', e.target.checked ? '1' : '', onChange)
              }
            />
            Include excluded projects
          </label>

          <label className="bb-switch">
            <input
              type="checkbox"
              checked={Boolean(state.not_done)}
              onChange={(e) =>
                setField(state, 'not_done', e.target.checked ? '1' : '', onChange)
              }
            />
            Exclude Done statuses (Not Done)
          </label>

          <div className="bb-filters-actions">
            <button type="button" className="btn btn-outline" onClick={onReset}>
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
