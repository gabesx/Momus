import {
  jqlHasDateFilter,
  transformJiraIssue,
  type BugBudgetRow,
  type TransformOptions,
} from '@momus/domain';
import type { JiraSearchPage } from '../jira/client';

export type SyncProgressEvent = {
  current_batch: number;
  issues_in_batch: number;
  total_processed: number;
  is_last: boolean;
  max_total_issues: number;
};

export type SyncIssueError = {
  jira_key?: string;
  message: string;
};

export type SyncResult = {
  success: boolean;
  total_processed: number;
  new_issues: number;
  updated_issues: number;
  errors: SyncIssueError[];
  jql_used: string;
  /** Number deleted, or 'skipped' when cleanup was not run (date filter / truncated). */
  deleted_issues: number | 'skipped';
};

export type SyncJiraPort = {
  searchPage(input: {
    jql: string;
    maxResults?: number;
    nextPageToken?: string;
  }): Promise<JiraSearchPage>;
  fetchAllKeys(jql: string, pageSize?: number): Promise<string[]>;
};

export type SyncStorePort = {
  upsertMany(rows: BugBudgetRow[]): Promise<{ newCount: number; updatedCount: number }>;
  listKeys(): Promise<string[]>;
  deleteByKeys(keys: string[]): Promise<number>;
};

export type SyncAccumulators = {
  totalProcessed: number;
  newIssues: number;
  updatedIssues: number;
  errors: SyncIssueError[];
  truncatedByCap: boolean;
};

export type SyncPageResult = {
  nextPageToken?: string;
  isLast: boolean;
  truncatedByCap: boolean;
  issuesInBatch: number;
  totalProcessed: number;
  newIssues: number;
  updatedIssues: number;
  errors: SyncIssueError[];
};

export type RunBugBudgetSyncInput = {
  jql: string;
  batchSize?: number;
  maxTotalIssues?: number;
  jira: SyncJiraPort;
  store: SyncStorePort;
  onProgress?: (event: SyncProgressEvent) => void | Promise<void>;
  afterSuccess?: (result: SyncResult) => void | Promise<void>;
  nowIso?: string;
  transformOptions?: Omit<TransformOptions, 'nowIso'> & { nowIso?: string };
};

function resolveTransformOpts(input: {
  nowIso?: string;
  transformOptions?: Omit<TransformOptions, 'nowIso'> & { nowIso?: string };
}): TransformOptions {
  const nowIso = input.nowIso ?? input.transformOptions?.nowIso ?? new Date().toISOString();
  return { ...input.transformOptions, nowIso };
}

