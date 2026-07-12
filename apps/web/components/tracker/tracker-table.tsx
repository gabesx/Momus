'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import type { TrackerEditableField, TrackerIssueRow } from '@momus/domain';
import { getMissingFields } from '@momus/domain';

type Props = {
  rows: TrackerIssueRow[];
  total: number;
  page: number;
  page_size: number;
  loading?: boolean;
  jiraBrowseBase: string;
  showMissingBadges?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onPatchField: (
    jiraKey: string,
    field: TrackerEditableField,
    value: unknown,
  ) => Promise<{ ok: true; row: TrackerIssueRow } | { ok: false; message: string }>;
};

function jiraUrl(base: string, key: string): string | null {
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${key}`;
}

function truncate(text: string | null | undefined, n = 140): string {
  if (!text) return '—';
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

function formatLinkedIssues(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value || '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map(String).join(', ');
  }
  return JSON.stringify(value);
}

function linkedIssuesToEditValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseLinkedIssuesInput(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as unknown;
  }
  return trimmed;
}

function fieldDisplayValue(row: TrackerIssueRow, field: TrackerEditableField): string {
  switch (field) {
    case 'parent':
      return row.parent ?? '—';
    case 'severity_issue':
      return row.severity_issue ?? '—';
    case 'service_feature':
      return row.service_feature ?? '—';
    case 'linked_issues':
      return formatLinkedIssues(row.linked_issues);
    default:
      return '—';
  }
}

function fieldRawValue(row: TrackerIssueRow, field: TrackerEditableField): unknown {
  switch (field) {
    case 'parent':
      return row.parent;
    case 'severity_issue':
      return row.severity_issue;
    case 'service_feature':
      return row.service_feature;
    case 'linked_issues':
      return row.linked_issues;
    default:
      return null;
  }
}

function parseFieldInput(field: TrackerEditableField, raw: string): unknown {
  if (field === 'linked_issues') {
    return parseLinkedIssuesInput(raw);
  }
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

type EditableCellProps = {
  row: TrackerIssueRow;
  field: TrackerEditableField;
  onPatchField: Props['onPatchField'];
  onError: (jiraKey: string, message: string | null) => void;
};

function EditableCell({ row, field, onPatchField, onError }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overridden = Boolean(row.tracker_overrides?.[field]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;
    onError(row.jira_key, null);
    setDraft(
      field === 'linked_issues'
        ? linkedIssuesToEditValue(fieldRawValue(row, field))
        : String(fieldRawValue(row, field) ?? ''),
    );
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  const commitEdit = async () => {
    if (!editing || saving) return;

    let parsed: unknown;
    try {
      parsed = parseFieldInput(field, draft);
    } catch {
      onError(row.jira_key, 'Invalid linked_issues JSON');
      return;
    }

    const current = fieldRawValue(row, field);
    const unchanged =
      field === 'linked_issues'
        ? JSON.stringify(current ?? null) === JSON.stringify(parsed ?? null)
        : (current ?? null) === parsed;
    if (unchanged) {
      cancelEdit();
      return;
    }

    setSaving(true);
    const result = await onPatchField(row.jira_key, field, parsed);
    setSaving(false);

    if (!result.ok) {
      onError(row.jira_key, result.message);
      return;
    }

    onError(row.jira_key, null);
    cancelEdit();
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        disabled={saving}
        style={{ width: '100%', minWidth: 120 }}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commitEdit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
          }
        }}
        onBlur={() => {
          void commitEdit();
        }}
      />
    );
  }

  return (
    <span
      className="bb-editable-cell"
      style={{ cursor: 'pointer' }}
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startEdit(e as unknown as React.MouseEvent);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {fieldDisplayValue(row, field)}
      {overridden ? (
        <span className="bb-badge bb-badge--info" style={{ marginLeft: '0.35rem' }}>
          overridden
        </span>
      ) : null}
    </span>
  );
}

export function TrackerTable({
  rows,
  total,
  page,
  page_size,
  loading,
  jiraBrowseBase,
  showMissingBadges,
  onPageChange,
  onPageSizeChange,
  onPatchField,
}: Props) {
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const lastPage = Math.max(1, Math.ceil(total / page_size));
  const from = total === 0 ? 0 : (page - 1) * page_size + 1;
  const to = Math.min(page * page_size, total);

  const setRowError = (jiraKey: string, message: string | null) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      if (message) next[jiraKey] = message;
      else delete next[jiraKey];
      return next;
    });
  };

  const pageButtons = () => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(lastPage, page + 2);
    for (let p = start; p <= end; p++) pages.push(p);
    return (
      <div className="bb-pagination__pages">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`btn ${p === page ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
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
          Issues
          <span className="bb-count-badge">{total}</span>
        </h2>
        <div className="bb-dash-toolbar">
          <span className="muted">
            Showing {from} to {to} of {total} results
          </span>
          <label className="field" style={{ margin: 0 }}>
            Per page
            <select
              value={String(page_size)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="bb-skeleton" style={{ minHeight: 180 }} />
      ) : rows.length === 0 ? (
        <div className="bb-empty">
          <h3>No issues found</h3>
          <p>Try adjusting filters or switching tabs.</p>
        </div>
      ) : (
        <>
          <div className="bb-table-wrap">
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Jira Key</th>
                  <th>Summary</th>
                  <th>Project</th>
                  <th>Issue Type</th>
                  <th>Parent</th>
                  <th>Severity</th>
                  <th>Service Feature</th>
                  <th>Linked Issues</th>
                  {showMissingBadges ? <th>Missing</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const url = jiraUrl(jiraBrowseBase, row.jira_key);
                  const missing = getMissingFields(row, []);
                  const rowError = rowErrors[row.jira_key];
                  return (
                    <Fragment key={row.jira_key}>
                      <tr>
                        <td>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              {row.jira_key}
                            </a>
                          ) : (
                            row.jira_key
                          )}
                        </td>
                        <td>
                          <span className="summary-cell" title={row.summary ?? undefined}>
                            {truncate(row.summary)}
                          </span>
                        </td>
                        <td>
                          <span className="bb-badge">{row.project}</span>
                        </td>
                        <td>{row.issue_type ?? '—'}</td>
                        <td>
                          <EditableCell
                            row={row}
                            field="parent"
                            onPatchField={onPatchField}
                            onError={setRowError}
                          />
                        </td>
                        <td>
                          <EditableCell
                            row={row}
                            field="severity_issue"
                            onPatchField={onPatchField}
                            onError={setRowError}
                          />
                        </td>
                        <td>
                          <EditableCell
                            row={row}
                            field="service_feature"
                            onPatchField={onPatchField}
                            onError={setRowError}
                          />
                        </td>
                        <td>
                          <EditableCell
                            row={row}
                            field="linked_issues"
                            onPatchField={onPatchField}
                            onError={setRowError}
                          />
                        </td>
                        {showMissingBadges ? (
                          <td>
                            {missing.length === 0 ? (
                              '—'
                            ) : (
                              missing.map((key) => (
                                <span
                                  key={key}
                                  className="bb-badge bb-badge--warning"
                                  style={{ marginRight: '0.25rem' }}
                                >
                                  {key}
                                </span>
                              ))
                            )}
                          </td>
                        ) : null}
                      </tr>
                      {rowError ? (
                        <tr>
                          <td colSpan={showMissingBadges ? 9 : 8}>
                            <span className="settings-alert settings-alert--error" style={{ margin: 0 }}>
                              {row.jira_key}: {rowError}
                            </span>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bb-pagination">
            <span className="muted">
              Page {page} of {lastPage}
            </span>
            {pageButtons()}
          </div>
        </>
      )}
    </section>
  );
}
