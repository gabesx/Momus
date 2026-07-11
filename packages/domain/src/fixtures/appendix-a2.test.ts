import { describe, expect, it } from 'vitest';
import { buildOpenBugSummary } from '../../src/budget/summary';
import {
  DEFAULT_PRIORITY_MULTIPLIERS,
  DEFAULT_PROJECT_BUDGETS,
  DEFAULT_PROJECT_MAPPINGS,
  DEFAULT_SEVERITY_MULTIPLIERS,
} from '../../src/constants/defaults';

/** Appendix A.2 — normative Open Bug Summary fixture. */
describe('Appendix A.2: BB-CALC / BB-API-05 summary fixture', () => {
  const rows = [
    {
      jira_key: 'AO-101',
      project: 'AO',
      priority: 'Highest',
      severity_issue: 'Critical',
      is_open: true,
      final_issue_type: 'Bug',
      created_year: 2026,
      summary: 'a',
    },
    {
      jira_key: 'AO-104',
      project: 'AO',
      priority: 'Medium',
      severity_issue: 'Minor',
      is_open: true,
      final_issue_type: 'Bug',
      created_year: 2026,
      summary: 'b',
    },
    {
      jira_key: 'FIN-7',
      project: 'FIN',
      priority: 'High',
      severity_issue: 'Major',
      is_open: true,
      final_issue_type: 'Bug',
      created_year: 2026,
      summary: 'c',
    },
    {
      jira_key: 'WH-3',
      project: 'WH',
      priority: 'Low',
      severity_issue: 'Low',
      is_open: true,
      final_issue_type: 'Bug',
      created_year: 2026,
      summary: 'd',
    },
    {
      jira_key: 'WH-4',
      project: 'WH',
      priority: 'Highest',
      severity_issue: null,
      is_open: true,
      final_issue_type: 'Bug',
      created_year: 2026,
      summary: 'e',
    },
  ];

  const config = {
    multipliers: {
      priority: DEFAULT_PRIORITY_MULTIPLIERS,
      severity: DEFAULT_SEVERITY_MULTIPLIERS,
    },
    projectMappings: DEFAULT_PROJECT_MAPPINGS,
    projectBudgets: DEFAULT_PROJECT_BUDGETS,
  };

  const projects = buildOpenBugSummary(rows, ['AO', 'FIN', 'WH'], config, 2026);

  it('orders projects by ascending remaining_budget', () => {
    expect(projects.map((p) => p.project)).toEqual(['AO', 'FIN', 'WH']);
  });

  it('matches AO metrics (over budget)', () => {
    const ao = projects[0];
    expect(ao.display_name).toBe('operation');
    expect(ao.budget).toBe(100);
    expect(ao.total_open_bugs).toBe(2);
    expect(ao.total_cost).toBe(151.25);
    expect(ao.remaining_budget).toBe(0);
    expect(ao.budget_usage_percent).toBe(151.3);
    expect(ao.status_color).toBe('dark');
    expect(ao.status_message).toBe('Drop product initiative and Fix the debt');
    expect(Object.keys(ao.issues_by_severity)).toEqual(['Critical', 'Minor']);
  });

  it('matches FIN metrics', () => {
    const fin = projects[1];
    expect(fin.display_name).toBe('FINANCE');
    expect(fin.total_cost).toBe(37.5);
    expect(fin.remaining_budget).toBe(62.5);
    expect(fin.budget_usage_percent).toBe(37.5);
    expect(fin.status_color).toBe('warning');
    expect(fin.status_message).toBe('Warning');
    expect(Object.keys(fin.issues_by_severity)).toEqual(['Major']);
  });

  it('matches WH metrics with Unknown severity', () => {
    const wh = projects[2];
    expect(wh.display_name).toBe('WH');
    expect(wh.total_cost).toBe(2.25);
    expect(wh.remaining_budget).toBe(97.75);
    expect(wh.budget_usage_percent).toBe(2.3);
    expect(wh.status_color).toBe('success');
    expect(wh.status_message).toBe('Safe');
    expect(Object.keys(wh.issues_by_severity)).toEqual(['Low', 'Unknown']);
  });
});
