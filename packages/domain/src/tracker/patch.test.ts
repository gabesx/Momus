import { describe, expect, it } from 'vitest';
import { buildTrackerPatchUpdate } from './patch';

describe('buildTrackerPatchUpdate', () => {
  it('whitelists only TRACKER_EDITABLE_FIELDS', () => {
    const out = buildTrackerPatchUpdate({
      severity_issue: 'Critical',
      parent: 'EPIC-1',
      status: 'Open',
      jira_key: 'BUG-1',
    } as never);
    expect(out).toEqual({
      severity_issue: 'Critical',
      parent: 'EPIC-1',
    });
    expect(out).not.toHaveProperty('status');
    expect(out).not.toHaveProperty('jira_key');
  });

  it('derives has_linked_test_execution when linked_issues is patched', () => {
    const out = buildTrackerPatchUpdate({
      linked_issues: [{ key: 'TE-1', type: 'Test Execution' }],
    });
    expect(out.linked_issues).toEqual([{ key: 'TE-1', type: 'Test Execution' }]);
    expect(out.has_linked_test_execution).toBe(true);
  });

  it('sets has_linked_test_execution false when linked_issues has no test execution', () => {
    const out = buildTrackerPatchUpdate({
      linked_issues: [{ key: 'BUG-2', type: 'Relates' }],
    });
    expect(out.has_linked_test_execution).toBe(false);
  });

  it('does not set has_linked_test_execution when linked_issues is not patched', () => {
    const out = buildTrackerPatchUpdate({ severity_issue: 'Major' });
    expect(out).not.toHaveProperty('has_linked_test_execution');
  });
});
