import { describe, expect, it } from 'vitest';
import { applyAnalyticsFilters, defaultWindowStartIso } from './filter';
import { computeAnalyticsSummary } from './summary';
import { computeTrends } from './trends';
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
    expect(summary.risk).toBeDefined();
    expect(summary.risk.open_age_buckets).toEqual({
      fresh: expect.any(Number),
      aging: expect.any(Number),
      stale: expect.any(Number),
      long_overdue: expect.any(Number),
    });
    expect(summary.risk.mom).toHaveProperty('open_critical_major');
    expect(summary.risk.mom).toHaveProperty('open_long_overdue');
    expect(summary.resolution).toBeDefined();
    for (const group of ['overall', 'critical_major', 'other'] as const) {
      expect(summary.resolution[group]).toEqual({
        resolved_count: expect.any(Number),
        avg_hours: expect.any(Number),
        median_hours: expect.any(Number),
      });
    }
    expect(summary.resolution.mom).toHaveProperty('avg_hours');
    expect(summary.resolution.mom).toHaveProperty('median_hours');
    for (const sla of [
      'sla_first_response',
      'sla_critical_resolution',
      'sla_major_resolution',
    ] as const) {
      expect(summary.response[sla]).toHaveProperty('pct');
      expect(summary.response[sla]).toMatchObject({
        within: expect.any(Number),
        eligible: expect.any(Number),
        threshold_days: expect.any(Number),
      });
    }
    expect(summary.distribution.by_squad).toBeInstanceOf(Array);
    expect(summary.distribution.by_service).toBeInstanceOf(Array);
    expect(summary.distribution.by_engineer).toBeInstanceOf(Array);
    expect(summary.distribution.traceability).toEqual({
      linked: expect.any(Number),
      total: expect.any(Number),
      pct: expect.any(Number),
    });
  });

  it('trends carry inflow/outflow/net/backlog arrays parallel to labels', () => {
    const rows: AnalyticsIssueRow[] = [
      {
        project: 'A',
        created_date: '2026-06-01T00:00:00+07:00',
        resolved_date: '2026-06-20T00:00:00+07:00',
        is_open: false,
        issue_type: 'Bug',
      },
      {
        project: 'A',
        created_date: '2026-07-01T00:00:00+07:00',
        is_open: true,
        issue_type: 'Bug',
      },
    ];
    const trends = computeTrends(rows, 'month', nowIso);
    const n = trends.labels.length;
    for (const key of ['created', 'resolved', 'net', 'backlog'] as const) {
      expect(trends[key]).toBeInstanceOf(Array);
      expect(trends[key]).toHaveLength(n);
    }
  });

  it('distribution exposes a squad_heat matrix', () => {
    const rows: AnalyticsIssueRow[] = [
      {
        project: 'AO',
        real_project: 'operation',
        created_date: '2026-06-01T00:00:00+07:00',
        created_year: 2026,
        is_open: true,
        issue_type: 'Bug',
        severity_issue: 'Critical',
      },
      {
        project: 'AO',
        real_project: 'operation',
        created_date: '2026-06-02T00:00:00+07:00',
        created_year: 2026,
        is_open: true,
        issue_type: 'Bug',
        severity_issue: 'Major',
      },
    ];
    const heat = computeAnalyticsSummary(rows, nowIso).distribution.squad_heat!;
    expect(heat.squads).toEqual(['operation']);
    expect(heat.severities).toEqual(['Critical', 'Major']);
    expect(heat.open.operation).toEqual({ Critical: 1, Major: 1 });
    expect(heat.row_totals).toEqual({ operation: 2 });
    expect(heat.col_totals).toEqual({ Critical: 1, Major: 1 });
    expect(heat.max).toBe(1);
  });

  it('exports KPI threshold defaults and period-detail shape', () => {
    expect(ANALYTICS_KPI_THRESHOLDS.open_warning).toBe(100);
    expect(ANALYTICS_KPI_THRESHOLDS.avg_age_warning_days).toBe(30);
    expect(ANALYTICS_KPI_THRESHOLDS.resolution_rate_healthy_pct).toBe(70);
    expect(ANALYTICS_KPI_THRESHOLDS.open_critical_major_pct_warning).toBe(25);
    expect(ANALYTICS_KPI_THRESHOLDS.open_long_overdue_pct_warning).toBe(20);
    expect(ANALYTICS_KPI_THRESHOLDS.mttr_critical_major_warning_hours).toBe(72);
    expect(ANALYTICS_KPI_THRESHOLDS.sla_first_response_days).toBe(2);
    expect(ANALYTICS_KPI_THRESHOLDS.sla_critical_resolution_days).toBe(3);
    expect(ANALYTICS_KPI_THRESHOLDS.sla_major_resolution_days).toBe(7);
    expect(ANALYTICS_KPI_THRESHOLDS.sla_compliance_healthy_pct).toBe(90);

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
