import { describe, expect, it } from 'vitest';
import {
  buildReporterLeaderboard,
  computeLeaderboard,
  filterReporterDrilldown,
  isRejectedStatus,
  mapIssueTypeGroup,
} from './compute';
import { dateInRange, resolvePeriodRange } from './period';
import type { LeaderboardIssueRow } from './types';

const now = '2026-07-12T00:00:00.000Z';

const rows: LeaderboardIssueRow[] = [
  {
    reporter: 'Alice',
    issue_type: 'Bug',
    project: 'AF',
    status: 'Open',
    created_date: '2026-04-10',
    jira_key: 'AF-1',
  },
  {
    reporter: 'Alice',
    issue_type: 'Defect',
    project: 'AF',
    status: 'Rejected',
    created_date: '2026-05-01',
    jira_key: 'AF-2',
  },
  {
    reporter: 'Bob',
    issue_type: 'Bug',
    project: 'SWAT',
    status: 'Done',
    created_date: '2026-05-15',
    jira_key: 'SW-1',
  },
  {
    reporter: 'Bob',
    issue_type: 'Bug',
    project: 'SWAT',
    status: 'Cancelled',
    created_date: '2025-01-01',
    jira_key: 'SW-OLD',
  },
];

describe('leaderboard domain', () => {
  it('classifies rejected statuses by keyword', () => {
    expect(isRejectedStatus('Rejected by QA')).toBe(true);
    expect(isRejectedStatus('Cancelled')).toBe(true);
    expect(isRejectedStatus('Open')).toBe(false);
  });

  it('maps issue types to Bug/Defect groups', () => {
    expect(mapIssueTypeGroup('Defect Task')).toBe('Defect');
    expect(mapIssueTypeGroup('Bug')).toBe('Bug');
  });

  it('resolves Q2 range', () => {
    expect(resolvePeriodRange(2026, 'quarterly', 'Q2')).toEqual({
      start: '2026-04-01',
      end: '2026-06-30',
    });
    expect(dateInRange('2026-05-01', resolvePeriodRange(2026, 'quarterly', 'Q2'))).toBe(true);
    expect(dateInRange('2026-07-01', resolvePeriodRange(2026, 'quarterly', 'Q2'))).toBe(false);
  });

  it('computes global ranks for quarterly window', () => {
    const result = computeLeaderboard(
      rows,
      { period_type: 'quarterly', year: 2026, period: 'Q2' },
      now,
    );
    expect(result.summary.total_issues).toBe(3);
    expect(result.summary.rejected_count).toBe(1);
    expect(result.summary.accepted_count).toBe(2);
    expect(result.global[0]).toEqual({ reporter: 'Alice', count: 2 });
    expect(result.by_issue_type.Bug?.[0]?.reporter).toBe('Alice');
  });

  it('builds top-N reporter leaderboard', () => {
    const ranks = buildReporterLeaderboard(rows.filter((r) => r.created_date!.startsWith('2026')), 10);
    expect(ranks).toEqual([
      { reporter: 'Alice', count: 2 },
      { reporter: 'Bob', count: 1 },
    ]);
  });

  it('filters reporter drilldown by rejected context', () => {
    const issues = filterReporterDrilldown(
      rows,
      { period_type: 'quarterly', year: 2026, period: 'Q2' },
      now,
      'Alice',
      'rejected',
    );
    expect(issues.map((i) => i.jira_key)).toEqual(['AF-2']);
  });
});
