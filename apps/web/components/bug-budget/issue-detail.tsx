'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { priorityColor, statusColor } from '@momus/domain';
import { apiJson } from '@/lib/api-client';

type DetailResponse = {
  success: boolean;
  message?: string;
  issue?: Record<string, unknown>;
  jira_browse_url?: string | null;
};

function str(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

export function IssueDetail() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id;
  const autoRaw = search.get('debug') === 'true' || search.get('raw') === 'true';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<Record<string, unknown> | null>(null);
  const [jiraUrl, setJiraUrl] = useState<string | null>(null);
  const [rawOpen, setRawOpen] = useState(autoRaw);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await apiJson<DetailResponse>(`/api/bug-budget/${encodeURIComponent(id)}`);
      if (cancelled) return;
      setLoading(false);
      if (!res.success || !res.issue) {
        setError(res.message ?? 'Not found');
        setIssue(null);
        return;
      }
      setIssue(res.issue);
      setJiraUrl(res.jira_browse_url ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const labels = useMemo(() => {
    const raw = issue?.labels;
    if (Array.isArray(raw)) return raw.map(String);
    return [];
  }, [issue]);

  if (loading) {
    return (
      <main className="bb-detail">
        <div className="bb-skeleton" style={{ minHeight: 200 }} />
      </main>
    );
  }

  if (error || !issue) {
    return (
      <main className="bb-detail">
        <Link href="/bug-budget" className="btn btn-outline">
          ← Back
        </Link>
        <div className="settings-alert settings-alert--error" style={{ marginTop: '1rem' }}>
          {error ?? 'Not found'}
        </div>
      </main>
    );
  }

  const key = str(issue.jira_key);
  const status = str(issue.status);
  const priority = str(issue.priority);

  return (
    <main className="bb-detail">
      <div className="bb-dash-toolbar" style={{ marginBottom: '1rem' }}>
        <Link href="/bug-budget" className="btn btn-outline">
          ← Back
        </Link>
        {jiraUrl ? (
          <a className="btn btn-primary" href={jiraUrl} target="_blank" rel="noopener noreferrer">
            Open in Jira
          </a>
        ) : null}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <span className="bb-badge" style={{ fontSize: '1rem', marginRight: '0.5rem' }}>
          {key}
        </span>
        <span className={`bb-badge bb-badge--${statusColor(status)}`}>{status}</span>{' '}
        <span className={`bb-badge bb-badge--${priorityColor(priority)}`}>{priority}</span>
        <h2 style={{ margin: '0.75rem 0 0.25rem' }}>{str(issue.summary)}</h2>
        <p className="muted">
          {str(issue.project)} · {str(issue.issue_type ?? issue.final_issue_type)}
        </p>
      </div>

      <div className="bb-detail-grid">
        <section className="settings-card">
          <h3>Issue Details</h3>
          <dl className="kv">
            <div>
              <dt>Project</dt>
              <dd>{str(issue.project)}</dd>
            </div>
            <div>
              <dt>Issue Type</dt>
              <dd>{str(issue.issue_type ?? issue.final_issue_type)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {status}{' '}
                <span className="bb-badge">{issue.is_open ? 'Open' : 'Closed'}</span>
              </dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{priority}</dd>
            </div>
            <div>
              <dt>Severity</dt>
              <dd>{str(issue.severity_issue)}</dd>
            </div>
            <div>
              <dt>Assignee</dt>
              <dd>{str(issue.assignee_final) === '—' ? 'Unassigned' : str(issue.assignee_final)}</dd>
            </div>
            <div>
              <dt>Reporter</dt>
              <dd>{str(issue.reporter)}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>
                {issue.defect_age_days != null ? `${issue.defect_age_days} days old` : '—'}
              </dd>
            </div>
          </dl>

          {labels.length > 0 ? (
            <>
              <h4>Labels</h4>
              <div className="bb-dash-toolbar">
                {labels.map((l) => (
                  <span key={l} className="bb-badge">
                    {l}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <div>
          <section className="settings-card">
            <h3>Timeline</h3>
            <dl className="kv">
              <div>
                <dt>Created</dt>
                <dd>{str(issue.created_date)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{str(issue.updated_at)}</dd>
              </div>
              <div>
                <dt>Resolved</dt>
                <dd>{str(issue.resolved_date)}</dd>
              </div>
              <div>
                <dt>Last Synced</dt>
                <dd>{str(issue.synced_at ?? issue.updated_at)}</dd>
              </div>
            </dl>
          </section>

          <section className="settings-card">
            <h3>Important Dates</h3>
            <dl className="kv">
              <div>
                <dt>Due</dt>
                <dd>{str(issue.due_date)}</dd>
              </div>
              <div>
                <dt>End</dt>
                <dd>{str(issue.end_date)}</dd>
              </div>
              <div>
                <dt>Actual End</dt>
                <dd>{str(issue.actual_end)}</dd>
              </div>
              <div>
                <dt>Quarter</dt>
                <dd>{str(issue.quarter)}</dd>
              </div>
            </dl>
          </section>

          {(issue.story_points != null || issue.bug_cost != null) && (
            <section className="settings-card">
              <h3>Work Info</h3>
              <dl className="kv">
                <div>
                  <dt>Story Points</dt>
                  <dd>{str(issue.story_points)}</dd>
                </div>
                <div>
                  <dt>Bug Cost</dt>
                  <dd>{str(issue.bug_cost)}</dd>
                </div>
              </dl>
            </section>
          )}
        </div>
      </div>

      <section className="settings-card">
        <button type="button" className="btn btn-ghost" onClick={() => setRawOpen((v) => !v)}>
          {rawOpen ? 'Hide' : 'Show'} Raw JIRA Data
        </button>
        {rawOpen ? (
          <pre>{JSON.stringify(issue.raw_jira_data ?? issue, null, 2)}</pre>
        ) : null}
      </section>
    </main>
  );
}
