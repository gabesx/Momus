'use client';

import {
  ageBadgeColor,
  isRecent,
  priorityColor,
  severityColor,
  statusColor,
  type DashboardQueryState,
} from '@momus/domain';
import { MESSAGES } from '@momus/shared';
import type { ColumnId } from '@/lib/bug-budget-columns';
import { COLUMN_DEFS } from '@/lib/bug-budget-columns';
import type { BugBudgetIssueRow } from '@/lib/bug-budget-types';

type Pagination = {
  page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
  last_page: number;
};

type Props = {
  issues: BugBudgetIssueRow[];
  pagination: Pagination | null;
  jiraBrowseBase: string;
  visible: Record<ColumnId, boolean>;
  state: DashboardQueryState;
  loading?: boolean;
  notice?: string | null;
  onChange: (next: DashboardQueryState) => void;
  onClearFilters: () => void;
  exportHref: string;
};

function jiraUrl(base: string, key: string): string | null {
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${key}`;
}

function formatCreated(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
}

function truncate(text: string | null | undefined, n = 140): string {
  if (!text) return '—';
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

function sortValue(state: DashboardQueryState): string {
  const sort = state.sort ?? 'created_date';
  const dir = state.direction ?? 'desc';
  return `${sort}:${dir}`;
}

const SORT_OPTIONS: { label: string; sort: string; direction: string }[] = [
  { label: 'Newest First', sort: 'created_date', direction: 'desc' },
  { label: 'Oldest First', sort: 'created_date', direction: 'asc' },
  { label: 'Priority', sort: 'priority', direction: 'desc' },
  { label: 'Severity', sort: 'severity_issue', direction: 'desc' },
  { label: 'Project', sort: 'project', direction: 'asc' },
  { label: 'Assignee', sort: 'assignee_final', direction: 'asc' },
  { label: 'Recently Closed', sort: 'end_date', direction: 'desc' },
  { label: 'Oldest Issues', sort: 'defect_age_days', direction: 'desc' },
];

export function IssuesTable({
  issues,
  pagination,
  jiraBrowseBase,
  visible,
  state,
  loading,
  notice,
  onChange,
  onClearFilters,
  exportHref,
}: Props) {
  const cols = COLUMN_DEFS.filter((c) => visible[c.id]);

  const openRow = (key: string) => {
    const url = jiraUrl(jiraBrowseBase, key);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const pageButtons = () => {
    if (!pagination) return null;
    const last = pagination.last_page;
    const current = pagination.page;
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(last, current + 2);
    for (let p = start; p <= end; p++) pages.push(p);
    return (
      <div className="bb-pagination__pages">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={current <= 1}
          onClick={() => onChange({ ...state, page: String(current - 1) })}
        >
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`btn ${p === current ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onChange({ ...state, page: String(p) })}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={current >= last}
          onClick={() => onChange({ ...state, page: String(current + 1) })}
        >
          ›
        </button>
      </div>
    );
  };

  return (
    <section className="settings-card">
      <div className="bb-table-toolbar">
        <h2>
          Bug/Defect Issues
          {pagination ? <span className="bb-count-badge">{pagination.total}</span> : null}
        </h2>
        <div className="bb-dash-toolbar">
          {pagination ? (
            <span className="muted">
              Showing {pagination.from} to {pagination.to} of {pagination.total} results
            </span>
          ) : null}
          <label className="field" style={{ margin: 0 }}>
            Per page
            <select
              value={state.per_page ?? '25'}
              onChange={(e) => {
                if (e.target.value === 'export') {
                  window.location.href = exportHref;
                  return;
                }
                onChange({ ...state, per_page: e.target.value, page: '1' });
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="export">Export all (CSV)</option>
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            Sort
            <select
              value={sortValue(state)}
              onChange={(e) => {
                const [sort, direction] = e.target.value.split(':');
                onChange({ ...state, sort, direction, page: '1' });
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={`${o.sort}:${o.direction}`} value={`${o.sort}:${o.direction}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {notice ? <p className="hint">{notice}</p> : null}

      {loading && issues.length === 0 ? (
        <div className="bb-skeleton" style={{ minHeight: 180 }} />
      ) : issues.length === 0 ? (
        <div className="bb-empty">
          <h3>{MESSAGES.M05}</h3>
          <p>{MESSAGES.M06}</p>
          <button type="button" className="btn btn-outline" onClick={onClearFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          <div className="bb-table-wrap">
            <table className="bb-table">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.id}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {issues.map((row) => {
                  const url = jiraUrl(jiraBrowseBase, row.jira_key);
                  const now = new Date().toISOString();
                  return (
                    <tr key={row.jira_key} onClick={() => openRow(row.jira_key)}>
                      {cols.map((c) => (
                        <td key={c.id}>
                          {renderCell(c.id, row, url, now)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bb-pagination">
            <span className="muted">
              Page {pagination?.page ?? 1} of {pagination?.last_page ?? 1}
            </span>
            {pageButtons()}
          </div>
        </>
      )}
    </section>
  );
}

function renderCell(
  id: ColumnId,
  row: BugBudgetIssueRow,
  url: string | null,
  now: string,
) {
  switch (id) {
    case 'key':
      return url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {row.jira_key}
        </a>
      ) : (
        row.jira_key
      );
    case 'project':
      return <span className="bb-badge">{row.project}</span>;
    case 'summary':
      return (
        <span className="summary-cell" title={row.summary ?? undefined}>
          {truncate(row.summary)}
        </span>
      );
    case 'status':
      return (
        <span className={`bb-badge bb-badge--${statusColor(row.status)}`}>
          {row.status ?? '—'}
        </span>
      );
    case 'priority':
      return (
        <span className={`bb-badge bb-badge--${priorityColor(row.priority)}`}>
          {row.priority ?? '—'}
        </span>
      );
    case 'severity':
      return (
        <span className={`bb-badge bb-badge--${severityColor(row.severity_issue)}`}>
          {row.severity_issue ?? '—'}
        </span>
      );
    case 'assignee':
      return row.assignee_final || 'Unassigned';
    case 'tested_by':
      return row.tested_by || '—';
    case 'reporter':
      return row.reporter || '—';
    case 'created':
      return formatCreated(row.created_date);
    case 'age': {
      const age = row.defect_age_days;
      return (
        <>
          <span className={`bb-badge bb-badge--${ageBadgeColor(age)}`}>
            {age != null ? `${age}d` : '—'}
          </span>
          {isRecent(row.created_date, now) ? (
            <span className="bb-badge bb-badge--new">NEW</span>
          ) : null}
        </>
      );
    }
    case 'issue_type':
      return row.issue_type || row.final_issue_type || '—';
    case 'closed':
      return row.is_open ? 'Open' : 'Closed';
    case 'complete_date':
      return formatCreated(row.actual_end ?? row.end_date);
    case 'resolution_date':
      return formatCreated(row.resolved_date);
    default:
      return '—';
  }
}
