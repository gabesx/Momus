import { describe, expect, it } from 'vitest';
import { computeProductHealth, hasDigestContent, listProductsByRisk, weeklySeries } from './product-health';
import type { AnalyticsIssueRow } from './types';

const now = '2026-07-25T00:00:00Z'; // this week: 07-18..07-25

function row(p: Partial<AnalyticsIssueRow> & Pick<AnalyticsIssueRow, 'project' | 'is_open'>): AnalyticsIssueRow {
  return { issue_type: 'Bug', ...p };
}

const rows: AnalyticsIssueRow[] = [
  // AL — open Critical/Highest (release blocker), old
  row({ project: 'AL', real_project: 'AL', is_open: true, severity_issue: 'Critical', priority: 'Highest', jira_key: 'AL-1', summary: 'Refund', defect_age_days: 40, created_date: '2026-06-01T00:00:00Z' }),
  // AL — open Major, created this week
  row({ project: 'AL', real_project: 'AL', is_open: true, severity_issue: 'Major', priority: 'High', jira_key: 'AL-2', defect_age_days: 5, created_date: '2026-07-20T00:00:00Z' }),
  // AL — resolved this week
  row({ project: 'AL', real_project: 'AL', is_open: false, created_date: '2026-07-10T00:00:00Z', resolved_date: '2026-07-22T00:00:00Z' }),
  // AO — open Minor, no priority
  row({ project: 'AO', real_project: 'AO', is_open: true, severity_issue: 'Minor', jira_key: 'AO-1', defect_age_days: 12, created_date: '2026-07-01T00:00:00Z' }),
];

describe('listProductsByRisk', () => {
  it('orders products by open Critical/Major desc', () => {
    expect(listProductsByRisk(rows)).toEqual(['AL', 'AO']); // AL has 2 crit/major open, AO 0
  });
});

describe('weeklySeries', () => {
  it('returns N oldest-first weekly points', () => {
    const s = weeklySeries(rows, now, 8);
    expect(s).toHaveLength(8);
    expect(s[0].week_start < s[7].week_start).toBe(true);
    // the most recent week (last point) captures AL-2 created + one resolved
    expect(s[7]).toMatchObject({ created: 1, resolved: 1 });
  });
});

describe('computeProductHealth', () => {
  const h = computeProductHealth(rows, 'AL', now);

  it('scopes to the product and counts open by severity/priority', () => {
    expect(h.open_total).toBe(2); // AL-1, AL-2
    expect(h.open_by_severity).toEqual({ Critical: 1, Major: 1 });
    expect(h.open_by_priority).toEqual({ Highest: 1, High: 1 });
  });

  it('reports this-week flow scoped to the product', () => {
    expect(h.this_week).toEqual({ created: 1, resolved: 1, net: 0 });
  });

  it('ranks top open by severity then age, and lists release blockers', () => {
    expect(h.top_open.map((i) => i.jira_key)).toEqual(['AL-1', 'AL-2']); // Critical before Major
    expect(h.oldest_open[0].jira_key).toBe('AL-1'); // 40d oldest
    expect(h.release_blockers.map((i) => i.jira_key)).toEqual(['AL-1']);
  });

  it('carries an 8-week trend', () => {
    expect(h.trend_8w).toHaveLength(8);
  });

  it('handles a product with no rows', () => {
    const empty = computeProductHealth(rows, 'NOPE', now);
    expect(empty.open_total).toBe(0);
    expect(empty.top_open).toEqual([]);
    expect(empty.release_blockers).toEqual([]);
  });
});

describe('hasDigestContent', () => {
  it('includes products with open bugs even when nothing happened this week', () => {
    expect(hasDigestContent(computeProductHealth(rows, 'AO', now))).toBe(true);
  });

  it('includes products with only this-week activity (e.g. all resolved)', () => {
    const resolvedOnly: AnalyticsIssueRow[] = [
      row({ project: 'FIN', real_project: 'FIN', is_open: false, created_date: '2026-07-19T00:00:00Z', resolved_date: '2026-07-21T00:00:00Z' }),
    ];
    expect(hasDigestContent(computeProductHealth(resolvedOnly, 'FIN', now))).toBe(true);
  });

  it('excludes products with no open bugs and no activity this week', () => {
    expect(hasDigestContent(computeProductHealth(rows, 'NOPE', now))).toBe(false);
  });
});
