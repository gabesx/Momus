import { isOpenStatusCategory } from '../budget/is-open';
import {
  calendarFieldsFromCreated,
  calendarFieldsFromResolved,
  computeDefectAgeDays,
  defectAgeBucket,
  pre2024AgeFromRaw,
  timeToResolutionHours,
} from '../age/business-days';
import { adfToPlainText, deriveAcRelatedLabels, findQaChecker } from './ac-labels';
import { BUG_GROUP_TYPES, DEFAULT_QA_CHECKER_NAMES, DEFECT_GROUP_TYPES } from '../constants/defaults';

export type JiraFieldMapping = Record<string, string>;

export const DEFAULT_JIRA_FIELD_MAP: JiraFieldMapping = {
  customfield_10069: 'severity_issue',
  customfield_10042: 'tester',
  customfield_10014: 'epic_link',
  customfield_10011: 'epic_name',
  customfield_10016: 'story_point_estimate',
  customfield_10029: 'story_points',
  customfield_10020: 'sprint',
  customfield_10076: 'service_feature',
  customfield_10015: 'start_date',
  customfield_10056: 'begin_date',
  customfield_10008: 'actual_start',
  customfield_10024: 'chart_date_first_response',
};

export type TransformOptions = {
  nowIso: string;
  holidays?: readonly string[];
  qaCheckerNames?: readonly string[];
  fieldMap?: JiraFieldMapping;
};

export type BugBudgetRow = {
  jira_key: string;
  project: string;
  real_project: string;
  final_issue: string;
  summary: string;
  description: string | null;
  issue_type: string | null;
  final_issue_type: string | null;
  issue_level_type_layer_1: string | null;
  priority: string | null;
  severity_issue: string | null;
  status: string | null;
  status_category: string | null;
  is_open: boolean;
  assignee: string | null;
  engineer_assignee: string | null;
  assignee_final: string | null;
  reporter: string | null;
  reports: string | null;
  pic_report: string | null;
  creator: string | null;
  tester_assignee: string | null;
  test_engineer_assignee: string | null;
  tested_by: string | null;
  owner: string | null;
  qa_checker: string | null;
  labels: string[] | null;
  ac_related_labels: string[] | null;
  created_date: string | null;
  updated_date: string | null;
  resolved_date: string | null;
  end_date: string | null;
  actual_end: string | null;
  due_date: string | null;
  created_year: number | null;
  created_num_month: number | null;
  created_month_alpha: string | null;
  quarter: string | null;
  closed_year: number | null;
  closed_month: string | null;
  closed_alpha_month: string | null;
  defect_age_days: number | null;
  defect_age_bucket: string | null;
  time_to_resolution_hours: number | null;
  defect_count: number;
  bug_count: number;
  bug_cost: null;
  parent: string | null;
  parent_link: string | null;
  epic_link: string | null;
  parent_epic_key: string | null;
  epic_name: string | null;
  epic_level_epic: string | null;
  final_epic_name: string | null;
  sprint: string | null;
  components: string[] | null;
  fix_versions: string[] | null;
  linked_issues: { key: string; type: string }[] | null;
  has_linked_test_execution: boolean;
  time_spent_seconds: number | null;
  story_point_estimate: number | null;
  story_points: number | null;
  service_feature: string | null;
  start_date: string | null;
  begin_date: string | null;
  actual_start: string | null;
  chart_date_first_response: string | null;
  last_synced_at: string;
  raw_jira_data: unknown;
  progress_percentage: null;
  linked_parent_epic_info: null;
  story_task_level_epic_name: null;
  parent_epic_layer_2_key: null;
  issue_level_layer_2_type: null;
  epic_final_issue_type: null;
  pic_story_task_link_summary: null;
  epic_task_story_name_summary: null;
  service_feature_final: null;
};

type JiraIssue = {
  key: string;
  fields?: Record<string, unknown>;
};

function displayName(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null;
  return ((user as { displayName?: string }).displayName as string) ?? null;
}

function customValue(field: unknown): string | null {
  if (field == null) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'number') return String(field);
  if (typeof field === 'object' && 'value' in (field as object)) {
    return String((field as { value: unknown }).value);
  }
  return null;
}

