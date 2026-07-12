import { describe, expect, it } from 'vitest';
import { computeParityChecksum } from './checksum.js';
import {
  checksumLine,
  parseJsonField,
  toBool,
  toDateOnly,
  toIsoTimestamp,
  transformBugBudgetRow,
} from './transform.js';

describe('parseJsonField', () => {
  it('parses JSON strings and passes objects through', () => {
    expect(parseJsonField('["a"]')).toEqual(['a']);
    expect(parseJsonField({ x: 1 })).toEqual({ x: 1 });
    expect(parseJsonField(null)).toBeNull();
    expect(parseJsonField('not-json')).toBe('not-json');
  });
});

describe('toBool / dates', () => {
  it('normalizes MySQL bool encodings', () => {
    expect(toBool(1)).toBe(true);
    expect(toBool(0)).toBe(false);
    expect(toBool(Buffer.from([1]))).toBe(true);
  });

  it('formats timestamps and dates', () => {
    expect(toIsoTimestamp(new Date('2024-06-01T00:00:00.000Z'))).toBe('2024-06-01T00:00:00.000Z');
    expect(toDateOnly('2024-06-01 12:00:00')).toBe('2024-06-01');
  });
});

describe('transformBugBudgetRow', () => {
  it('maps JSON and bool columns', () => {
    const row = transformBugBudgetRow({
      id: 1,
      jira_key: 'SWAT-1',
      project: 'SWAT',
      summary: 'x',
      linked_issues: '[{"key":"A"}]',
      has_linked_test_execution: 0,
      is_open: 1,
      labels: '[]',
      components: '[]',
      fix_versions: '[]',
      ac_related_labels: null,
      raw_jira_data: '{"k":1}',
      start_date: '2024-01-02',
      created_date: new Date('2024-01-02T03:00:00.000Z'),
    });
    expect(row.linked_issues).toEqual([{ key: 'A' }]);
    expect(row.has_linked_test_execution).toBe(false);
    expect(row.is_open).toBe(true);
    expect(row.raw_jira_data).toEqual({ k: 1 });
    expect(row.start_date).toBe('2024-01-02');
    expect(row.created_date).toBe('2024-01-02T03:00:00.000Z');
  });
});

describe('checksum', () => {
  it('is order-independent and stable', () => {
    const a = computeParityChecksum([
      { jira_key: 'B-2', updated_date: '2024-01-01T00:00:00.000Z', is_open: false },
      { jira_key: 'A-1', updated_date: '2024-01-02T00:00:00.000Z', is_open: true },
    ]);
    const b = computeParityChecksum([
      { jira_key: 'A-1', updated_date: '2024-01-02T00:00:00.000Z', is_open: 1 },
      { jira_key: 'B-2', updated_date: '2024-01-01T00:00:00.000Z', is_open: 0 },
    ]);
    expect(a).toBe(b);
    expect(checksumLine('A-1', null, true)).toBe('A-1||1');
  });
});
