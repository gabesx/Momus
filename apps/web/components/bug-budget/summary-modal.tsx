'use client';

import { useCallback, useEffect, useState } from 'react';
import { SEVERITY_ORDER, type SummaryIssue, type SummaryProject } from '@momus/domain';
import { MESSAGES } from '@momus/shared';
import { apiJson } from '@/lib/api-client';
import type { SummaryResponse } from '@/lib/bug-budget-types';

type Props = {
  kind: 'bug' | 'defect';
  open: boolean;
  onClose: () => void;
  initialYear: string;
  jiraBrowseBase?: string;
};

function yearOptions(): string[] {
  const current = new Date().getFullYear();
  const years: string[] = ['all'];
  for (let y = current + 1; y >= 2020; y--) years.push(String(y));
  return years;
}

function jiraUrl(base: string, key: string): string | null {
  if (!base || !key) return null;
  return `${base.replace(/\/$/, '')}/${key}`;
}

function ageClass(age: number | null | undefined): string {
  if (age == null) return '';
  if (age > 30) return 'bb-badge--danger';
  if (age > 7) return 'bb-badge--warning';
  return 'bb-badge--secondary';
}

export function SummaryModal({ kind, open, onClose, initialYear, jiraBrowseBase = '' }: Props) {
  const [year, setYear] = useState(initialYear || String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<SummaryProject[]>([]);

  useEffect(() => {
    if (open) setYear(initialYear || String(new Date().getFullYear()));
  }, [open, initialYear]);

  const load = useCallback(async (y: string) => {
    setLoading(true);
    setError(null);
    const path =
      kind === 'bug'
        ? `/api/bug-budget/open-bug-summary?year=${encodeURIComponent(y)}`
        : `/api/bug-budget/open-defect-summary?year=${encodeURIComponent(y)}`;
    const res = await apiJson<SummaryResponse>(path);
    setLoading(false);
    if (!res.success) {
      setError(res.message ?? 'Failed to load summary');
      setProjects([]);
      return;
    }
    setProjects(res.projects ?? []);
  }, [kind]);

  useEffect(() => {
    if (open) void load(year);
  }, [open, year, load]);

  if (!open) return null;

  const title = kind === 'bug' ? 'Open Bug Summary' : 'Open Defect Summary';
  const emptyMsg = kind === 'bug' ? MESSAGES.M09 : MESSAGES.M10;

  return (
    <div className="bb-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bb-modal__panel">
        <div className="bb-modal__head">
          <div>
            <h2>{title}</h2>
            <p className="muted">Budget status by project</p>
          </div>
          <div className="bb-dash-toolbar">
            <label className="field" style={{ margin: 0 }}>
              Year
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                {yearOptions().map((y) => (
                  <option key={y} value={y}>
                    {y === 'all' ? 'All Years' : y}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <p className="bb-summary-legend">{MESSAGES.M20}</p>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : error ? (
          <div className="settings-alert settings-alert--error">{error}</div>
        ) : projects.length === 0 ? (
          <div className="bb-empty">
            <h3>{emptyMsg}</h3>
          </div>
        ) : (
          <div className="bb-summary-grid">
            {projects.map((p) => (
              <ProjectCard
                key={p.project}
                project={p}
                kind={kind}
                jiraBrowseBase={jiraBrowseBase}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  kind,
  jiraBrowseBase,
}: {
  project: SummaryProject;
  kind: 'bug' | 'defect';
  jiraBrowseBase: string;
}) {
  const count =
    kind === 'bug' ? (project.total_open_bugs ?? 0) : (project.total_open_defects ?? 0);
  const color = project.status_color || 'success';
  const usage = Math.min(project.budget_usage_percent, 100);

  return (
    <article className="bb-summary-card">
      <header
        className={`bb-summary-card__head bb-summary-card__head--${color}`}
        title={project.status_message}
      >
        <div>
          <strong>{project.display_name}</strong>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{project.project}</div>
        </div>
        <span title={project.status_message}>●</span>
      </header>
      <div className="bb-summary-card__body">
        <div className="bb-summary-metrics">
          <span>
            <strong>{count}</strong> open
          </span>
          <span>
            Cost <strong>{project.total_cost}</strong>
          </span>
          <span>
            Left <strong>{project.remaining_budget}</strong>
          </span>
        </div>
        <div className="bb-progress">
          <div className="bb-progress__fill" style={{ width: `${usage}%` }} />
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
          {project.total_cost} / {project.budget} budget cost ({project.budget_usage_percent}%)
        </p>
        {SEVERITY_ORDER.map((sev) => {
          const issues = project.issues_by_severity[sev];
          if (!issues?.length) return null;
          return (
            <div key={sev} style={{ marginBottom: '0.75rem' }}>
              <strong style={{ fontSize: '0.85rem' }}>{sev}</strong>
              <div className="bb-table-wrap">
                <table className="bb-table">
                  <thead>
                    <tr>
                      {kind === 'bug' ? (
                        <>
                          <th>Key</th>
                          <th>Severity</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Reporter</th>
                          <th>Created</th>
                          <th>Cost</th>
                          <th>Summary</th>
                        </>
                      ) : (
                        <>
                          <th>Key</th>
                          <th>Severity</th>
                          <th>Priority</th>
                          <th>Reporter</th>
                          <th>Summary</th>
                          <th>Cost</th>
                          <th>Age</th>
                          <th>Epic/Parent</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((issue) => (
                      <IssueRow
                        key={issue.jira_key}
                        issue={issue}
                        kind={kind}
                        jiraBrowseBase={jiraBrowseBase}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function IssueKeyCell({
  jiraKey,
  jiraBrowseBase,
}: {
  jiraKey: string;
  jiraBrowseBase: string;
}) {
  const url = jiraUrl(jiraBrowseBase, jiraKey);
  if (!url) return <>{jiraKey}</>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {jiraKey}
    </a>
  );
}

function IssueRow({
  issue,
  kind,
  jiraBrowseBase,
}: {
  issue: SummaryIssue;
  kind: 'bug' | 'defect';
  jiraBrowseBase: string;
}) {
  if (kind === 'bug') {
    return (
      <tr>
        <td>
          <IssueKeyCell jiraKey={issue.jira_key} jiraBrowseBase={jiraBrowseBase} />
        </td>
        <td>{issue.severity || '—'}</td>
        <td>{issue.priority ?? '—'}</td>
        <td>{issue.status ?? '—'}</td>
        <td>{issue.reporter ?? '—'}</td>
        <td>{issue.created_date ? issue.created_date.slice(0, 10) : '—'}</td>
        <td>{issue.cost}</td>
        <td className="summary-cell" title={issue.summary ?? undefined}>
          {issue.summary ?? '—'}
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td>
        <IssueKeyCell jiraKey={issue.jira_key} jiraBrowseBase={jiraBrowseBase} />
      </td>
      <td>{issue.severity || '—'}</td>
      <td>{issue.priority ?? '—'}</td>
      <td>{issue.reporter ?? '—'}</td>
      <td className="summary-cell" title={issue.summary ?? undefined}>
        {issue.summary ?? '—'}
      </td>
      <td>{issue.cost}</td>
      <td>
        <span className={`bb-badge ${ageClass(issue.age_days)}`}>
          {issue.age_days != null ? `${issue.age_days}d` : '—'}
        </span>
      </td>
      <td>{issue.epic_parent ?? '—'}</td>
    </tr>
  );
}
