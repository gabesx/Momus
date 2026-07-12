import { describe, expect, it } from 'vitest';
import { applyAnalyticsFilters } from './filter';
import { computePeriodDetail } from './period-detail';
import { computeMonthlyTrends, computeTrends } from './trends';
import type { AnalyticsIssueRow } from './types';

const nowIso = '2026-07-11T12:00:00+07:00';

const base: AnalyticsIssueRow[] = [
  {
    project: 'A',
    created_date: '2026-04-10T00:00:00+07:00',
    created_year: 2026,
    is_open: true,
    issue_type: 'Bug',
    severity_issue: 'Critical',
    priority: 'Highest',
    ac_related_labels: ['ac-related'],
  },
  {
    project: 'A',
    created_date: '2026-05-10T00:00:00+07:00',
    created_year: 2026,
    is_open: false,
    issue_type: 'Defect',
    severity_issue: 'Major',
    priority: null,
    ac_related_labels: ['non-ac-related'],
  },
  {
    project: 'B',
    created_date: '2026-01-15T00:00:00+07:00',
    created_year: 2026,
    is_open: true,
    issue_type: 'Bug',
    severity_issue: 'Critical',
    priority: 'High',
    ac_related_labels: ['ac-related-inferred'],
  },
];

describe('applyAnalyticsFilters advanced', () => {
  it('filters by severity (case-insensitive)', () => {
    const r = applyAnalyticsFilters(base, { year: 2026, severity: 'critical' }, nowIso);
    expect(r).toHaveLength(2);
  });

  it('filters ac_related yes/no', () => {
    const yes = applyAnalyticsFilters(base, { year: 2026, ac_related: 'yes' }, nowIso);
    const no = applyAnalyticsFilters(base, { year: 2026, ac_related: 'no' }, nowIso);
    expect(yes).toHaveLength(2);
    expect(no).toHaveLength(1);
  });

  it('filters priority and __none__', () => {
    const none = applyAnalyticsFilters(base, { year: 2026, priority: '__none__' }, nowIso);
    const high = applyAnalyticsFilters(base, { year: 2026, priority: 'High' }, nowIso);
    expect(none).toHaveLength(1);
    expect(high).toHaveLength(1);
  });

  it('filters date_from / date_to (inclusive calendar dates Jakarta)', () => {
    const r = applyAnalyticsFilters(
      base,
      { date_from: '2026-04-01', date_to: '2026-04-30' },
      nowIso,
    );
    expect(r).toHaveLength(1);
    expect(r[0].created_date?.startsWith('2026-04')).toBe(true);
  });
});

describe('computeTrends grains', () => {
  it('month grain matches computeMonthlyTrends shape and sets grain', () => {
    const monthly = computeMonthlyTrends(base, nowIso);
    const trends = computeTrends(base, 'month', nowIso);
    expect(trends.labels).toEqual(monthly.labels);
    expect(trends.bugs).toEqual(monthly.bugs);
    expect(trends.grain).toBe('month');
  });

  it('quarter grain buckets Q1–Q2 2026', () => {
    const trends = computeTrends(base, 'quarter', nowIso);
    expect(trends.grain).toBe('quarter');
    expect(trends.labels.some((l) => l.includes('Q1') || l.includes('2026'))).toBe(true);
    expect(trends.total.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('year grain returns a 2026 bucket', () => {
    const trends = computeTrends(base, 'year', nowIso);
    expect(trends.grain).toBe('year');
    expect(trends.labels).toContain('2026');
    expect(trends.total[trends.labels.indexOf('2026')]).toBe(3);
  });
});

describe('computePeriodDetail', () => {
  it('builds severity×priority and severity×AC matrices for a month', () => {
    const detail = computePeriodDetail(base, '2026-04', 'month');
    expect(detail.period_key).toBe('2026-04');
    expect(detail.total).toBe(1);
    expect(detail.bugs).toBe(1);
    expect(detail.severity_by_priority.Critical?.Highest).toBe(1);
    expect(detail.severity_by_ac.Critical?.ac).toBe(1);
  });
});
