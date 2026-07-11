import { describe, expect, it } from 'vitest';
import { applyFilters, parseBugBudgetFilters } from '../../src/filters/parse';
import { computeStats } from '../../src/filters/stats';

/** Appendix A.3 — normative filter fixture. */
describe('Appendix A.3: BB-API-03 filter fixture', () => {
  const rows = [
    {
      jira_key: 'AO-101',
      project: 'AO',
      issue_type: 'Bug',
      final_issue_type: 'Bug',
      is_open: true,
      status_category: 'To Do',
      severity_issue: 'Critical',
      priority: 'Highest',
      created_year: 2026,
    },
    {
      jira_key: 'AO-104',
      project: 'AO',
      issue_type: 'Bug',
      final_issue_type: 'Bug',
      is_open: true,
      status_category: 'To Do',
      severity_issue: 'Minor',
      priority: 'Medium',
      created_year: 2026,
    },
    {
      jira_key: 'FIN-7',
      project: 'FIN',
      issue_type: 'Bug',
      final_issue_type: 'Bug',
      is_open: true,
      status_category: 'To Do',
      severity_issue: 'Major',
      priority: 'High',
      created_year: 2026,
    },
    {
      jira_key: 'WH-3',
      project: 'WH',
      issue_type: 'Bug',
      final_issue_type: 'Bug',
      is_open: true,
      status_category: 'To Do',
      severity_issue: 'Low',
      priority: 'Low',
      created_year: 2026,
    },
    {
      jira_key: 'WH-4',
      project: 'WH',
      issue_type: 'Bug',
      final_issue_type: 'Bug',
      is_open: true,
      status_category: 'To Do',
      severity_issue: null,
      priority: 'Highest',
      created_year: 2026,
    },
    {
      jira_key: 'AO-103',
      project: 'AO',
      issue_type: 'Bug',
      final_issue_type: 'Bug',
      is_open: false,
      status_category: 'Done',
      severity_issue: 'Minor',
      priority: 'Low',
      created_year: 2026,
    },
    {
      jira_key: 'FIN-9',
      project: 'FIN',
      issue_type: 'Defect',
      final_issue_type: 'Defect',
      is_open: true,
      status_category: 'To Do',
      severity_issue: 'Minor',
      priority: 'Medium',
      created_year: 2026,
    },
  ];

  it('defaults return all 7 rows (bug scope, no excluded projects present)', () => {
    const parsed = parseBugBudgetFilters({});
    expect(applyFilters(rows, parsed)).toHaveLength(7);
  });

  it('?not_done=1 excludes Done status category → 6 rows', () => {
    const parsed = parseBugBudgetFilters({ not_done: '1' });
    expect(applyFilters(rows, parsed)).toHaveLength(6);
  });

  it('?issue_type_group=bug excludes Defect → 6 rows', () => {
    const parsed = parseBugBudgetFilters({ issue_type_group: 'bug' });
    expect(applyFilters(rows, parsed)).toHaveLength(6);
  });

  it('?open_critical_major=1 returns AO-101 and FIN-7', () => {
    const parsed = parseBugBudgetFilters({ open_critical_major: '1' });
    const result = applyFilters(rows, parsed);
    expect(result.map((r) => r.jira_key).sort()).toEqual(['AO-101', 'FIN-7']);
  });

  it('?project=WH&status_category=done returns empty', () => {
    const parsed = parseBugBudgetFilters({ project: 'WH', status_category: 'done' });
    expect(applyFilters(rows, parsed)).toHaveLength(0);
  });

  it('stats open_rate for defaults is 85.7', () => {
    const parsed = parseBugBudgetFilters({});
    const filtered = applyFilters(rows, parsed);
    const stats = computeStats(filtered, '2026-07-11T00:00:00+07:00');
    expect(stats.open_rate).toBe(85.7);
  });
});
