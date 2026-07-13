import { describe, expect, it } from 'vitest';
import { computeAnalyticsRisk } from './risk';
import { computeAnalyticsSummary } from './summary';
import type { AnalyticsIssueRow } from './types';

function row(partial: Partial<AnalyticsIssueRow> & Pick<AnalyticsIssueRow, 'project' | 'is_open'>): AnalyticsIssueRow {
  return {
    created_date: '2026-06-01T00:00:00+07:00',
    created_year: 2026,
    issue_type: 'Bug',
    ...partial,
  };
}

describe('computeAnalyticsRisk', () => {
  it('scopes to open issues only', () => {
    const risk = computeAnalyticsRisk([
      row({ project: 'A', is_open: true, severity_issue: 'Critical', defect_age_days: 3 }),
      row({ project: 'A', is_open: false, severity_issue: 'Critical', defect_age_days: 100 }),
    ]);
    expect(risk.open_critical).toBe(1);
    expect(risk.open_critical_major).toBe(1);
    expect(risk.open_long_overdue).toBe(0);
    expect(risk.open_age_buckets.fresh).toBe(1);
  });

  it('matches Critical/Major exactly like Bug Budget', () => {
    const risk = computeAnalyticsRisk([
      row({ project: 'A', is_open: true, severity_issue: 'Critical', defect_age_days: 1 }),
      row({ project: 'A', is_open: true, severity_issue: 'Major', defect_age_days: 1 }),
      row({ project: 'A', is_open: true, severity_issue: 'critical', defect_age_days: 1 }),
      row({ project: 'A', is_open: true, severity_issue: 'Minor', defect_age_days: 1 }),
    ]);
    expect(risk.open_critical).toBe(1);
    expect(risk.open_major).toBe(1);
    expect(risk.open_critical_major).toBe(2);
  });

  it('buckets ages at 5 / 20 / 80 boundaries', () => {
    const risk = computeAnalyticsRisk([
      row({ project: 'A', is_open: true, defect_age_days: 5 }),
      row({ project: 'A', is_open: true, defect_age_days: 6 }),
      row({ project: 'A', is_open: true, defect_age_days: 20 }),
      row({ project: 'A', is_open: true, defect_age_days: 21 }),
      row({ project: 'A', is_open: true, defect_age_days: 80 }),
      row({ project: 'A', is_open: true, defect_age_days: 81 }),
    ]);
    expect(risk.open_age_buckets).toEqual({
      fresh: 1,
      aging: 2,
      stale: 2,
      long_overdue: 1,
    });
    expect(risk.open_long_overdue).toBe(1);
  });

  it('excludes missing or non-positive age from buckets', () => {
    const risk = computeAnalyticsRisk([
      row({ project: 'A', is_open: true, defect_age_days: null }),
      row({ project: 'A', is_open: true, defect_age_days: 0 }),
      row({ project: 'A', is_open: true, defect_age_days: 10 }),
    ]);
    expect(risk.open_age_buckets).toEqual({
      fresh: 0,
      aging: 1,
      stale: 0,
      long_overdue: 0,
    });
  });

  it('returns zero pcts when no open issues', () => {
    const risk = computeAnalyticsRisk([
      row({ project: 'A', is_open: false, severity_issue: 'Critical', defect_age_days: 100 }),
    ]);
    expect(risk.open_critical_major_pct_of_open).toBe(0);
    expect(risk.open_long_overdue_pct_of_open).toBe(0);
    expect(risk.open_severity).toEqual({});
  });

  it('counts Unknown severity for null/empty', () => {
    const risk = computeAnalyticsRisk([
      row({ project: 'A', is_open: true, severity_issue: null, defect_age_days: 1 }),
      row({ project: 'A', is_open: true, severity_issue: '  ', defect_age_days: 1 }),
    ]);
    expect(risk.open_severity.Unknown).toBe(2);
    expect(risk.open_critical_major).toBe(0);
  });
});

describe('computeAnalyticsSummary risk MoM', () => {
  it('attaches risk MoM using created-month cohorts (null when prior zero)', () => {
    const nowIso = '2026-07-11T12:00:00+07:00';
    const rows: AnalyticsIssueRow[] = [
      row({
        project: 'A',
        is_open: true,
        created_date: '2026-07-02T00:00:00+07:00',
        severity_issue: 'Critical',
        defect_age_days: 90,
      }),
      row({
        project: 'A',
        is_open: true,
        created_date: '2026-06-10T00:00:00+07:00',
        severity_issue: 'Major',
        defect_age_days: 2,
      }),
    ];
    const summary = computeAnalyticsSummary(rows, nowIso);
    expect(summary.risk.open_critical_major).toBe(2);
    expect(summary.risk.mom.open_critical_major).not.toBeNull();
  });
});
