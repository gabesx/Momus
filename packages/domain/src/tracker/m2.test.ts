import { describe, expect, it } from 'vitest';
import { getMissingFields, isMissingFieldsRow } from './missing-fields';
import { applyTrackerFilters } from './filter';
import { parseTrackerPatch } from './patch';
import type { TrackerIssueRow } from './types';

const base: TrackerIssueRow = {
  jira_key: 'BUG-1',
  project: 'AF',
  summary: 'x',
  has_linked_test_execution: false,
  severity_issue: null,
  parent: null,
  service_feature: 'Checkout',
  ac_related_labels: [],
  tester_assignee: null,
  created_year: 2026,
};

describe('tracker M2', () => {
  it('detects missing severity/parent/tester', () => {
    const missing = getMissingFields(base, []);
    expect(missing).toEqual(
      expect.arrayContaining(['severity_issue', 'parent', 'tester_assignee']),
    );
    expect(missing).not.toContain('service_feature');
  });

  it('no_linked_test tab keeps only false/null flag', () => {
    const rows = [
      { ...base, jira_key: 'A', has_linked_test_execution: false },
      { ...base, jira_key: 'B', has_linked_test_execution: true },
    ];
    const out = applyTrackerFilters(rows, { tab: 'no_linked_test' });
    expect(out.map((r) => r.jira_key)).toEqual(['A']);
  });

  it('missing_fields tab uses isMissingFieldsRow', () => {
    expect(isMissingFieldsRow(base, [])).toBe(true);
    expect(
      isMissingFieldsRow({ ...base, severity_issue: 'Major', parent: 'P', tester_assignee: 't', ac_related_labels: ['ac'] }, []),
    ).toBe(false);
  });

  it('parseTrackerPatch rejects unknown keys', () => {
    const r = parseTrackerPatch({ severity_issue: 'Major', bogon: 1 });
    expect(r.ok).toBe(false);
  });

  it('parseTrackerPatch accepts editable subset', () => {
    const r = parseTrackerPatch({ parent: 'EPIC-1', severity_issue: 'Critical' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.parent).toBe('EPIC-1');
  });
});