/** Process a single Jira search page (BB-SYNC-05 step unit for Inngest). */
export async function syncOnePage(input: {
  jql: string;
  batchSize: number;
  maxTotalIssues: number;
  currentBatch: number;
  nextPageToken?: string;
  accum: SyncAccumulators;
  jira: SyncJiraPort;
  store: SyncStorePort;
  transformOpts: TransformOptions;
}): Promise<SyncPageResult> {
  const { jql, batchSize, maxTotalIssues, accum, transformOpts } = input;
  const pageResult = await input.jira.searchPage({
    jql,
    maxResults: batchSize,
    nextPageToken: input.nextPageToken,
  });

  let issues = pageResult.issues;
  let truncatedByCap = accum.truncatedByCap;
  if (maxTotalIssues > 0 && accum.totalProcessed + issues.length > maxTotalIssues) {
    issues = issues.slice(0, maxTotalIssues - accum.totalProcessed);
    truncatedByCap = true;
  }

  let newIssues = 0;
  let updatedIssues = 0;
  const errors: SyncIssueError[] = [];
  let totalProcessed = accum.totalProcessed;

  for (const raw of issues) {
    const key = typeof raw.key === 'string' ? raw.key : undefined;
    try {
      const row = transformJiraIssue(
        raw as { key: string; fields?: Record<string, unknown> },
        transformOpts,
      );
      const counts = await input.store.upsertMany([row]);
      newIssues += counts.newCount;
      updatedIssues += counts.updatedCount;
      totalProcessed += 1;
    } catch (err) {
      errors.push({
        jira_key: key,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const isLast =
    truncatedByCap ||
    pageResult.isLast ||
    !pageResult.nextPageToken ||
    (maxTotalIssues > 0 && totalProcessed >= maxTotalIssues);

  return {
    nextPageToken: isLast ? undefined : pageResult.nextPageToken,
    isLast,
    truncatedByCap,
    issuesInBatch: issues.length,
    totalProcessed,
    newIssues: accum.newIssues + newIssues,
    updatedIssues: accum.updatedIssues + updatedIssues,
    errors: [...accum.errors, ...errors],
  };
}

/** Orphan cleanup — skipped when JQL has date filters or fetch was capped (BB-EDGE-10). */
export async function runOrphanCleanup(input: {
  jql: string;
  truncatedByCap: boolean;
  jira: SyncJiraPort;
  store: SyncStorePort;
}): Promise<number | 'skipped'> {
  if (jqlHasDateFilter(input.jql) || input.truncatedByCap) return 'skipped';
  const remoteKeys = new Set(await input.jira.fetchAllKeys(input.jql));
  const localKeys = (await input.store.listKeys()) ?? [];
  const orphans = localKeys.filter((k) => !remoteKeys.has(k));
  if (orphans.length === 0) return 0;
  return input.store.deleteByKeys(orphans);
}

/**
 * BB-SYNC-05 — page Jira, transform, upsert, optional orphan cleanup.
 * Pure orchestration over injected ports (no framework imports).
 */
export async function runBugBudgetSync(input: RunBugBudgetSyncInput): Promise<SyncResult> {
  const jql = input.jql.trim();
  const effectiveBatchSize = Math.min(input.batchSize ?? 50, 100);
  const maxTotalIssues = input.maxTotalIssues ?? 0;
  const maxPages = maxTotalIssues > 0 ? Math.ceil(maxTotalIssues / 100) + 1 : 500;
  const transformOpts = resolveTransformOpts(input);

  let accum: SyncAccumulators = {
    totalProcessed: 0,
    newIssues: 0,
    updatedIssues: 0,
    errors: [],
    truncatedByCap: false,
  };
  let nextPageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const pageOut = await syncOnePage({
      jql,
      batchSize: effectiveBatchSize,
      maxTotalIssues,
      currentBatch: page + 1,
      nextPageToken,
      accum,
      jira: input.jira,
      store: input.store,
      transformOpts,
    });

    accum = {
      totalProcessed: pageOut.totalProcessed,
      newIssues: pageOut.newIssues,
      updatedIssues: pageOut.updatedIssues,
      errors: pageOut.errors,
      truncatedByCap: pageOut.truncatedByCap,
    };

    if (input.onProgress) {
      await input.onProgress({
        current_batch: page + 1,
        issues_in_batch: pageOut.issuesInBatch,
        total_processed: pageOut.totalProcessed,
        is_last: pageOut.isLast,
        max_total_issues: maxTotalIssues,
      });
    }

    if (pageOut.isLast) break;
    nextPageToken = pageOut.nextPageToken;
  }

  const deletedIssues = await runOrphanCleanup({
    jql,
    truncatedByCap: accum.truncatedByCap,
    jira: input.jira,
    store: input.store,
  });

  const result: SyncResult = {
    success: true,
    total_processed: accum.totalProcessed,
    new_issues: accum.newIssues,
    updated_issues: accum.updatedIssues,
    errors: accum.errors,
    jql_used: jql,
    deleted_issues: deletedIssues,
  };

  if (input.afterSuccess) {
    await input.afterSuccess(result);
  }

  return result;
}

/** Progress percentage for sync_runs: ≤95 until markCompleted sets 100. */
export function syncProgressPercentage(processed: number, maxTotalIssues: number): number {
  if (maxTotalIssues > 0) {
    return Math.min(95, Math.floor((processed / maxTotalIssues) * 95));
  }
  return Math.min(95, Math.floor(Math.log10(processed + 1) * 30));
}

export function syncMaxPages(maxTotalIssues: number): number {
  return maxTotalIssues > 0 ? Math.ceil(maxTotalIssues / 100) + 1 : 500;
}
