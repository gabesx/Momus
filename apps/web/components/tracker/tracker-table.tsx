'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { TrackerEditableField, TrackerIssueRow, TrackerMissingFieldKey } from '@momus/domain';
import {
  getMissingDescriptionFields,
  getMissingFields,
  TRACKER_MISSING_FIELD_LABELS,
} from '@momus/domain';

type FieldOption = { id: string; value: string };

type Props = {
  rows: TrackerIssueRow[];
  total: number;
  page: number;
  page_size: number;
  loading?: boolean;
  jiraBrowseBase: string;
  /** Table layout: missing-fields columns vs no-test-link columns vs default. */
  view?: 'missing_fields' | 'no_linked_test' | 'all';
  excludedFields?: string[];
  severityOptions?: FieldOption[];
  serviceFeatureOptions?: FieldOption[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onPatchField: (
    jiraKey: string,
    field: TrackerEditableField,
    value: unknown,
  ) => Promise<{ ok: true; row: TrackerIssueRow } | { ok: false; message: string }>;
};

function jiraUrl(base: string, key: string): string | null {
  if (!base || !key) return null;
  return `${base.replace(/\/$/, '')}/${key}`;
}

function truncate(text: string | null | undefined, n = 120): string {
  if (!text) return 'N/A';
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(d);
}

function formatLabels(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
}

function issueTypeClass(issueType: string | null | undefined): string {
  const t = (issueType ?? '').toLowerCase();
  if (t.includes('bug')) return 'bb-tracker-type bb-tracker-type--bug';
  return 'bb-tracker-type bb-tracker-type--defect';
}

function severityClass(severity: string | null | undefined): string {
  const s = (severity ?? '').toLowerCase();
  if (s.includes('critical') || s.includes('blocker')) return 'bb-tracker-severity bb-tracker-severity--critical';
  if (s.includes('major') || s.includes('high')) return 'bb-tracker-severity bb-tracker-severity--high';
  if (s.includes('moderate') || s.includes('medium')) return 'bb-tracker-severity bb-tracker-severity--medium';
  if (s.includes('minor') || s.includes('low')) return 'bb-tracker-severity bb-tracker-severity--low';
  return 'bb-tracker-severity';
}

function formatLinkedIssues(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value || '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          const e = entry as { key?: string; type?: string };
          if (e.key && e.type) return `${e.key} (${e.type})`;
          if (e.key) return String(e.key);
        }
        return String(entry);
      })
      .filter(Boolean)
      .join(', ');
  }
  return JSON.stringify(value);
}

