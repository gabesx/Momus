import { describe, expect, it } from 'vitest';
import { applyTrackerFilters } from './filter';
import type { TrackerIssueRow } from './types';

function row(partial: Partial<TrackerIssueRow> & Pick<TrackerIssueRow, 'jira_key'>): TrackerIssueRow {
  return {
    project: 'AO',
    summary: 'x',
    has_linked_test_execution: false,
    ...partial,
  };
}

describe('tracker drill-through filters', () => {
  const rows: TrackerIssueRow[] = [
    row({ jira_key: 'AO-1', real_project: 'operation', service_feature_final: 'Checkout', engineer_assignee: 'Dewi' }),
    row({ jira_key: 'AO-2', real_project: null, service_feature: 'Search', test_engineer_assignee: 'Budi' }),
    row({ jira_key: 'AO-3' }),
  ];

  it('squad matches real_project with project fallback', () => {
    expect(applyTrackerFilters(rows, { tab: 'all', squad: 'operation' }).map((r) => r.jira_key)).toEqual(['AO-1']);
    expect(applyTrackerFilters(rows, { tab: 'all', squad: 'AO' }).map((r) => r.jira_key)).toEqual(['AO-2', 'AO-3']);
  });

  it('service matches final field with fallback and Unspecified sentinel', () => {
    expect(applyTrackerFilters(rows, { tab: 'all', service: 'Search' }).map((r) => r.jira_key)).toEqual(['AO-2']);
    expect(applyTrackerFilters(rows, { tab: 'all', service: 'Unspecified' }).map((r) => r.jira_key)).toEqual(['AO-3']);
  });

  it('engineer matches with test-engineer fallback and Unassigned sentinel', () => {
    expect(applyTrackerFilters(rows, { tab: 'all', engineer: 'Budi' }).map((r) => r.jira_key)).toEqual(['AO-2']);
    expect(applyTrackerFilters(rows, { tab: 'all', engineer: 'Unassigned' }).map((r) => r.jira_key)).toEqual(['AO-3']);
  });
});
