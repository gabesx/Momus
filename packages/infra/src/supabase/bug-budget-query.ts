import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_PRIORITY_MULTIPLIERS,
  DEFAULT_SEVERITY_MULTIPLIERS,
  type CostMultipliers,
  type DateRange,
  type SummaryConfig,
  type SummaryIssueInput,
  applyFilters,
  extractFilterOptions,
  parseBugBudgetFilters,
  type BugBudgetFilterParams,
  type FilterOptions,
  type ParsedFilters,
} from '@momus/domain';

const SUMMARY_COLUMNS =
  'jira_key, project, summary, priority, severity_issue, status, reporter, created_date, defect_age_days, is_open, final_issue_type, created_year, epic_name, parent, issue_type, status_category, assignee_final, ac_related_labels, quarter, labels, sprint, story_points, due_date, end_date, actual_end, resolved_date, updated_at, tested_by, service_feature, tester_assignee, owner';

/** Narrow column set for leaderboard rankings + reporter drill. */
export const LEADERBOARD_COLUMNS =
  'reporter, issue_type, project, status, created_date, jira_key, summary, severity_issue, priority, parent, service_feature, ac_related_labels, tester_assignee, owner';

/**
 * Inclusive end YYYY-MM-DD → exclusive next-day bound for PostgREST `lt`.
 * Matches domain `dateInRange` which compares `isoDate.slice(0, 10)`.
 */
export function exclusiveEndAfterInclusiveYmd(endYmd: string): string {
  const [y, m, d] = endYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export type BugBudgetListRow = SummaryIssueInput & {
  issue_type?: string | null;
  status_category?: string | null;
  assignee_final?: string | null;
  ac_related_labels?: string[] | null;
  quarter?: string | null;
  labels?: string[] | null;
  sprint?: string | null;
  story_points?: number | null;
  due_date?: string | null;
  end_date?: string | null;
  actual_end?: string | null;
  resolved_date?: string | null;
  updated_at?: string | null;
  tested_by?: string | null;
  service_feature?: string | null;
  tester_assignee?: string | null;
  owner?: string | null;
};

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

export class BugBudgetQueryRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listSummaryInputs(year?: number | null): Promise<SummaryIssueInput[]> {
    const rows = await fetchAllPages(async (from, to) => {
      let q = this.db.from('bug_budget').select(SUMMARY_COLUMNS).range(from, to);
      if (year != null) q = q.eq('created_year', year);
      const { data, error } = await q;
      if (error) throw new Error(`listSummaryInputs failed: ${error.message}`);
      return (data ?? []) as SummaryIssueInput[];
    });
    return rows;
  }

  async listDistinctProjects(): Promise<string[]> {
    const { data, error } = await this.db.from('bug_budget').select('project');
    if (error) throw new Error(`listDistinctProjects failed: ${error.message}`);
    return [...new Set((data ?? []).map((r) => r.project as string).filter(Boolean))].sort();
  }

  async listAllForFilters(): Promise<BugBudgetListRow[]> {
    return fetchAllPages(async (from, to) => {
      const { data, error } = await this.db
        .from('bug_budget')
        .select(SUMMARY_COLUMNS)
        .range(from, to);
      if (error) throw new Error(`listAllForFilters failed: ${error.message}`);
      return (data ?? []) as BugBudgetListRow[];
    });
  }

  /**
   * Leaderboard rows only: 14 columns, optional created_date window.
   * Pass `null` range for period_type `all`.
   */
  async listForLeaderboard(range: DateRange | null): Promise<BugBudgetListRow[]> {
    return fetchAllPages(async (from, to) => {
      let q = this.db.from('bug_budget').select(LEADERBOARD_COLUMNS).range(from, to);
      if (range) {
        q = q
          .gte('created_date', range.start)
          .lt('created_date', exclusiveEndAfterInclusiveYmd(range.end));
      }
      const { data, error } = await q;
      if (error) throw new Error(`listForLeaderboard failed: ${error.message}`);
      return (data ?? []) as BugBudgetListRow[];
    });
  }

  /**
   * Filter + paginate in memory (Phase 3). Suitable until row counts require SQL RPC.
   */
  async findFiltered(params: BugBudgetFilterParams): Promise<{
    parsed: ParsedFilters;
    rows: BugBudgetListRow[];
    total: number;
    pageRows: BugBudgetListRow[];
    filter_options: FilterOptions;
  }> {
    const parsed = parseBugBudgetFilters(params);
    const all = await this.listAllForFilters();
    const filter_options = extractFilterOptions(all);
    const filtered = applyFilters(all, parsed);

    const sorted = [...filtered].sort((a, b) => {
      const field = parsed.sort as keyof BugBudgetListRow;
      const av = a[field] ?? '';
      const bv = b[field] ?? '';
      if (av === bv) return 0;
      const cmp = av! > bv! ? 1 : -1;
      return parsed.direction === 'asc' ? cmp : -cmp;
    });

    const start = (parsed.page - 1) * parsed.perPage;
    const pageRows = sorted.slice(start, start + parsed.perPage);

    return { parsed, rows: sorted, total: sorted.length, pageRows, filter_options };
  }

  async getById(id: number): Promise<BugBudgetListRow | null> {
    const { data, error } = await this.db
      .from('bug_budget')
      .select(`id, ${SUMMARY_COLUMNS}`)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`getById failed: ${error.message}`);
    return (data as BugBudgetListRow | null) ?? null;
  }

  async countAll(): Promise<number> {
    const { count, error } = await this.db
      .from('bug_budget')
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(`countAll failed: ${error.message}`);
    return count ?? 0;
  }

  async getByJiraKey(jiraKey: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.db
      .from('bug_budget')
      .select('*')
      .eq('jira_key', jiraKey)
      .maybeSingle();
    if (error) throw new Error(`getByJiraKey failed: ${error.message}`);
    return data as Record<string, unknown> | null;
  }
}

export async function loadSummaryConfig(db: SupabaseClient): Promise<SummaryConfig> {
  const { data, error } = await db
    .from('bug_budget_config')
    .select('key, value')
    .in('key', ['priority_multipliers', 'severity_multipliers', 'project_budgets', 'project_mappings']);

  if (error) throw new Error(`loadSummaryConfig failed: ${error.message}`);

  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));

  const priority =
    (map.get('priority_multipliers') as Record<string, number> | undefined) ??
    DEFAULT_PRIORITY_MULTIPLIERS;
  const severity =
    (map.get('severity_multipliers') as Record<string, number> | undefined) ??
    DEFAULT_SEVERITY_MULTIPLIERS;
  const projectBudgets =
    (map.get('project_budgets') as Record<string, number> | undefined) ?? {};
  const projectMappings =
    (map.get('project_mappings') as Record<string, string> | undefined) ?? {};

  const multipliers: CostMultipliers = { priority, severity };

  return {
    multipliers,
    projectBudgets,
    projectMappings,
    defaultBudget: 100,
  };
}

/** Project keys for open-bug summary: DB projects ∪ Jira mapping keys. */
export function resolveAllProjectKeys(
  dbProjects: string[],
  config: SummaryConfig,
): string[] {
  return [...new Set([...dbProjects, ...Object.keys(config.projectMappings)])]
    .filter(Boolean)
    .sort();
}
