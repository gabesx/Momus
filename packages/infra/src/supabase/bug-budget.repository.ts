import type { SupabaseClient } from '@supabase/supabase-js';
import { omitOverriddenFields, type BugBudgetRow, type TrackerOverrides } from '@momus/domain';

/** Map domain row (snake_case already) to DB insert payload. */
export function toDbInsert(row: BugBudgetRow): Record<string, unknown> {
  return {
    jira_key: row.jira_key,
    project: row.project,
    real_project: row.real_project,
    final_issue: row.final_issue,
    summary: row.summary,
    description: row.description,
    issue_type: row.issue_type,
    final_issue_type: row.final_issue_type,
    issue_level_type_layer_1: row.issue_level_type_layer_1,
    priority: row.priority,
    severity_issue: row.severity_issue,
    status: row.status,
    status_category: row.status_category,
    is_open: row.is_open,
    assignee: row.assignee,
    engineer_assignee: row.engineer_assignee,
    assignee_final: row.assignee_final,
    reporter: row.reporter,
    reports: row.reports,
    pic_report: row.pic_report,
    creator: row.creator,
    tester_assignee: row.tester_assignee,
    test_engineer_assignee: row.test_engineer_assignee,
    tested_by: row.tested_by,
    owner: row.owner,
    qa_checker: row.qa_checker,
    labels: row.labels,
    ac_related_labels: row.ac_related_labels,
    created_date: row.created_date,
    updated_date: row.updated_date,
    resolved_date: row.resolved_date,
    end_date: row.end_date,
    actual_end: row.actual_end,
    due_date: row.due_date,
    created_year: row.created_year,
    created_num_month: row.created_num_month,
    created_month_alpha: row.created_month_alpha,
    quarter: row.quarter,
    closed_year: row.closed_year,
    closed_month: row.closed_month,
    closed_alpha_month: row.closed_alpha_month,
    defect_age_days: row.defect_age_days,
    defect_age_bucket: row.defect_age_bucket,
    time_to_resolution_hours: row.time_to_resolution_hours,
    defect_count: row.defect_count,
    bug_count: row.bug_count,
    bug_cost: null,
    parent: row.parent,
    parent_link: row.parent_link,
    epic_link: row.epic_link,
    parent_epic_key: row.parent_epic_key,
    epic_name: row.epic_name,
    epic_level_epic: row.epic_level_epic,
    final_epic_name: row.final_epic_name,
    sprint: row.sprint,
    components: row.components,
    fix_versions: row.fix_versions,
    linked_issues: row.linked_issues,
    has_linked_test_execution: row.has_linked_test_execution,
    time_spent_seconds: row.time_spent_seconds,
    story_point_estimate: row.story_point_estimate,
    story_points: row.story_points,
    service_feature: row.service_feature,
    start_date: row.start_date,
    begin_date: row.begin_date,
    actual_start: row.actual_start,
    chart_date_first_response: row.chart_date_first_response,
    last_synced_at: row.last_synced_at,
    raw_jira_data: row.raw_jira_data,
    progress_percentage: null,
    linked_parent_epic_info: null,
    story_task_level_epic_name: null,
    parent_epic_layer_2_key: null,
    issue_level_layer_2_type: null,
    epic_final_issue_type: null,
    pic_story_task_link_summary: null,
    epic_task_story_name_summary: null,
    service_feature_final: null,
  };
}

export class BugBudgetRepository {
  constructor(private readonly db: SupabaseClient) {}

  async existsByKey(jiraKey: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('bug_budget')
      .select('id')
      .eq('jira_key', jiraKey)
      .maybeSingle();
    if (error) throw new Error(`existsByKey failed: ${error.message}`);
    return data != null;
  }

  async getTrackerOverrides(jiraKey: string): Promise<TrackerOverrides | null> {
    const { data, error } = await this.db
      .from('bug_budget')
      .select('tracker_overrides')
      .eq('jira_key', jiraKey)
      .maybeSingle();
    if (error) throw new Error(`getTrackerOverrides failed: ${error.message}`);
    return (data?.tracker_overrides as TrackerOverrides | undefined) ?? null;
  }

  async upsertMany(rows: BugBudgetRow[]): Promise<{ newCount: number; updatedCount: number }> {
    let newCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
      const existed = await this.existsByKey(row.jira_key);
      const overrides = await this.getTrackerOverrides(row.jira_key);
      const payload = omitOverriddenFields(toDbInsert(row), overrides);
      const { error } = await this.db.from('bug_budget').upsert(payload, {
        onConflict: 'jira_key',
      });
      if (error) throw new Error(`upsert ${row.jira_key} failed: ${error.message}`);
      if (existed) updatedCount += 1;
      else newCount += 1;
    }
    return { newCount, updatedCount };
  }

  async listKeys(): Promise<string[]> {
    const keys: string[] = [];
    let from = 0;
    const pageSize = 1000;
    for (;;) {
      const { data, error } = await this.db
        .from('bug_budget')
        .select('jira_key')
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`listKeys failed: ${error.message}`);
      const batch = data ?? [];
      for (const row of batch) keys.push(row.jira_key as string);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return keys;
  }

  async deleteByKeys(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const { data, error } = await this.db
      .from('bug_budget')
      .delete()
      .in('jira_key', keys)
      .select('id');
    if (error) throw new Error(`deleteByKeys failed: ${error.message}`);
    return data?.length ?? 0;
  }
}
