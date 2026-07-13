import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildTrackerPatchUpdate,
  mergeTrackerOverrides,
  type TrackerEditableField,
  type TrackerIssueRow,
  type TrackerOverrides,
} from '@momus/domain';

const TRACKER_COLUMNS =
  'jira_key, project, summary, issue_type, parent, linked_issues, severity_issue, service_feature, service_feature_final, real_project, engineer_assignee, test_engineer_assignee, ac_related_labels, tester_assignee, owner, has_linked_test_execution, created_year, tracker_overrides, reporter, creator, description, labels, created_date, end_date, status';

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const batch = await fetchPage(from, from + pageSize - 1);
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export class TrackerRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listForFilters(): Promise<TrackerIssueRow[]> {
    return fetchAllPages(async (from, to) => {
      const { data, error } = await this.db
        .from('bug_budget')
        .select(TRACKER_COLUMNS)
        .range(from, to);
      if (error) throw new Error(`listForFilters failed: ${error.message}`);
      return (data ?? []) as TrackerIssueRow[];
    });
  }

  async patchFields(
    jiraKey: string,
    patch: Partial<Record<TrackerEditableField, unknown>>,
    meta: { at: string; by: string },
  ): Promise<TrackerIssueRow> {
    const { data: existing, error: loadError } = await this.db
      .from('bug_budget')
      .select(TRACKER_COLUMNS)
      .eq('jira_key', jiraKey)
      .maybeSingle();
    if (loadError) throw new Error(`patchFields load failed: ${loadError.message}`);
    if (!existing) throw new Error(`Tracker issue ${jiraKey} not found`);

    const currentOverrides = (existing.tracker_overrides ?? {}) as TrackerOverrides;
    const nextOverrides = mergeTrackerOverrides(currentOverrides, patch, meta);

    const columnPatch = buildTrackerPatchUpdate(patch);

    const { data: updated, error: updateError } = await this.db
      .from('bug_budget')
      .update({ ...columnPatch, tracker_overrides: nextOverrides })
      .eq('jira_key', jiraKey)
      .select(TRACKER_COLUMNS)
      .single();
    if (updateError) throw new Error(`patchFields update failed: ${updateError.message}`);

    return updated as TrackerIssueRow;
  }

  /** Distinct non-empty values for a tracker select field (Jira options fallback). */
  async listDistinctFieldValues(
    column: 'severity_issue' | 'service_feature',
  ): Promise<string[]> {
    const { data, error } = await this.db.from('bug_budget').select(column).not(column, 'is', null);
    if (error) throw new Error(`listDistinctFieldValues failed: ${error.message}`);

    const values = new Set<string>();
    for (const row of data ?? []) {
      const raw = (row as Record<string, unknown>)[column];
      if (typeof raw === 'string' && raw.trim()) values.add(raw.trim());
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }
}
