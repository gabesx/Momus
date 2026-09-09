import { describe, expect, it } from 'vitest';
import {
  applyTrackerFilters,
  extractTrackerPeopleOptions,
  trackerOwnerKey,
} from './filter';
import type { TrackerIssueRow } from './types';

const base: TrackerIssueRow = {
  jira_key: 'BUG-1',
  project: 'AF',
  summary: 'x',
  has_linked_test_execution: false,
  created_year: 2026,
};

describe('tracker people filters', () => {
  it('trackerOwnerKey prefers owner then tester_assignee then Unassigned', () => {
    expect(trackerOwnerKey({ ...base, owner: 'Ada', tester_assignee: 'Bob' })).toBe('Ada');
    expect(trackerOwnerKey({ ...base, owner: null, tester_assignee: 'Bob' })).toBe('Bob');
    expect(trackerOwnerKey({ ...base, owner: '  ', tester_assignee: null })).toBe('Unassigned');
  });

  it('extractTrackerPeopleOptions returns sorted distinct people', () => {
    const opts = extractTrackerPeopleOptions([
      { ...base, reporter: 'Ann', creator: 'Carl', owner: null, tester_assignee: 'Dana' },
      { ...base, reporter: 'Bob', creator: 'Carl', owner: 'Eve', tester_assignee: null },
      { ...base, reporter: 'Ann', creator: null, owner: null, tester_assignee: null },
    ]);
    expect(opts.reporters).toEqual(['Ann', 'Bob']);
    expect(opts.creators).toEqual(['Carl']);
    expect(opts.owners).toEqual(['Dana', 'Eve']);
  });

  it('exact option match is case-sensitive equality', () => {
    const rows = [
      { ...base, jira_key: 'A', reporter: 'Alice' },
      { ...base, jira_key: 'B', reporter: 'alice' },
    ];
    expect(applyTrackerFilters(rows, { tab: 'all', reporter: 'Alice' }).map((r) => r.jira_key)).toEqual([
      'A',
    ]);
  });

  it('non-option text uses case-insensitive contains', () => {
    const rows = [
      { ...base, jira_key: 'A', creator: 'Catherine' },
      { ...base, jira_key: 'B', creator: 'Dan' },
    ];
    expect(applyTrackerFilters(rows, { tab: 'all', creator: 'cath' }).map((r) => r.jira_key)).toEqual([
      'A',
    ]);
  });

  it('owner Unassigned and owner‖tester_assignee', () => {
    const rows = [
      { ...base, jira_key: 'A', owner: null, tester_assignee: null },
      { ...base, jira_key: 'B', owner: null, tester_assignee: 'Pat' },
      { ...base, jira_key: 'C', owner: 'Pat', tester_assignee: 'Other' },
    ];
    expect(applyTrackerFilters(rows, { tab: 'all', owner: 'Unassigned' }).map((r) => r.jira_key)).toEqual([
      'A',
    ]);
    expect(applyTrackerFilters(rows, { tab: 'all', owner: 'Pat' }).map((r) => r.jira_key)).toEqual([
      'B',
      'C',
    ]);
  });
});
