import { describe, expect, it } from 'vitest';
import { buildAnalyticsDigest } from './digest';
import { computeAnalyticsSummary } from './summary';
import { computeTrends } from './trends';
import type { AnalyticsIssueRow } from './types';

const nowIso = '2026-07-14T10:00:00+07:00';

const rows: AnalyticsIssueRow[] = [
  {
    project: 'AO',
    real_project: 'operation',
    created_date: '2026-07-01T00:00:00+07:00',
    created_year: 2026,
    is_open: true,
    issue_type: 'Bug',
    severity_issue: 'Critical',
    defect_age_days: 90,
    engineer_assignee: 'Dewi',
  },
  {
    project: 'FIN',
    created_date: '2026-06-01T00:00:00+07:00',
    created_year: 2026,
    is_open: false,
    issue_type: 'Defect',
    time_to_resolution_hours: 48,
    labels: ['found-in-prod'],
  },
];

describe('buildAnalyticsDigest', () => {
  it('includes KPIs, risk, SLA, quality, and top offenders', () => {
    const summary = computeAnalyticsSummary(rows, nowIso);
    const trends = computeTrends(rows, 'month', nowIso);
    const text = buildAnalyticsDigest(summary, trends, {
      dateLabel: '2026-07-14',
      dashboardUrl: 'https://momus.example.com/',
    });

    expect(text).toContain('*Momus weekly defect digest — 2026-07-14*');
    expect(text).toContain('2 total');
    expect(text).toContain('1 Critical/Major');
    expect(text).toContain('MTTR: avg 48h');
    expect(text).toContain('escape rate 50%');
    expect(text).toContain('Top squads: operation (1), FIN (1)');
    expect(text).toContain('Top open workload: Dewi (1 open)');
    expect(text).toContain('<https://momus.example.com/|Open the dashboard>');
  });

  it('omits offender lines when scope is empty', () => {
    const summary = computeAnalyticsSummary([], nowIso);
    const trends = computeTrends([], 'month', nowIso);
    const text = buildAnalyticsDigest(summary, trends, { dateLabel: '2026-07-14' });
    expect(text).not.toContain('Top squads');
    expect(text).not.toContain('Top open workload');
  });
});
