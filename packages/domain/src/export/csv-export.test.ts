import { describe, expect, it } from 'vitest';
import { CSV_EXPORT_HEADERS, buildBugBudgetCsv, formatCsvDate } from './csv-export';
import {
  DEFAULT_PRIORITY_MULTIPLIERS,
  DEFAULT_SEVERITY_MULTIPLIERS,
} from '../constants/defaults';

describe('CSV export (BB-API-02 / D-1)', () => {
  it('emits aligned headers including Bug Cost', () => {
    expect(CSV_EXPORT_HEADERS).toEqual([
      'JIRA Key',
      'Project',
      'Summary',
      'Status',
      'Issue Type',
      'Priority',
      'Assignee',
      'Reporter',
      'Created Date',
      'Due Date',
      'Closed Date',
      'Complete Date',
      'Resolution Date',
      'Quarter',
      'Labels',
      'Sprint',
      'Story Points',
      'Age (Days)',
      'Bug Cost',
    ]);
    expect(CSV_EXPORT_HEADERS).toHaveLength(19);
  });

  it('formats dates as Y-m-d and computes bug cost', () => {
    const csv = buildBugBudgetCsv(
      [
        {
          jira_key: 'AO-1',
          project: 'AO',
          summary: 'Broken cart, needs "fix"',
          status: 'Open',
          issue_type: 'Bug',
          priority: 'Highest',
          assignee_final: 'Ada',
          reporter: 'Bob',
          created_date: '2026-01-15T10:00:00.000Z',
          due_date: '2026-02-01',
          end_date: null,
          actual_end: null,
          resolved_date: null,
          quarter: 'Q1 2026',
          labels: ['ac-related', 'p0'],
          sprint: 'Sprint 12',
          story_points: 3,
          defect_age_days: 5,
          severity_issue: 'Critical',
        },
      ],
      {
        priority: DEFAULT_PRIORITY_MULTIPLIERS,
        severity: DEFAULT_SEVERITY_MULTIPLIERS,
      },
    );

    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.split(',').length).toBe(19);
    expect(lines[1]).toContain('AO-1');
    expect(lines[1]).toContain('2026-01-15');
    expect(lines[1]).toContain('150'); // Highest×Critical = 2×75
    expect(lines[1]).toContain('"Broken cart, needs ""fix"""');
  });

  it('formatCsvDate strips time', () => {
    expect(formatCsvDate('2026-07-11T04:00:00.000Z')).toBe('2026-07-11');
    expect(formatCsvDate(null)).toBe('');
  });
});
