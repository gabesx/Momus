import { describe, expect, it } from 'vitest';
import { computeAnalyticsSummary } from './summary';
import type { AnalyticsIssueRow } from './types';

describe('computeAnalyticsSummary', () => {
  it('computes totals and MoM percent change', () => {
    const rows: AnalyticsIssueRow[] = [
      { project: 'A', created_date: '2026-07-05T00:00:00+07:00', is_open: true, final_issue_type: 'Bug', defect_age_days: 10 },
      { project: 'A', created_date: '2026-07-06T00:00:00+07:00', is_open: false, final_issue_type: 'Defect', defect_age_days: 20 },
      { project: 'A', created_date: '2026-06-01T00:00:00+07:00', is_open: false, final_issue_type: 'Bug', defect_age_days: 5 },
      { project: 'A', created_date: '2026-06-02T00:00:00+07:00', is_open: false, final_issue_type: 'Bug', defect_age_days: 5 },
      { project: 'A', created_date: '2026-06-03T00:00:00+07:00', is_open: false, final_issue_type: 'Bug', defect_age_days: 5 },
      { project: 'A', created_date: '2026-06-04T00:00:00+07:00', is_open: false, final_issue_type: 'Bug', defect_age_days: 5 },
    ];
    const result = computeAnalyticsSummary(rows, '2026-07-11T12:00:00+07:00');
    expect(result.total).toBe(6);
    expect(result.open).toBe(1);
    expect(result.resolved).toBe(5);
    expect(result.resolution_rate).toBe(83.3);
    expect(result.mom.total).toBe(-50);
  });
});
