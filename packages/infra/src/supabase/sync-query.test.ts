import { describe, expect, it } from 'vitest';
import { DEFAULT_SYNC_QUERY, parseSyncQueryConfig } from './config';

describe('parseSyncQueryConfig', () => {
  it('parses a full custom JQL payload', () => {
    expect(
      parseSyncQueryConfig({
        jql: '  issuetype = Bug  ',
        sync_type: 'custom',
        batch_size: 100,
        max_total_issues: 5000,
        year: 2026,
        quarter: 2,
        month: 6,
      }),
    ).toEqual({
      jql: 'issuetype = Bug',
      sync_type: 'custom',
      batch_size: 100,
      max_total_issues: 5000,
      year: 2026,
      quarter: 2,
      month: 6,
    });
  });

  it('defaults missing fields', () => {
    expect(parseSyncQueryConfig({})).toEqual(DEFAULT_SYNC_QUERY);
  });

  it('rejects jql longer than 2000 chars', () => {
    expect(() => parseSyncQueryConfig({ jql: 'x'.repeat(2001) })).toThrow(/jql/i);
  });

  it('rejects invalid sync_type', () => {
    expect(() => parseSyncQueryConfig({ sync_type: 'weekly' })).toThrow(/sync_type/i);
  });

  it('rejects invalid batch_size', () => {
    expect(() => parseSyncQueryConfig({ batch_size: 0 })).toThrow(/batch_size/i);
  });

  it('rejects invalid max_total_issues', () => {
    expect(() => parseSyncQueryConfig({ max_total_issues: -1 })).toThrow(/max_total_issues/i);
  });
});
