import { describe, expect, it } from 'vitest';
import { analyticsCsvFilename, buildAnalyticsCsv } from './csv';
import { computeAnalyticsSummary } from './summary';
import { computeTrends } from './trends';
import type { AnalyticsIssueRow } from './types';

const nowIso = '2026-07-14T10:00:00+07:00';

const rows: AnalyticsIssueRow[] = [
  {
    project: 'AO',
    real_project: 'operation',
    created_date: '2026-06-01T00:00:00+07:00',
    created_year: 2026,
    is_open: true,
    issue_type: 'Bug',
    severity_issue: 'Critical',
    defect_age_days: 10,
  },
  {
    project: 'AO',
    created_date: '2026-07-01T00:00:00+07:00',
    created_year: 2026,
    is_open: false,
    issue_type: 'Defect',
    time_to_resolution_hours: 24,
    labels: ['found-in-prod'],
  },
];

describe('buildAnalyticsCsv', () => {
  it('emits KPI, trend, and distribution sections', () => {
    const summary = computeAnalyticsSummary(rows, nowIso);
    const trends = computeTrends(rows, 'month', nowIso, {
      priority: {},
      severity: { critical: 10 },
    });
    const csv = buildAnalyticsCsv(summary, trends, nowIso);

    expect(csv).toContain('Total issues,2');
    expect(csv).toContain('Escape rate (%),50');
    expect(csv).toContain(
      'Period,Bugs,Defects,Total,Resolution rate (%),Cost,Created,Resolved,Net,Backlog',
    );
    expect(csv).toContain('Jun 2026,1,0,1,0,10,1,0,1,1');
    expect(csv).toContain('Squad,Total,Open,Open Critical/Major');
    expect(csv).toContain('operation,1,1,1');
    expect(csv).toContain('Squad heat (open by severity),Critical,Total');
  });

  it('escapes cells containing commas or quotes', () => {
    const summary = computeAnalyticsSummary(
      [{ ...rows[0], real_project: 'ops, "core"' }],
      nowIso,
    );
    const trends = computeTrends([rows[0]], 'month', nowIso);
    const csv = buildAnalyticsCsv(summary, trends, nowIso);
    expect(csv).toContain('"ops, ""core""",1,1,1');
  });

  it('builds a dated filename', () => {
    expect(analyticsCsvFilename(nowIso)).toBe('defect-analytics-2026-07-14.csv');
  });
});