function latestSprintName(sprintField: unknown): string | null {
  if (!Array.isArray(sprintField) || sprintField.length === 0) return null;
  const parsed = sprintField.map((s, idx) => {
    if (typeof s === 'string') {
      const name = /name=([^,\]]+)/.exec(s)?.[1] ?? null;
      const id = Number(/id=(\d+)/.exec(s)?.[1] ?? idx);
      return { id, name };
    }
    if (s && typeof s === 'object') {
      const obj = s as { id?: number; name?: string };
      return { id: obj.id ?? idx, name: obj.name ?? null };
    }
    return { id: idx, name: null };
  });
  parsed.sort((a, b) => b.id - a.id);
  return parsed[0]?.name ?? null;
}

function issueLevelLayer1(issueType: string | null): string | null {
  if (!issueType) return null;
  if ((BUG_GROUP_TYPES as readonly string[]).includes(issueType)) return 'Bug';
  if ((DEFECT_GROUP_TYPES as readonly string[]).includes(issueType)) return 'Defect';
  return issueType;
}

function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // Keep as date string YYYY-MM-DD when possible
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  return iso;
}

/** BB-SYNC-04: transform Jira issue → bug_budget row fields. */
export function transformJiraIssue(issue: JiraIssue, options: TransformOptions): BugBudgetRow {
  const fields = issue.fields ?? {};
  const fieldMap = options.fieldMap ?? DEFAULT_JIRA_FIELD_MAP;
  const qaList = options.qaCheckerNames ?? DEFAULT_QA_CHECKER_NAMES;
  const holidays = options.holidays ?? [];

  const projectKey =
    typeof fields.project === 'object' && fields.project
      ? String((fields.project as { key?: string }).key ?? '')
      : String(fields.project ?? '');

  const issueType =
    typeof fields.issuetype === 'object' && fields.issuetype
      ? String((fields.issuetype as { name?: string }).name ?? '')
      : null;

  const priority =
    typeof fields.priority === 'object' && fields.priority
      ? String((fields.priority as { name?: string }).name ?? '')
      : null;

  const statusObj = fields.status as { name?: string; statusCategory?: { name?: string } } | undefined;
  const status = statusObj?.name ?? null;
  const statusCategory = statusObj?.statusCategory?.name ?? 'New';

  const severityField = fields[Object.keys(fieldMap).find((k) => fieldMap[k] === 'severity_issue') ?? 'customfield_10069'];
  const severity_issue = customValue(severityField);

  const testerField = fields[Object.keys(fieldMap).find((k) => fieldMap[k] === 'tester') ?? 'customfield_10042'];
  const tester = displayName(testerField) ?? customValue(testerField);

  const assignee = displayName(fields.assignee);
  const reporter = displayName(fields.reporter);
  const creator = displayName(fields.creator);

  const created = typeof fields.created === 'string' ? fields.created : null;
  const resolutiondate = typeof fields.resolutiondate === 'string' ? fields.resolutiondate : null;
  const updated = typeof fields.updated === 'string' ? fields.updated : null;

  const labels = Array.isArray(fields.labels) ? (fields.labels as string[]) : null;
  const summary = String(fields.summary ?? '');

  const isBugType = issueType === 'Bug';
  const isDefectType = issueType != null && (DEFECT_GROUP_TYPES as readonly string[]).includes(issueType);

  const createdFields = created
    ? calendarFieldsFromCreated(created)
    : { created_year: null, created_num_month: null, created_month_alpha: null, quarter: null };
  const closedFields = calendarFieldsFromResolved(resolutiondate);

  let defect_age_days: number | null = null;
  if (created) {
    if (createdFields.created_year != null && createdFields.created_year < 2024) {
      defect_age_days = pre2024AgeFromRaw(created, issue as { fields?: Record<string, unknown> }, holidays);
    } else {
      defect_age_days = computeDefectAgeDays({
        createdIso: created,
        endIso: resolutiondate,
        nowIso: options.nowIso,
        holidays,
      });
    }
  }

  const parentKey =
    typeof fields.parent === 'object' && fields.parent
      ? String((fields.parent as { key?: string }).key ?? '')
      : null;

  const epicLinkField = fields['customfield_10014'];
  const epicLink =
    typeof epicLinkField === 'string'
      ? epicLinkField
      : epicLinkField && typeof epicLinkField === 'object'
        ? String((epicLinkField as { key?: string }).key ?? '')
        : null;

  const epicName = customValue(fields['customfield_10011']);

  const components = Array.isArray(fields.components)
    ? (fields.components as { name?: string }[]).map((c) => c.name ?? '').filter(Boolean)
    : null;
  const fixVersions = Array.isArray(fields.fixVersions)
    ? (fields.fixVersions as { name?: string }[]).map((c) => c.name ?? '').filter(Boolean)
    : null;

  const linked_issues: { key: string; type: string }[] = [];
  if (Array.isArray(fields.issuelinks)) {
    for (const link of fields.issuelinks as Array<Record<string, unknown>>) {
      const typeName =
        typeof link.type === 'object' && link.type
          ? String((link.type as { name?: string }).name ?? '')
          : '';
      const inward = link.inwardIssue as { key?: string } | undefined;
      const outward = link.outwardIssue as { key?: string } | undefined;
      if (inward?.key) linked_issues.push({ key: inward.key, type: typeName });
      if (outward?.key) linked_issues.push({ key: outward.key, type: typeName });
    }
  }

  const has_linked_test_execution = linked_issues.some((l) =>
    /test execution/i.test(l.type),
  );

  const timetracking = fields.timetracking as { timeSpentSeconds?: number } | undefined;

  return {
    jira_key: issue.key,
    project: projectKey,
    real_project: projectKey,
    final_issue: issue.key,
    summary,
    description: adfToPlainText(fields.description),
    issue_type: issueType,
    final_issue_type: issueType,
    issue_level_type_layer_1: issueLevelLayer1(issueType),
    priority,
    severity_issue,
    status,
    status_category: statusCategory,
    is_open: isOpenStatusCategory(statusCategory),
    assignee,
    engineer_assignee: assignee,
    assignee_final: assignee,
    reporter,
    reports: reporter,
    pic_report: reporter,
    creator,
    tester_assignee: tester,
    test_engineer_assignee: tester,
    tested_by: tester,
    owner: isBugType ? tester : isDefectType ? assignee : null,
    qa_checker: findQaChecker({ assignee, reporter, tester }, qaList),
    labels,
    ac_related_labels: deriveAcRelatedLabels(labels, issueType, summary),
    created_date: created,
    updated_date: updated,
    resolved_date: resolutiondate,
    end_date: dateOnly(resolutiondate),
    actual_end: resolutiondate,
    due_date: dateOnly(typeof fields.duedate === 'string' ? fields.duedate : null),
    ...createdFields,
    ...closedFields,
    defect_age_days,
    defect_age_bucket: defect_age_days != null ? defectAgeBucket(defect_age_days) : null,
    time_to_resolution_hours:
      created && resolutiondate ? timeToResolutionHours(created, resolutiondate) : null,
    defect_count: 1,
    bug_count: issueType === 'Bug' || issueType === 'Defect' ? 1 : 0,
    bug_cost: null,
    parent: parentKey,
    parent_link: parentKey,
    epic_link: epicLink,
    parent_epic_key: epicLink,
    epic_name: epicName,
    epic_level_epic: epicName,
    final_epic_name: epicName,
    sprint: latestSprintName(fields['customfield_10020']),
    components,
    fix_versions: fixVersions,
    linked_issues: linked_issues.length ? linked_issues : null,
    has_linked_test_execution,
    time_spent_seconds: timetracking?.timeSpentSeconds ?? null,
    story_point_estimate:
      typeof fields['customfield_10016'] === 'number' ? fields['customfield_10016'] : null,
    story_points:
      typeof fields['customfield_10029'] === 'number' ? fields['customfield_10029'] : null,
    service_feature: customValue(fields['customfield_10076']),
    start_date: dateOnly(customValue(fields['customfield_10015'])),
    begin_date: dateOnly(customValue(fields['customfield_10056'])),
    actual_start:
      typeof fields['customfield_10008'] === 'string' ? fields['customfield_10008'] : null,
    chart_date_first_response:
      typeof fields['customfield_10024'] === 'string' ? fields['customfield_10024'] : null,
    last_synced_at: options.nowIso,
    raw_jira_data: issue,
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
