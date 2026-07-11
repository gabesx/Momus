import { describe, expect, it } from 'vitest';
import { transformJiraIssue } from '../../src/sync/transform';

/** Appendix A.1 — normative transform fixture. */
describe('Appendix A.1: BB-SYNC-04 transform fixture', () => {
  const input = {
    key: 'AO-102',
    fields: {
      project: { key: 'AO' },
      summary: 'Cart total wrong after voucher removal',
      issuetype: { name: 'Bug' },
      priority: { name: 'Medium' },
      customfield_10069: { value: 'Minor' },
      status: { name: 'Done', statusCategory: { name: 'Done' } },
      created: '2026-03-02T09:00:00.000+0700',
      resolutiondate: '2026-03-06T17:00:00.000+0700',
      assignee: { displayName: 'Budi Santoso' },
      reporter: { displayName: 'Annisa Novianti' },
      labels: ['non-ac-related'],
    },
  };

  const row = transformJiraIssue(input, {
    nowIso: '2026-03-10T12:00:00.000+0700',
    holidays: [],
  });

  it('maps identity and type columns', () => {
    expect(row.jira_key).toBe('AO-102');
    expect(row.final_issue).toBe('AO-102');
    expect(row.project).toBe('AO');
    expect(row.real_project).toBe('AO');
    expect(row.issue_type).toBe('Bug');
    expect(row.final_issue_type).toBe('Bug');
    expect(row.issue_level_type_layer_1).toBe('Bug');
  });

  it('sets is_open false for Done status category', () => {
    expect(row.is_open).toBe(false);
  });

  it('maps people fields', () => {
    expect(row.assignee).toBe('Budi Santoso');
    expect(row.assignee_final).toBe('Budi Santoso');
    expect(row.engineer_assignee).toBe('Budi Santoso');
    expect(row.owner).toBeNull();
    expect(row.qa_checker).toBe('Annisa Novianti');
  });

  it('maps calendar fields', () => {
    expect(row.created_year).toBe(2026);
    expect(row.created_num_month).toBe(3);
    expect(row.created_month_alpha).toBe('March');
    expect(row.quarter).toBe('Q1 2026');
    expect(row.closed_year).toBe(2026);
    expect(row.closed_alpha_month).toBe('March');
  });

  it('computes age and resolution hours', () => {
    expect(row.defect_age_days).toBe(5);
    expect(row.defect_age_bucket).toBe('fresh');
    expect(row.time_to_resolution_hours).toBe(104);
  });

  it('keeps explicit AC labels and counters', () => {
    expect(row.ac_related_labels).toEqual(['non-ac-related']);
    expect(row.bug_count).toBe(1);
    expect(row.defect_count).toBe(1);
    expect(row.bug_cost).toBeNull();
  });
});
