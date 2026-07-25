import { describe, expect, it } from 'vitest';
import { buildWeeklyDigest, computeWeeklyDigest } from './weekly-digest';
import type { AnalyticsIssueRow } from './types';

const now = '2026-07-25T00:00:00Z'; // windows: this=07-18..07-25, prev=07-11..07-18

function row(p: Partial<AnalyticsIssueRow> & Pick<AnalyticsIssueRow, 'project' | 'is_open'>): AnalyticsIssueRow {
  return { issue_type: 'Bug', ...p };
}

const rows: AnalyticsIssueRow[] = [
  // this week: created + still open (Critical)
  row({ project: 'AL', real_project: 'AL', is_open: true, severity_issue: 'Critical', created_date: '2026-07-20T00:00:00Z' }),
  // this week: created + resolved same week
  row({ project: 'AL', real_project: 'AL', is_open: false, created_date: '2026-07-21T00:00:00Z', resolved_date: '2026-07-23T00:00:00Z' }),
  // created before windows, resolved this week
  row({ project: 'X', is_open: false, created_date: '2026-07-10T00:00:00Z', resolved_date: '2026-07-22T00:00:00Z' }),
  // prev week: created + still open
  row({ project: 'AO', real_project: 'AO', is_open: true, created_date: '2026-07-13T00:00:00Z' }),
  // prev week: created + resolved same week
  row({ project: 'X', is_open: false, created_date: '2026-07-14T00:00:00Z', resolved_date: '2026-07-15T00:00:00Z' }),
  // old, still open, Major + long overdue
  row({ project: 'X', is_open: true, severity_issue: 'Major', created_date: '2026-05-01T00:00:00Z', defect_age_days: 100 }),
];

describe('computeWeeklyDigest', () => {
  const d = computeWeeklyDigest(rows, now);

  it('counts created/resolved/net in the right rolling windows', () => {
    expect(d.this_week).toEqual({ created: 2, resolved: 2, net: 0 });
    expect(d.prev_week).toEqual({ created: 2, resolved: 1, net: 1 });
  });

  it('reconciles backlog change with this-week net', () => {
    expect(d.backlog_now).toBe(3); // A, D, F open
    expect(d.backlog_prev).toBe(3); // C, D, F open a week ago
    expect(d.backlog_now - d.backlog_prev).toBe(d.this_week.net);
  });

  it('exposes the current-state snapshot', () => {
    expect(d.open_critical_major).toBe(2); // Critical (A) + Major (F)
    expect(d.open_long_overdue).toBe(1); // F
  });

  it('ranks squads by issues created this week', () => {
    expect(d.top_squads).toEqual([{ key: 'AL', created: 2 }]);
  });

  it('handles empty scope', () => {
    const e = computeWeeklyDigest([], now);
    expect(e.this_week).toEqual({ created: 0, resolved: 0, net: 0 });
    expect(e.backlog_now).toBe(0);
    expect(e.top_squads).toEqual([]);
  });
});

describe('buildWeeklyDigest', () => {
  const d = computeWeeklyDigest(rows, now);

  it('renders WoW deltas and the snapshot with a Slack link', () => {
    const text = buildWeeklyDigest(d, {
      dateLabel: '2026-07-25',
      dashboardUrl: 'https://momus.example.com/',
      linkStyle: 'slack',
    });
    expect(text).toContain('*Momus weekly defect digest — 2026-07-25*');
    expect(text).toContain('• Created: 2 (→ 0% WoW)'); // this 2 vs prev 2
    expect(text).toContain('• Resolved: 2 (↑ +100% WoW)'); // this 2 vs prev 1
    expect(text).toContain('• Net this week: +0 — backlog 3 → 3');
    expect(text).toContain('2 Critical/Major · 1 long overdue');
    expect(text).toContain('Top squads (created this week): AL (2)');
    expect(text).toContain('<https://momus.example.com/|Open the dashboard>');
  });

  it('uses a plain link for non-Slack providers and marks new activity from zero', () => {
    const text = buildWeeklyDigest(
      { ...d, prev_week: { created: 0, resolved: 0, net: 0 } },
      { dateLabel: '2026-07-25', dashboardUrl: 'https://momus.example.com/', linkStyle: 'plain' },
    );
    expect(text).toContain('• Created: 2 (↑ new)');
    expect(text).toContain('Open the dashboard: https://momus.example.com/');
    expect(text).not.toContain('<https://momus.example.com/|');
  });
});
