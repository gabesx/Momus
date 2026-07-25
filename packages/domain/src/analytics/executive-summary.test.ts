import { describe, expect, it } from 'vitest';
import { computeExecutiveSummary, isReleaseBlocking } from './executive-summary';
import type { AnalyticsIssueRow } from './types';

const now = '2026-07-25T00:00:00Z'; // this week: 07-18..07-25

function row(p: Partial<AnalyticsIssueRow> & Pick<AnalyticsIssueRow, 'project' | 'is_open'>): AnalyticsIssueRow {
  return { issue_type: 'Bug', ...p };
}

describe('isReleaseBlocking', () => {
  it('is true only for open Highest + Critical', () => {
    const base = { project: 'A', is_open: true, priority: 'Highest', severity_issue: 'Critical' };
    expect(isReleaseBlocking(row(base))).toBe(true);
    expect(isReleaseBlocking(row({ ...base, is_open: false }))).toBe(false);
    expect(isReleaseBlocking(row({ ...base, priority: 'High' }))).toBe(false);
    expect(isReleaseBlocking(row({ ...base, severity_issue: 'Major' }))).toBe(false);
  });
});

describe('computeExecutiveSummary', () => {
  const rows: AnalyticsIssueRow[] = [
    // open release-blocker, older
    row({ project: 'AL', real_project: 'AL', is_open: true, priority: 'Highest', severity_issue: 'Critical', jira_key: 'AL-1', summary: 'Checkout down', assignee_final: 'Dewi', reporter: 'Budi', defect_age_days: 40, created_date: '2026-06-01T00:00:00Z' }),
    // open release-blocker, newer (created this week)
    row({ project: 'AL', real_project: 'AL', is_open: true, priority: 'Highest', severity_issue: 'Critical', jira_key: 'AL-2', summary: 'Payment fails', engineer_assignee: 'Sari', reporter: 'Budi', defect_age_days: 3, created_date: '2026-07-20T00:00:00Z' }),
    // open, not blocking, other squad
    row({ project: 'AO', real_project: 'AO', is_open: true, priority: 'High', severity_issue: 'Major', created_date: '2026-07-21T00:00:00Z' }),
    // resolved this week
    row({ project: 'AO', real_project: 'AO', is_open: false, created_date: '2026-07-10T00:00:00Z', resolved_date: '2026-07-22T00:00:00Z' }),
  ];
  const s = computeExecutiveSummary(rows, now);

  it('reports open backlog and this-week flow', () => {
    expect(s.total_open).toBe(3); // AL-1, AL-2, AO-open
    expect(s.created_this_week).toBe(2); // AL-2, AO major
    expect(s.resolved_this_week).toBe(1);
    expect(s.net_this_week).toBe(1);
  });

  it('lists release blockers oldest-first with owner/reporter', () => {
    expect(s.release_blocking_count).toBe(2);
    expect(s.release_blockers.map((b) => b.jira_key)).toEqual(['AL-1', 'AL-2']);
    expect(s.release_blockers[0]).toMatchObject({
      jira_key: 'AL-1',
      assignee: 'Dewi',
      reporter: 'Budi',
      severity: 'Critical',
      priority: 'Highest',
    });
    // falls back to engineer_assignee when assignee is absent
    expect(s.release_blockers[1].assignee).toBe('Sari');
  });

  it('identifies the squad with the most open issues', () => {
    expect(s.top_squad).toEqual({ key: 'AL', open: 2 });
  });

  it('handles empty scope', () => {
    const e = computeExecutiveSummary([], now);
    expect(e.total_open).toBe(0);
    expect(e.release_blockers).toEqual([]);
    expect(e.top_squad).toBeNull();
  });
});