function LinkedIssuesCell({
  value,
  jiraBrowseBase,
}: {
  value: unknown;
  jiraBrowseBase: string;
}) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="bb-tracker-empty">—</span>;
  }
  return (
    <div className="bb-tracker-linked">
      {value.map((entry, idx) => {
        if (!entry || typeof entry !== 'object') {
          return (
            <span key={idx} className="bb-tracker-linked-item">
              {String(entry)}
            </span>
          );
        }
        const e = entry as { key?: string; type?: string };
        const key = e.key ?? '';
        const type = e.type ?? '';
        const url = key ? jiraUrl(jiraBrowseBase, key) : null;
        const isTestExec = typeof type === 'string' && /test execution/i.test(type);
        return (
          <span
            key={`${key}-${type}-${idx}`}
            className={`bb-tracker-linked-item${isTestExec ? ' is-test-execution' : ''}`}
          >
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="bb-tracker-jira">
                {key}
              </a>
            ) : (
              key || '—'
            )}
            {type ? <span className="bb-tracker-linked-type">{type}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

function statusClass(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (!s) return 'bb-tracker-status';
  if (s.includes('done') || s.includes('closed') || s.includes('resolved')) {
    return 'bb-tracker-status bb-tracker-status--done';
  }
  if (s.includes('progress') || s.includes('review')) {
    return 'bb-tracker-status bb-tracker-status--progress';
  }
  if (s.includes('open') || s.includes('to do') || s.includes('backlog')) {
    return 'bb-tracker-status bb-tracker-status--open';
  }
  return 'bb-tracker-status';
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
      return row.parent?.trim() ? row.parent : '';
    case 'severity_issue':
      return row.severity_issue?.trim() ? row.severity_issue : '';
    case 'service_feature':
      return row.service_feature?.trim() ? row.service_feature : '';
    case 'linked_issues':
      return formatLinkedIssues(row.linked_issues);
    default:
      return '';
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
  jiraBrowseBase: string;
  options?: FieldOption[];
  onPatchField: Props['onPatchField'];
  onError: (jiraKey: string, message: string | null) => void;
};

function EditableCell({
  row,
  field,
  jiraBrowseBase,
  options,
  onPatchField,
  onError,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const overridden = Boolean(row.tracker_overrides?.[field]);
  const display = fieldDisplayValue(row, field);
  const isSelectField = field === 'severity_issue' || field === 'service_feature';
  const selectOptions = options ?? [];

  useEffect(() => {
    if (!editing) return;
    if (isSelectField) selectRef.current?.focus();
    else inputRef.current?.focus();
  }, [editing, isSelectField]);

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

  const commitValue = async (nextRaw: string) => {
    if (saving) return;

    let parsed: unknown;
    try {
      parsed = parseFieldInput(field, nextRaw);
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

  if (editing && isSelectField) {
    const known = new Set(selectOptions.map((o) => o.value));
    return (
      <div className="bb-tracker-edit-wrap" onClick={(e) => e.stopPropagation()}>
        <select
          ref={selectRef}
          className="bb-tracker-edit-select"
          value={draft}
          disabled={saving || selectOptions.length === 0}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            void commitValue(next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          }}
          onBlur={() => {
            if (!saving) cancelEdit();
          }}
        >
          <option value="">N/A</option>
          {display && !known.has(display) ? (
            <option value={display}>{display} (current)</option>
          ) : null}
          {selectOptions.map((opt) => (
            <option key={opt.id} value={opt.value}>
              {opt.value}
            </option>
          ))}
        </select>
        {selectOptions.length === 0 ? (
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            No options loaded
          </span>
        ) : null}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="bb-tracker-edit-wrap">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          disabled={saving}
          className="bb-tracker-edit-input"
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commitValue(draft);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          }}
          onBlur={() => {
            void commitValue(draft);
          }}
        />
      </div>
    );
  }

  let body: ReactNode;
  if (field === 'parent') {
    if (!display) {
      body = <span className="bb-tracker-empty">No Parent</span>;
    } else {
      const url = jiraUrl(jiraBrowseBase, display);
      body = url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="bb-tracker-parent-link">
          {display}
        </a>
      ) : (
        display
      );
    }
  } else if (field === 'severity_issue') {
    body = display ? (
      <span className={severityClass(display)}>{display}</span>
    ) : (
      <span className="bb-tracker-empty">N/A</span>
    );
  } else if (field === 'service_feature') {
    body = display ? display : <span className="bb-tracker-empty">N/A</span>;
  } else {
    body = display || <span className="bb-tracker-empty">N/A</span>;
  }

  return (
    <span
      className="bb-tracker-editable"
      onClick={startEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startEdit(e as unknown as React.MouseEvent);
        }
      }}
    >
      {body}
      <button
        type="button"
        className="bb-tracker-edit-btn"
        title={`Edit ${field}`}
        onClick={startEdit}
      >
        ✎
      </button>
      {overridden ? <span className="bb-badge bb-badge--info">overridden</span> : null}
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
  view = 'all',
  excludedFields = [],
  severityOptions = [],
  serviceFeatureOptions = [],
  onPageChange,
  onPageSizeChange,
  onPatchField,
}: Props) {
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const showMissingBadges = view === 'missing_fields';
  const showNoLinkedTest = view === 'no_linked_test';
  const lastPage = Math.max(1, Math.ceil(total / page_size));
  const from = total === 0 ? 0 : (page - 1) * page_size + 1;
  const to = Math.min(page * page_size, total);
  const colSpan = showNoLinkedTest ? 9 : showMissingBadges ? 15 : 13;

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
    <section className="bb-tracker-results">
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
          <div className="bb-table-wrap bb-tracker-table-wrap">
            <table className="bb-table bb-tracker-table">
              <thead>
                <tr>
                  {showNoLinkedTest ? (
                    <>
                      <th>Issue Type</th>
                      <th>JIRA Key</th>
                      <th>Summary</th>
                      <th>Reporter</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Description</th>
                      <th>Linked Issues</th>
                      <th>Parent</th>
                    </>
                  ) : (
                    <>
                      <th>Issue Type</th>
                      <th>JIRA Key</th>
                      <th>Summary</th>
                      {showMissingBadges ? <th>Missing Fields</th> : null}
                      <th>Reporter</th>
                      <th>Creator</th>
                      <th>Owner/Ownership</th>
                      <th>Created Date</th>
                      <th>End Date</th>
                      <th>Parent</th>
                      <th>Description</th>
                      <th>Labels</th>
                      <th>Severity</th>
                      <th>Service/Feature</th>
                      {showMissingBadges ? <th>Missing Description Fields</th> : null}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const url = jiraUrl(jiraBrowseBase, row.jira_key);
                  const missing = getMissingFields(row, excludedFields);
                  const missingDescription = getMissingDescriptionFields(row.description);
                  const labels = formatLabels(row.labels);
                  const rowError = rowErrors[row.jira_key];
                  return (
                    <Fragment key={row.jira_key}>
                      <tr>
                        {showNoLinkedTest ? (
                          <>
                            <td>
                              <span className={issueTypeClass(row.issue_type)}>
                                {row.issue_type ?? '—'}
                              </span>
                            </td>
                            <td>
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bb-tracker-jira"
                                >
                                  {row.jira_key}
                                </a>
                              ) : (
                                row.jira_key
                              )}
                            </td>
                            <td>
                              <span title={row.summary ?? undefined}>
                                {truncate(row.summary, 90)}
                              </span>
                            </td>
                            <td>{row.reporter || 'N/A'}</td>
                            <td>{row.project || '—'}</td>
                            <td>
                              <span className={statusClass(row.status)}>
                                {row.status || '—'}
                              </span>
                            </td>
                            <td>
                              <span title={row.description ?? undefined}>
                                {truncate(row.description, 80)}
                              </span>
                            </td>
                            <td>
                              <LinkedIssuesCell
                                value={row.linked_issues}
                                jiraBrowseBase={jiraBrowseBase}
                              />
                            </td>
                            <td>
                              <EditableCell
                                row={row}
                                field="parent"
                                jiraBrowseBase={jiraBrowseBase}
                                onPatchField={onPatchField}
                                onError={setRowError}
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td>
                              <span className={issueTypeClass(row.issue_type)}>
                                {row.issue_type ?? '—'}
                              </span>
                            </td>
                            <td>
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bb-tracker-jira"
                                >
                                  {row.jira_key}
                                </a>
                              ) : (
                                row.jira_key
                              )}
                            </td>
                            <td>
                              <span title={row.summary ?? undefined}>
                                {truncate(row.summary, 90)}
                              </span>
                            </td>
                            {showMissingBadges ? (
                              <td>
                                <div className="bb-tracker-missing">
                                  {missing.length === 0 ? (
                                    '—'
                                  ) : (
                                    missing.map((key) => (
                                      <span key={key} className="bb-tracker-missing-badge">
                                        {TRACKER_MISSING_FIELD_LABELS[
                                          key as TrackerMissingFieldKey
                                        ] ?? key}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </td>
                            ) : null}
                            <td>{row.reporter || 'N/A'}</td>
                            <td>{row.creator || 'N/A'}</td>
                            <td>{row.owner || row.tester_assignee || 'N/A'}</td>
                            <td>{formatDate(row.created_date)}</td>
                            <td>{formatDate(row.end_date)}</td>
                            <td>
                              <EditableCell
                                row={row}
                                field="parent"
                                jiraBrowseBase={jiraBrowseBase}
                                onPatchField={onPatchField}
                                onError={setRowError}
                              />
                            </td>
                            <td>
                              <span title={row.description ?? undefined}>
                                {truncate(row.description, 80)}
                              </span>
                            </td>
                            <td>
                              <div className="bb-tracker-labels">
                                {labels.length === 0 ? (
                                  <span className="bb-tracker-empty">N/A</span>
                                ) : (
                                  <>
                                    {labels.slice(0, 3).map((label) => (
                                      <span key={label} className="bb-tracker-label">
                                        {label}
                                      </span>
                                    ))}
                                    {labels.length > 3 ? (
                                      <span className="bb-tracker-label bb-tracker-label--more">
                                        +{labels.length - 3}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            </td>
                            <td>
                              <EditableCell
                                row={row}
                                field="severity_issue"
                                jiraBrowseBase={jiraBrowseBase}
                                options={severityOptions}
                                onPatchField={onPatchField}
                                onError={setRowError}
                              />
                            </td>
                            <td>
                              <EditableCell
                                row={row}
                                field="service_feature"
                                jiraBrowseBase={jiraBrowseBase}
                                options={serviceFeatureOptions}
                                onPatchField={onPatchField}
                                onError={setRowError}
                              />
                            </td>
                            {showMissingBadges ? (
                              <td>
                                <div className="bb-tracker-missing">
                                  {missingDescription.length === 0 ? (
                                    '—'
                                  ) : (
                                    missingDescription.map((label) => (
                                      <span key={label} className="bb-tracker-missing-badge">
                                        {label}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </td>
                            ) : null}
                          </>
                        )}
                      </tr>
                      {rowError ? (
                        <tr>
                          <td colSpan={colSpan}>
                            <span
                              className="settings-alert settings-alert--error"
                              style={{ margin: 0 }}
                            >
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
