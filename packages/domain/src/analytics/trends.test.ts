import { describe, expect, it } from 'vitest';
import { computeMonthlyTrends } from './trends';
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
});
