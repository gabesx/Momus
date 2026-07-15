import { describe, expect, it } from 'vitest';
import {
  LEADERBOARD_COLUMNS,
  exclusiveEndAfterInclusiveYmd,
} from './bug-budget-query';

describe('leaderboard query helpers', () => {
  it('selects exactly the 15 leaderboard fields', () => {
    const cols = LEADERBOARD_COLUMNS.split(',').map((s) => s.trim());
    expect(cols).toEqual([
      'reporter',
      'issue_type',
      'project',
      'status',
      'created_date',
      'jira_key',
      'summary',
      'severity_issue',
      'priority',
      'parent',
      'service_feature',
      'ac_related_labels',
      'labels',
      'tester_assignee',
      'owner',
    ]);
  });

  it('maps inclusive YYYY-MM-DD end to exclusive next-day bound', () => {
    expect(exclusiveEndAfterInclusiveYmd('2026-06-30')).toBe('2026-07-01');
    expect(exclusiveEndAfterInclusiveYmd('2026-12-31')).toBe('2027-01-01');
  });
});
