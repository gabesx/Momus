import { describe, expect, it } from 'vitest';
import { hasLinkedTestExecutionFromLinkedIssues } from './linked-test';

describe('hasLinkedTestExecutionFromLinkedIssues', () => {
  it('returns false for null, string, or non-array values', () => {
    expect(hasLinkedTestExecutionFromLinkedIssues(null)).toBe(false);
    expect(hasLinkedTestExecutionFromLinkedIssues('[]')).toBe(false);
    expect(hasLinkedTestExecutionFromLinkedIssues({})).toBe(false);
  });

  it('returns false when no link type matches test execution', () => {
    expect(
      hasLinkedTestExecutionFromLinkedIssues([
        { key: 'TE-1', type: 'Relates' },
        { key: 'BUG-2', type: 'Blocks' },
      ]),
    ).toBe(false);
  });

  it('returns true when any link type matches test execution case-insensitively', () => {
    expect(
      hasLinkedTestExecutionFromLinkedIssues([{ key: 'TE-1', type: 'Test Execution' }]),
    ).toBe(true);
    expect(
      hasLinkedTestExecutionFromLinkedIssues([{ key: 'TE-2', type: 'test execution' }]),
    ).toBe(true);
  });

  it('ignores malformed entries without a string type', () => {
    expect(hasLinkedTestExecutionFromLinkedIssues([null, { key: 'TE-1' }, {}])).toBe(false);
  });
});
