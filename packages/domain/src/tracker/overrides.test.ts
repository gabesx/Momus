import { describe, expect, it } from 'vitest';
import {
  TRACKER_EDITABLE_FIELDS,
  mergeTrackerOverrides,
  omitOverriddenFields,
} from './overrides';

describe('tracker overrides', () => {
  it('lists exactly four editable fields', () => {
    expect([...TRACKER_EDITABLE_FIELDS].sort()).toEqual(
      ['linked_issues', 'parent', 'service_feature', 'severity_issue'].sort(),
    );
  });

  it('mergeTrackerOverrides sets at/by for patched keys', () => {
    const next = mergeTrackerOverrides(
      {},
      { severity_issue: 'Critical' },
      { at: '2026-07-12T00:00:00.000Z', by: '9' },
    );
    expect(next.severity_issue).toEqual({ at: '2026-07-12T00:00:00.000Z', by: '9' });
    expect(next.parent).toBeUndefined();
  });

  it('omitOverriddenFields strips overridden keys from payload', () => {
    const payload = {
      jira_key: 'BUG-1',
      severity_issue: 'Major',
      parent: 'EPIC-1',
      status: 'Open',
    };
    const out = omitOverriddenFields(payload, {
      severity_issue: { at: 't', by: '1' },
    });
    expect(out.severity_issue).toBeUndefined();
    expect(out.parent).toBe('EPIC-1');
    expect(out.status).toBe('Open');
  });
});
