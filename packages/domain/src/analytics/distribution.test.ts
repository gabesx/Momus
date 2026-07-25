import { describe, expect, it } from 'vitest';
import { computeAnalyticsDistribution } from './distribution';
import type { AnalyticsIssueRow } from './types';

function row(
  partial: Partial<AnalyticsIssueRow> & Pick<AnalyticsIssueRow, 'project' | 'is_open'>,
): AnalyticsIssueRow {
  return {
    created_date: '2026-06-01T00:00:00+07:00',
    created_year: 2026,
    issue_type: 'Bug',
    ...partial,
  };
}

describe('computeAnalyticsDistribution', () => {
  it('groups by real_project with project fallback, sorted by total desc', () => {
    const res = computeAnalyticsDistribution([
      row({ project: 'AO', real_project: 'operation', is_open: true, severity_issue: 'Critical' }),
      row({ project: 'AO', real_project: 'operation', is_open: false }),
      row({ project: 'FIN', real_project: null, is_open: true }),
    ]);
    expect(res.by_squad).toEqual([
      { key: 'operation', total: 2, open: 1, open_critical_major: 1 },
      { key: 'FIN', total: 1, open: 1, open_critical_major: 0 },
    ]);
  });

  it('groups services with service_feature fallback and Unspecified bucket', () => {
    const res = computeAnalyticsDistribution([
      row({ project: 'A', is_open: true, service_feature_final: 'Checkout' }),
      row({ project: 'A', is_open: true, service_feature_final: '  ', service_feature: 'Search' }),
      row({ project: 'A', is_open: true }),
    ]);
    expect(res.by_service.map((e) => e.key).sort()).toEqual([
      'Checkout',
      'Search',
      'Unspecified',
    ]);
  });

  it('ranks engineers by open count with test_engineer fallback and Unassigned bucket', () => {
    const res = computeAnalyticsDistribution([
      row({ project: 'A', is_open: true, engineer_assignee: 'Dewi' }),
      row({ project: 'A', is_open: true, engineer_assignee: 'Dewi', severity_issue: 'Major' }),
      row({ project: 'A', is_open: true, engineer_assignee: null, test_engineer_assignee: 'Budi' }),
      row({ project: 'A', is_open: false, engineer_assignee: 'Sari' }),
      row({ project: 'A', is_open: true }),
    ]);
    expect(res.by_engineer[0]).toEqual({
      key: 'Dewi',
      total: 2,
      open: 2,
      open_critical_major: 1,
    });
    expect(res.by_engineer.map((e) => e.key)).toEqual(['Dewi', 'Budi', 'Unassigned', 'Sari']);
  });

  it('computes traceability percentage over all rows in scope', () => {
    const res = computeAnalyticsDistribution([
      row({ project: 'A', is_open: true, has_linked_test_execution: true }),
      row({ project: 'A', is_open: false, has_linked_test_execution: false }),
      row({ project: 'A', is_open: false, has_linked_test_execution: null }),
    ]);
    expect(res.traceability).toEqual({ linked: 1, total: 3, pct: 33.3 });
  });

  it('handles empty scope', () => {
    const res = computeAnalyticsDistribution([]);
    expect(res.by_squad).toEqual([]);
    expect(res.traceability).toEqual({ linked: 0, total: 0, pct: 0 });
    expect(res.squad_heat).toEqual({
      squads: [],
      severities: [],
      open: {},
      row_totals: {},
      col_totals: {},
      max: 0,
    });
  });
});

describe('computeAnalyticsDistribution squad_heat', () => {
  it('builds a squad × severity matrix of open counts', () => {
    const res = computeAnalyticsDistribution([
      row({ project: 'AO', real_project: 'operation', is_open: true, severity_issue: 'Critical' }),
      row({ project: 'AO', real_project: 'operation', is_open: true, severity_issue: 'Major' }),
      row({ project: 'AO', real_project: 'operation', is_open: true, severity_issue: 'Major' }),
      row({ project: 'FIN', real_project: 'FIN', is_open: true, severity_issue: 'Minor' }),
      // closed rows never enter the heat map
      row({ project: 'AO', real_project: 'operation', is_open: false, severity_issue: 'Critical' }),
    ]);
    const heat = res.squad_heat!;
    expect(heat.open.operation).toEqual({ Critical: 1, Major: 2 });
    expect(heat.open.FIN).toEqual({ Minor: 1 });
    expect(heat.row_totals).toEqual({ operation: 3, FIN: 1 });
    expect(heat.col_totals).toEqual({ Critical: 1, Major: 2, Minor: 1 });
    expect(heat.max).toBe(2);
  });

  it('orders severities by priority then squads worst-first', () => {
    const res = computeAnalyticsDistribution([
      // FIN: 1 Critical (worst)
      row({ project: 'FIN', real_project: 'FIN', is_open: true, severity_issue: 'Critical' }),
      // ops: 3 open but all Minor (no critical/major)
      row({ project: 'A', real_project: 'ops', is_open: true, severity_issue: 'Minor' }),
      row({ project: 'A', real_project: 'ops', is_open: true, severity_issue: 'Low' }),
      row({ project: 'A', real_project: 'ops', is_open: true, severity_issue: 'Minor' }),
    ]);
    const heat = res.squad_heat!;
    expect(heat.severities).toEqual(['Critical', 'Minor', 'Low']);
    // FIN first (1 open Critical/Major) even though ops has more open overall
    expect(heat.squads).toEqual(['FIN', 'ops']);
  });

  it('buckets blank severity as Unspecified and sorts it after known severities', () => {
    const res = computeAnalyticsDistribution([
      row({ project: 'A', real_project: 'ops', is_open: true, severity_issue: 'Major' }),
      row({ project: 'A', real_project: 'ops', is_open: true, severity_issue: '  ' }),
      row({ project: 'A', real_project: 'ops', is_open: true }),
    ]);
    const heat = res.squad_heat!;
    expect(heat.severities).toEqual(['Major', 'Unspecified']);
    expect(heat.open.ops).toEqual({ Major: 1, Unspecified: 2 });
  });
});
