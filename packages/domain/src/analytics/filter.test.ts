import { describe, expect, it } from 'vitest';
import { applyAnalyticsFilters } from './filter';
import type { AnalyticsIssueRow } from './types';

const nowIso = '2026-07-11T12:00:00+07:00';

const rows: AnalyticsIssueRow[] = [
  { project: 'A', created_date: '2026-07-05T00:00:00+07:00', created_year: 2026, is_open: true, issue_type: 'Bug' },
  { project: 'A', created_date: '2025-06-01T00:00:00+07:00', created_year: 2025, is_open: false, issue_type: 'Defect' },
  { project: 'B', created_date: '2026-01-01T00:00:00+07:00', created_year: 2026, is_open: true, issue_type: 'Bug' },
  { project: 'A', created_date: '2020-01-01T00:00:00+07:00', created_year: 2020, is_open: false, final_issue_type: 'Bug' },
  { project: 'A', created_date: '2026-03-01T00:00:00+07:00', created_year: 2026, is_open: true, final_issue_type: 'Defect Task' },
  { project: 'A', is_open: true, issue_type: 'Bug' },
];

describe('applyAnalyticsFilters', () => {
  it('filters by year via created_year or created_date', () => {
    const result = applyAnalyticsFilters(rows, { year: 2026 }, nowIso);
    expect(result).toHaveLength(3);
  });

  it('keeps all years when year and date range are unset', () => {
    const result = applyAnalyticsFilters(rows, {}, nowIso);
    expect(result.some((r) => r.created_date?.startsWith('2020'))).toBe(true);
    // Rows without created_date are kept (no default date window).
    expect(result).toHaveLength(rows.length);
  });

  it('filters bugs only via issue_type or final_issue_type', () => {
    const result = applyAnalyticsFilters(rows, { year: 2026, issue_type: 'bugs' }, nowIso);
    expect(result.every((r) => r.issue_type === 'Bug' || r.final_issue_type === 'Bug')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('filters status open', () => {
    const result = applyAnalyticsFilters(rows, { year: 2026, status: 'open' }, nowIso);
    expect(result.every((r) => r.is_open)).toBe(true);
    expect(result).toHaveLength(3);
  });
});
