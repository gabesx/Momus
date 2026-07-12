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

  it('no_linked_test tab keeps only issues without a Test Execution link', () => {
    const rows = [
      { ...base, jira_key: 'A', has_linked_test_execution: false, linked_issues: [{ key: 'X-1', type: 'Relates' }] },
      {
        ...base,
        jira_key: 'B',
        has_linked_test_execution: true,
        linked_issues: [{ key: 'TE-1', type: 'Test Execution' }],
      },
      { ...base, jira_key: 'C', has_linked_test_execution: false, linked_issues: null },
    ];
    const out = applyTrackerFilters(rows, { tab: 'no_linked_test' });
    expect(out.map((r) => r.jira_key)).toEqual(['A', 'C']);
  });

  it('no_linked_test prefers linked_issues type over stale flag', () => {
    const rows = [
      {
        ...base,
        jira_key: 'STALE',
        has_linked_test_execution: true,
        linked_issues: [{ key: 'X-1', type: 'Blocks' }],
      },
    ];
    const out = applyTrackerFilters(rows, { tab: 'no_linked_test' });
    expect(out.map((r) => r.jira_key)).toEqual(['STALE']);
  });

  it('exclude_projects removes selected projects', () => {
    const rows = [
      { ...base, jira_key: 'A', project: 'AL' },
      { ...base, jira_key: 'B', project: 'PW' },
      { ...base, jira_key: 'C', project: 'PC' },
    ];
    const out = applyTrackerFilters(rows, {
      tab: 'all',
      exclude_projects: ['PW', 'PC'],
    });
    expect(out.map((r) => r.jira_key)).toEqual(['A']);
  });

  it('year=all keeps all years', () => {
    const rows = [
      { ...base, jira_key: 'A', created_year: 2025 },
      { ...base, jira_key: 'B', created_year: 2026 },
    ];
    const out = applyTrackerFilters(rows, { tab: 'all', year: 'all' });
    expect(out.map((r) => r.jira_key)).toEqual(['A', 'B']);
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

  it.each(['parent', 'severity_issue', 'service_feature'] as const)(
    'parseTrackerPatch rejects blank %s',
    (field) => {
      for (const blank of ['', '   ', '\t\n']) {
        const r = parseTrackerPatch({ [field]: blank });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.message).toBe(`${field} must not be blank`);
      }
    },
  );

  it('parseTrackerPatch accepts null for string fields', () => {
    const r = parseTrackerPatch({ parent: null, severity_issue: null, service_feature: null });
    expect(r.ok).toBe(true);
  });
});

describe('getMissingDescriptionFields', () => {
  it('flags all three when empty', async () => {
    const { getMissingDescriptionFields } = await import('./missing-fields');
    expect(getMissingDescriptionFields(null)).toEqual([
      'Expected Result',
      'Actual Result',
      'Steps to Reproduce',
    ]);
  });

  it('detects missing expected only', async () => {
    const { getMissingDescriptionFields } = await import('./missing-fields');
    const missing = getMissingDescriptionFields(
      'Actual Result: Something happened\nSteps to Reproduce: Do this',
    );
    expect(missing).toEqual(['Expected Result']);
  });

  it('accepts table-style Expected headers', async () => {
    const { getMissingDescriptionFields } = await import('./missing-fields');
    const missing = getMissingDescriptionFields(
      '| Expected | Actual | Evidence |\n| ok | broken | link |',
    );
    expect(missing).not.toContain('Expected Result');
    expect(missing).not.toContain('Actual Result');
  });
});
