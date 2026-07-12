import { describe, expect, it } from 'vitest';
import { applyAnalyticsFilters, defaultWindowStartIso } from './filter';
import { computeAnalyticsSummary } from './summary';
import {
  ANALYTICS_KPI_THRESHOLDS,
  type AnalyticsIssueRow,
  type AnalyticsPeriodDetail,
} from './types';

const nowIso = '2026-07-11T12:00:00+07:00';

describe('analytics M1 contract', () => {
  it('defaultWindowStartIso still computes 24 Jakarta months (helper retained)', () => {
    expect(defaultWindowStartIso(nowIso)).toBe('2024-08-01T00:00:00+07:00');
  });

  it('default filter shows all years when year and date range are unset', () => {
    const rows: AnalyticsIssueRow[] = [
      {
        project: 'A',
        created_date: '2020-01-01T00:00:00+07:00',
        created_year: 2020,
        is_open: false,
        issue_type: 'Bug',
      },
      {
        project: 'A',
        created_date: '2026-06-01T00:00:00+07:00',
        created_year: 2026,
        is_open: true,
        issue_type: 'Bug',
      },
    ];
    expect(applyAnalyticsFilters(rows, {}, nowIso)).toHaveLength(2);
  });

  it('prefers issue_type over final_issue_type when both are set', () => {
    const rows: AnalyticsIssueRow[] = [
      {
        project: 'A',
        created_date: '2026-06-01T00:00:00+07:00',
        created_year: 2026,
        is_open: true,
        issue_type: 'Bug',
        final_issue_type: 'Defect',
      },
    ];
    const bugs = applyAnalyticsFilters(rows, { year: 2026, issue_type: 'bugs' }, nowIso);
    const defects = applyAnalyticsFilters(rows, { year: 2026, issue_type: 'defects' }, nowIso);
    expect(bugs).toHaveLength(1);
    expect(defects).toHaveLength(0);
  });

  it('in-progress uses status_category heuristics', () => {
    const rows: AnalyticsIssueRow[] = [
      {
        project: 'A',
        created_date: '2026-06-01T00:00:00+07:00',
        created_year: 2026,
        is_open: true,
        issue_type: 'Bug',
        status_category: 'In Progress',
      },
      {
        project: 'A',
        created_date: '2026-06-02T00:00:00+07:00',
        created_year: 2026,
        is_open: true,
        issue_type: 'Bug',
        status_category: 'To Do',
      },
    ];
    const result = applyAnalyticsFilters(rows, { year: 2026, status: 'in-progress' }, nowIso);
    expect(result).toHaveLength(1);
    expect(result[0].status_category).toBe('In Progress');
  });

  it('resolved and closed both mean !is_open', () => {
    const rows: AnalyticsIssueRow[] = [
      {
        project: 'A',
        created_date: '2026-06-01T00:00:00+07:00',
        created_year: 2026,
        is_open: false,
        issue_type: 'Defect',
      },
      {
        project: 'A',
        created_date: '2026-06-02T00:00:00+07:00',
        created_year: 2026,
        is_open: true,
        issue_type: 'Bug',
      },
    ];
    expect(applyAnalyticsFilters(rows, { year: 2026, status: 'resolved' }, nowIso)).toHaveLength(1);
    expect(applyAnalyticsFilters(rows, { year: 2026, status: 'closed' }, nowIso)).toHaveLength(1);
  });

  it('summary exposes MoM keys for all KPI metrics', () => {
    const rows: AnalyticsIssueRow[] = [
      {
        project: 'A',
        created_date: '2026-07-01T00:00:00+07:00',
        created_year: 2026,
        is_open: true,
        issue_type: 'Bug',
        defect_age_days: 5,
      },
      {
        project: 'A',
        created_date: '2026-06-15T00:00:00+07:00',
        created_year: 2026,
        is_open: false,
        issue_type: 'Defect',
        defect_age_days: 10,
      },
    ];
    const summary = computeAnalyticsSummary(rows, nowIso);
    expect(summary.total).toBe(2);
    for (const key of ['total', 'open', 'resolved', 'resolution_rate', 'avg_age'] as const) {
      expect(summary.mom).toHaveProperty(key);
    }
  });

  it('exports KPI threshold defaults and period-detail shape', () => {
    expect(ANALYTICS_KPI_THRESHOLDS.open_warning).toBe(100);
    expect(ANALYTICS_KPI_THRESHOLDS.avg_age_warning_days).toBe(30);
    expect(ANALYTICS_KPI_THRESHOLDS.resolution_rate_healthy_pct).toBe(70);

    const detail: AnalyticsPeriodDetail = {
      period_key: '2026-Q2',
      grain: 'quarter',
      total: 0,
      bugs: 0,
      defects: 0,
      severity_by_priority: {},
      severity_by_ac: {},
    };
    expect(detail.grain).toBe('quarter');
  });
});
