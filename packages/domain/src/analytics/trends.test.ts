import { describe, expect, it } from 'vitest';
import { computeMonthlyTrends, computeTrends } from './trends';
import type { AnalyticsIssueRow } from './types';

describe('computeMonthlyTrends', () => {
  it('builds contiguous monthly labels in Asia/Jakarta with bug/defect split and resolution rate', () => {
    const rows: AnalyticsIssueRow[] = [
      { project: 'A', created_date: '2024-06-15T00:00:00+07:00', is_open: false, issue_type: 'Bug' },
      { project: 'A', created_date: '2024-07-01T00:00:00+07:00', is_open: true, issue_type: 'Bug' },
      { project: 'A', created_date: '2024-07-10T00:00:00+07:00', is_open: false, issue_type: 'Defect' },
      { project: 'A', created_date: '2024-08-05T00:00:00+07:00', is_open: false, final_issue_type: 'Defect Task' },
    ];
    const result = computeMonthlyTrends(rows, '2024-08-15T00:00:00+07:00');
    expect(result.labels).toEqual(['Jun 2024', 'Jul 2024', 'Aug 2024']);
    expect(result.bugs).toEqual([1, 1, 0]);
    expect(result.defects).toEqual([0, 1, 1]);
    expect(result.total).toEqual([1, 2, 1]);
    expect(result.resolution_rate).toEqual([100, 50, 100]);
  });

  it('does not pad months past the last data month when now is later', () => {
    const rows: AnalyticsIssueRow[] = [
      { project: 'A', created_date: '2024-06-15T00:00:00+07:00', is_open: false, issue_type: 'Bug' },
      { project: 'A', created_date: '2024-07-01T00:00:00+07:00', is_open: true, issue_type: 'Bug' },
    ];
    const result = computeMonthlyTrends(rows, '2026-07-11T00:00:00+07:00');
    expect(result.labels).toEqual(['Jun 2024', 'Jul 2024']);
    expect(result.total).toEqual([1, 1]);
  });
});

describe('computeTrends inflow/outflow/net/backlog', () => {
  it('computes created (inflow), resolved (outflow), net and open backlog per month', () => {
    const rows: AnalyticsIssueRow[] = [
      // created Jun, never resolved (stays in backlog)
      { project: 'A', created_date: '2024-06-15T00:00:00+07:00', is_open: true, issue_type: 'Bug' },
      // created Jun, resolved Aug
      {
        project: 'A',
        created_date: '2024-06-20T00:00:00+07:00',
        resolved_date: '2024-08-05T00:00:00+07:00',
        is_open: false,
        issue_type: 'Defect',
      },
      // created Jul, resolved Jul
      {
        project: 'A',
        created_date: '2024-07-01T00:00:00+07:00',
        resolved_date: '2024-07-20T00:00:00+07:00',
        is_open: false,
        issue_type: 'Bug',
      },
    ];
    const result = computeTrends(rows, 'month', '2024-08-15T00:00:00+07:00');
    expect(result.labels).toEqual(['Jun 2024', 'Jul 2024', 'Aug 2024']);
    expect(result.created).toEqual([2, 1, 0]);
    expect(result.resolved).toEqual([0, 1, 1]);
    expect(result.net).toEqual([2, 0, -1]);
    expect(result.backlog).toEqual([2, 2, 1]);
    // inflow is exactly the created-bucket total
    expect(result.created).toEqual(result.total);
  });

  it('extends the period range to cover outflow past the last created period', () => {
    const rows: AnalyticsIssueRow[] = [
      {
        project: 'A',
        created_date: '2024-06-10T00:00:00+07:00',
        resolved_date: '2024-08-20T00:00:00+07:00',
        is_open: false,
        issue_type: 'Bug',
      },
    ];
    const result = computeTrends(rows, 'month', '2024-09-01T00:00:00+07:00');
    expect(result.labels).toEqual(['Jun 2024', 'Jul 2024', 'Aug 2024']);
    expect(result.created).toEqual([1, 0, 0]);
    expect(result.resolved).toEqual([0, 0, 1]);
    expect(result.backlog).toEqual([1, 1, 0]);
  });

  it('excludes closed rows without a resolved_date from outflow and backlog', () => {
    const rows: AnalyticsIssueRow[] = [
      { project: 'A', created_date: '2024-06-01T00:00:00+07:00', is_open: false, issue_type: 'Bug' },
    ];
    const result = computeTrends(rows, 'month', '2024-06-15T00:00:00+07:00');
    expect(result.created).toEqual([1]);
    expect(result.resolved).toEqual([0]);
    expect(result.net).toEqual([1]);
    expect(result.backlog).toEqual([0]);
  });

  it('accumulates open backlog across quarters', () => {
    const rows: AnalyticsIssueRow[] = [
      { project: 'A', created_date: '2024-01-10T00:00:00+07:00', is_open: true, issue_type: 'Bug' },
      { project: 'A', created_date: '2024-04-10T00:00:00+07:00', is_open: true, issue_type: 'Bug' },
    ];
    const result = computeTrends(rows, 'quarter', '2024-05-01T00:00:00+07:00');
    expect(result.labels).toEqual(['Q1 2024', 'Q2 2024']);
    expect(result.created).toEqual([1, 1]);
    expect(result.resolved).toEqual([0, 0]);
    expect(result.backlog).toEqual([1, 2]);
  });

  it('returns empty flow arrays when there is no dated data', () => {
    const result = computeTrends([], 'month', '2024-08-15T00:00:00+07:00');
    expect(result.created).toEqual([]);
    expect(result.resolved).toEqual([]);
    expect(result.net).toEqual([]);
    expect(result.backlog).toEqual([]);
  });
});
