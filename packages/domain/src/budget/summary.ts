import { calculateCost, type CostMultipliers } from './cost';
import {
  computeBudgetMetrics,
  resolveBudget,
  resolveDisplayName,
} from './status';
import { SEVERITY_ORDER } from '../constants/defaults';

export type SummaryIssueInput = {
  jira_key: string;
  project: string;
  summary?: string | null;
  priority?: string | null;
  severity_issue?: string | null;
  status?: string | null;
  reporter?: string | null;
  created_date?: string | null;
  defect_age_days?: number | null;
  is_open: boolean;
  final_issue_type: string | null;
  created_year?: number | null;
  epic_name?: string | null;
  parent?: string | null;
};

export type SummaryConfig = {
  multipliers: CostMultipliers;
  projectMappings: Record<string, string>;
  projectBudgets: Record<string, number>;
  defaultBudget?: number;
};

export type SummaryIssue = {
  jira_key: string;
  summary: string | null;
  severity: string;
  priority: string | null;
  status: string | null;
  reporter: string | null;
  created_date: string | null;
  cost: number;
  age_days: number | null;
  epic_parent?: string | null;
};

export type SummaryProject = {
  project: string;
  display_name: string;
  budget: number;
  total_open_bugs?: number;
  total_open_defects?: number;
  total_cost: number;
  remaining_budget: number;
  budget_usage_percent: number;
  status_color: string;
  status_message: string;
  issues_by_severity: Record<string, SummaryIssue[]>;
};

const DEFECT_TYPES = new Set(['Defect', 'Defect Sub-task', 'Defect Task']);

function severityKey(severity: string | null | undefined): string {
  return severity ?? 'Unknown';
}

function groupBySeverity(issues: SummaryIssue[]): Record<string, SummaryIssue[]> {
  const grouped: Record<string, SummaryIssue[]> = {};
  for (const order of SEVERITY_ORDER) {
    const bucket = issues.filter((i) => i.severity === order);
    if (bucket.length > 0) grouped[order] = bucket;
  }
  // Any unexpected severities
  for (const issue of issues) {
    if (!(SEVERITY_ORDER as readonly string[]).includes(issue.severity)) {
      grouped[issue.severity] = grouped[issue.severity] ?? [];
      if (!grouped[issue.severity].includes(issue)) grouped[issue.severity].push(issue);
    }
  }
  return grouped;
}

function toSummaryIssue(
  row: SummaryIssueInput,
  cost: number,
  includeEpicParent: boolean,
): SummaryIssue {
  const issue: SummaryIssue = {
    jira_key: row.jira_key,
    summary: row.summary ?? null,
    severity: severityKey(row.severity_issue),
    priority: row.priority ?? null,
    status: row.status ?? null,
    reporter: row.reporter ?? null,
    created_date: row.created_date ?? null,
    cost,
    age_days: row.defect_age_days ?? null,
  };
  if (includeEpicParent) {
    issue.epic_parent = row.epic_name ?? row.parent ?? null;
  }
  return issue;
}

/**
 * BB-CALC-06 / BB-API-05 — Open Bug Summary.
 * Includes all distinct projects (zero-issue → Safe).
 */
export function buildOpenBugSummary(
  rows: SummaryIssueInput[],
  allProjectKeys: string[],
  config: SummaryConfig,
  year?: number | null,
): SummaryProject[] {
  const openBugs = rows.filter(
    (r) =>
      r.is_open &&
      r.final_issue_type === 'Bug' &&
      (year == null || r.created_year === year),
  );

  const byProject = new Map<string, SummaryIssueInput[]>();
  for (const key of allProjectKeys) byProject.set(key, []);
  for (const row of openBugs) {
    const list = byProject.get(row.project) ?? [];
    list.push(row);
    byProject.set(row.project, list);
  }

  const projects: SummaryProject[] = [];
  for (const [projectKey, issues] of byProject) {
    const display_name = resolveDisplayName(projectKey, config.projectMappings);
    const budget = resolveBudget(display_name, config.projectBudgets, config.defaultBudget ?? 100);
    const summaryIssues = issues.map((row) =>
      toSummaryIssue(row, calculateCost(row.priority, row.severity_issue, config.multipliers), false),
    );
    const total_cost = summaryIssues.reduce((sum, i) => sum + i.cost, 0);
    const metrics = computeBudgetMetrics(budget, total_cost);
    projects.push({
      project: projectKey,
      display_name,
      ...metrics,
      total_open_bugs: summaryIssues.length,
      issues_by_severity: groupBySeverity(summaryIssues),
    });
  }

  projects.sort((a, b) => {
    if (a.remaining_budget !== b.remaining_budget) {
      return a.remaining_budget - b.remaining_budget;
    }
    return b.total_cost - a.total_cost;
  });

  return projects;
}

/**
 * BB-CALC-06 — Open Defect Summary.
 * Only projects that have open defects.
 */
export function buildOpenDefectSummary(
  rows: SummaryIssueInput[],
  config: SummaryConfig,
  year?: number | null,
): SummaryProject[] {
  const openDefects = rows.filter(
    (r) =>
      r.is_open &&
      r.final_issue_type != null &&
      DEFECT_TYPES.has(r.final_issue_type) &&
      (year == null || r.created_year === year),
  );

  const byProject = new Map<string, SummaryIssueInput[]>();
  for (const row of openDefects) {
    const list = byProject.get(row.project) ?? [];
    list.push(row);
    byProject.set(row.project, list);
  }

  const projects: SummaryProject[] = [];
  for (const [projectKey, issues] of byProject) {
    const display_name = resolveDisplayName(projectKey, config.projectMappings);
    const budget = resolveBudget(display_name, config.projectBudgets, config.defaultBudget ?? 100);
    const summaryIssues = issues.map((row) =>
      toSummaryIssue(row, calculateCost(row.priority, row.severity_issue, config.multipliers), true),
    );
    const total_cost = summaryIssues.reduce((sum, i) => sum + i.cost, 0);
    const metrics = computeBudgetMetrics(budget, total_cost);
    projects.push({
      project: projectKey,
      display_name,
      ...metrics,
      total_open_defects: summaryIssues.length,
      issues_by_severity: groupBySeverity(summaryIssues),
    });
  }

  projects.sort((a, b) => {
    if (a.remaining_budget !== b.remaining_budget) {
      return a.remaining_budget - b.remaining_budget;
    }
    return b.total_cost - a.total_cost;
  });

  return projects;
}
