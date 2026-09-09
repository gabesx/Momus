import { describe, expect, it } from 'vitest';
import { sortTrackerRows } from './sort';
import type { TrackerIssueRow } from './types';

const row = (
  partial: Partial<TrackerIssueRow> & Pick<TrackerIssueRow, 'jira_key'>,
): TrackerIssueRow => ({
  project: 'AF',
  summary: 's',
  has_linked_test_execution: false,
  ...partial,
});

describe('sortTrackerRows', () => {
  it('returns same order when sort missing', () => {
    const rows = [row({ jira_key: 'B' }), row({ jira_key: 'A' })];
    expect(sortTrackerRows(rows, null, 'asc').map((r) => r.jira_key)).toEqual(['B', 'A']);
  });

  it('sorts jira_key asc and desc', () => {
    const rows = [row({ jira_key: 'B-2' }), row({ jira_key: 'A-1' }), row({ jira_key: 'C-3' })];
    expect(sortTrackerRows(rows, 'jira_key', 'asc').map((r) => r.jira_key)).toEqual([
      'A-1',
      'B-2',
      'C-3',
    ]);
    expect(sortTrackerRows(rows, 'jira_key', 'desc').map((r) => r.jira_key)).toEqual([
      'C-3',
      'B-2',
      'A-1',
    ]);
  });

  it('puts null/empty last in both directions for summary', () => {
    const rows = [
      row({ jira_key: 'A', summary: '' }),
      row({ jira_key: 'B', summary: 'Beta' }),
      row({ jira_key: 'C', summary: 'Alpha' }),
    ];
    expect(sortTrackerRows(rows, 'summary', 'asc').map((r) => r.jira_key)).toEqual(['C', 'B', 'A']);
    expect(sortTrackerRows(rows, 'summary', 'desc').map((r) => r.jira_key)).toEqual(['B', 'C', 'A']);
  });

  it('sorts created_date chronologically', () => {
    const rows = [
      row({ jira_key: 'A', created_date: '2026-03-01' }),
      row({ jira_key: 'B', created_date: '2026-01-15' }),
      row({ jira_key: 'C', created_date: null }),
    ];
    expect(sortTrackerRows(rows, 'created_date', 'asc').map((r) => r.jira_key)).toEqual([
      'B',
      'A',
      'C',
    ]);
  });

  it('sorts owner via owner‖tester_assignee', () => {
    const rows = [
      row({ jira_key: 'A', owner: null, tester_assignee: 'Zoe' }),
      row({ jira_key: 'B', owner: 'Ann', tester_assignee: null }),
    ];
    expect(sortTrackerRows(rows, 'owner', 'asc').map((r) => r.jira_key)).toEqual(['B', 'A']);
  });
});
