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

  it('mergeTrackerOverrides preserves existing override keys when patching a different field', () => {
    const existing = {
      severity_issue: { at: '2026-07-11T00:00:00.000Z', by: '1' },
      parent: { at: '2026-07-11T01:00:00.000Z', by: '2' },
    };
    const next = mergeTrackerOverrides(
      existing,
      { service_feature: 'Payments' },
      { at: '2026-07-12T00:00:00.000Z', by: '9' },
    );
    expect(next.severity_issue).toEqual(existing.severity_issue);
    expect(next.parent).toEqual(existing.parent);
    expect(next.service_feature).toEqual({ at: '2026-07-12T00:00:00.000Z', by: '9' });
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

  it('omitOverriddenFields strips multiple overridden keys', () => {
    const payload = {
      jira_key: 'BUG-1',
      severity_issue: 'Major',
      parent: 'EPIC-1',
      service_feature: 'Payments',
      status: 'Open',
    };
    const out = omitOverriddenFields(payload, {
      severity_issue: { at: 't', by: '1' },
      parent: { at: 't', by: '2' },
      service_feature: { at: 't', by: '3' },
    });
    expect(out.severity_issue).toBeUndefined();
    expect(out.parent).toBeUndefined();
    expect(out.service_feature).toBeUndefined();
    expect(out.jira_key).toBe('BUG-1');
    expect(out.status).toBe('Open');
  });

  it.each([null, undefined, {}])(
    'omitOverriddenFields with %s returns a shallow copy and keeps fields',
    (overrides) => {
      const payload = {
        jira_key: 'BUG-1',
        severity_issue: 'Major',
        parent: 'EPIC-1',
      };
      const out = omitOverriddenFields(payload, overrides);
      expect(out).not.toBe(payload);
      expect(out).toEqual(payload);
    },
  );
});
