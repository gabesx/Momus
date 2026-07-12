import { describe, expect, it } from 'vitest';
import type { BugBudgetRow } from '@momus/domain';
import { omitOverriddenFields } from '@momus/domain';
import { toDbInsert } from './bug-budget.repository';

function sampleRow(overrides?: Partial<BugBudgetRow>): BugBudgetRow {
  return {
    jira_key: 'BUG-1',
    project: 'PROJ',
    real_project: 'PROJ',
    final_issue: 'BUG-1',
    summary: 'Sample',
    description: null,
    issue_type: 'Bug',
    final_issue_type: 'Bug',
    issue_level_type_layer_1: null,
    priority: 'High',
    severity_issue: 'Critical',
    status: 'Open',
    status_category: 'To Do',
    is_open: true,
    assignee: null,
    engineer_assignee: null,
    assignee_final: null,
    reporter: null,
    reports: null,
    pic_report: null,
    creator: null,
    tester_assignee: null,
    test_engineer_assignee: null,
    tested_by: null,
    owner: null,
    qa_checker: null,
    labels: null,
    ac_related_labels: null,
    created_date: null,
    updated_date: null,
    resolved_date: null,
    end_date: null,
    actual_end: null,
    due_date: null,
    created_year: 2026,
    created_num_month: null,
    created_month_alpha: null,
    quarter: null,
    closed_year: null,
    closed_month: null,
    closed_alpha_month: null,
    defect_age_days: null,
    defect_age_bucket: null,
    time_to_resolution_hours: null,
    defect_count: 1,
    bug_count: 1,
    bug_cost: null,
    parent: 'EPIC-1',
    parent_link: null,
    epic_link: null,
    parent_epic_key: null,
    epic_name: null,
    epic_level_epic: null,
    final_epic_name: null,
    sprint: null,
    components: null,
    fix_versions: null,
    linked_issues: null,
    has_linked_test_execution: false,
    time_spent_seconds: null,
    story_point_estimate: null,
    story_points: null,
    service_feature: 'Payments',
    start_date: null,
    begin_date: null,
    actual_start: null,
    chart_date_first_response: null,
    last_synced_at: '2026-07-12T00:00:00.000Z',
    raw_jira_data: {},
    progress_percentage: null,
    linked_parent_epic_info: null,
    story_task_level_epic_name: null,
    parent_epic_layer_2_key: null,
    issue_level_layer_2_type: null,
    epic_final_issue_type: null,
    pic_story_task_link_summary: null,
    epic_task_story_name_summary: null,
    service_feature_final: null,
    ...overrides,
  };
}

describe('bug-budget sync override omit', () => {
  it('strips severity when override present before toDbInsert shape', () => {
    const existing = { severity_issue: { at: 't', by: '1' } };
    const insert = omitOverriddenFields(toDbInsert(sampleRow()), existing);
    expect(insert.severity_issue).toBeUndefined();
    expect(insert.tracker_overrides).toBeUndefined();
  });

  it('strips has_linked_test_execution when linked_issues override present', () => {
    const existing = { linked_issues: { at: 't', by: '1' } };
    const insert = omitOverriddenFields(
      toDbInsert(
        sampleRow({
          linked_issues: [{ key: 'TE-1', type: 'Test Execution' }],
          has_linked_test_execution: true,
        }),
      ),
      existing,
    );
    expect(insert.linked_issues).toBeUndefined();
    expect(insert.has_linked_test_execution).toBeUndefined();
  });

  it('toDbInsert does not include tracker_overrides', () => {
    const insert = toDbInsert(sampleRow());
    expect(insert).not.toHaveProperty('tracker_overrides');
  });
});
