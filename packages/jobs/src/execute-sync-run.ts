import {
  BugBudgetRepository,
  JiraClient,
  SyncRunRepository,
  assertJiraEnabled,
  bumpBugBudgetCacheVersion,
  createServerClient,
  getJiraSettings,
  recordLastSyncUser,
  runBugBudgetSync,
  runOrphanCleanup,
  syncMaxPages,
  syncOnePage,
  syncProgressPercentage,
  type SyncAccumulators,
  type SyncResult,
} from '@momus/infra';

export type ExecuteSyncRunOptions = {
  syncRunId: number;
  requestedByLabel?: string;
  requestedById?: number;
  /**
   * When provided (Inngest), each Jira page is a durable step.
   * When omitted (inline BB-SYNC-07), runs as a single process.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  step?: {
    run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  };
};

/**
 * Drive a sync run from queued → running → completed|failed.
 * Used by the Inngest function and by non-prod inline execution (BB-SYNC-07).
 */
export async function executeBugBudgetSyncRun(
  options: ExecuteSyncRunOptions,
): Promise<SyncResult> {
  const { syncRunId, step } = options;
  const db = createServerClient();
  const runs = new SyncRunRepository(db);

  const load = async () => {
    const row = await runs.getById(syncRunId);
    if (!row) throw new Error(`Sync run ${syncRunId} not found`);
    return row;
  };

  const run = (step ? await step.run('load-run', load) : await load()) as RunRow;

  if (step) {
    await step.run('mark-running', async () => runs.markRunning(syncRunId));
  } else {
    await runs.markRunning(syncRunId);
  }

  try {
    const result = step
      ? await executePagedWithSteps({
          syncRunId,
          run,
          options,
          db,
          runs,
          step,
        })
      : await executeInline({
          syncRunId,
          run,
          options,
          db,
          runs,
        });

    if (step) {
      await step.run('mark-completed', async () => {
        await runs.markCompleted(syncRunId, result as unknown as Record<string, unknown>);
      });
    } else {
      await runs.markCompleted(syncRunId, result as unknown as Record<string, unknown>);
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (step) {
      await step.run('mark-failed', async () => runs.markFailed(syncRunId, message));
    } else {
      await runs.markFailed(syncRunId, message);
    }
    throw err;
  }
}

type RunRow = {
  jql: string;
  batch_size: number;
  max_total_issues: number;
};

async function executeInline(input: {
  syncRunId: number;
  run: RunRow;
  options: ExecuteSyncRunOptions;
  db: ReturnType<typeof createServerClient>;
  runs: SyncRunRepository;
}): Promise<SyncResult> {
  const jiraSettings = await getJiraSettings();
  assertJiraEnabled(jiraSettings);
  const jira = new JiraClient({
    baseUrl: jiraSettings.url,
    email: jiraSettings.username,
    apiToken: jiraSettings.apiToken,
  });
  const store = new BugBudgetRepository(input.db);

  return runBugBudgetSync({
    jql: input.run.jql,
    batchSize: input.run.batch_size,
    maxTotalIssues: input.run.max_total_issues,
    jira,
    store,
    onProgress: async (p) => {
      await input.runs.updateProgress(input.syncRunId, {
        processed: p.total_processed,
        currentBatch: p.current_batch,
        percentage: syncProgressPercentage(p.total_processed, p.max_total_issues),
        totalIssues: p.max_total_issues > 0 ? p.max_total_issues : undefined,
      });
    },
    afterSuccess: async () => {
      await bumpBugBudgetCacheVersion(input.db);
      await recordLastSyncUser(
        input.db,
        input.options.requestedByLabel ?? 'unknown',
        input.options.requestedById,
      );
    },
  });
}

async function executePagedWithSteps(input: {
  syncRunId: number;
  run: RunRow;
  options: ExecuteSyncRunOptions;
  db: ReturnType<typeof createServerClient>;
  runs: SyncRunRepository;
  step: NonNullable<ExecuteSyncRunOptions['step']>;
}): Promise<SyncResult> {
  const { step, run, syncRunId } = input;
  const maxTotalIssues = run.max_total_issues;
  const batchSize = Math.min(run.batch_size, 100);
  const maxPages = syncMaxPages(maxTotalIssues);
  const jql = run.jql.trim();

  let accum: SyncAccumulators = {
    totalProcessed: 0,
    newIssues: 0,
    updatedIssues: 0,
    errors: [],
    truncatedByCap: false,
  };
  let nextPageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const pageOut = (await step.run(`page-${page + 1}`, async () => {
      const jiraSettings = await getJiraSettings();
      assertJiraEnabled(jiraSettings);
      const jira = new JiraClient({
        baseUrl: jiraSettings.url,
        email: jiraSettings.username,
        apiToken: jiraSettings.apiToken,
      });
      const store = new BugBudgetRepository(input.db);

      const out = await syncOnePage({
        jql,
        batchSize,
        maxTotalIssues,
        currentBatch: page + 1,
        nextPageToken,
        accum,
        jira,
        store,
        transformOpts: { nowIso: new Date().toISOString() },
      });

      await input.runs.updateProgress(syncRunId, {
        processed: out.totalProcessed,
        currentBatch: page + 1,
        percentage: syncProgressPercentage(out.totalProcessed, maxTotalIssues),
        totalIssues: maxTotalIssues > 0 ? maxTotalIssues : undefined,
      });

      return out;
    })) as {
      nextPageToken?: string;
      isLast: boolean;
      truncatedByCap: boolean;
      totalProcessed: number;
      newIssues: number;
      updatedIssues: number;
      errors: SyncAccumulators['errors'];
    };

    accum = {
      totalProcessed: pageOut.totalProcessed,
      newIssues: pageOut.newIssues,
      updatedIssues: pageOut.updatedIssues,
      errors: pageOut.errors,
      truncatedByCap: pageOut.truncatedByCap,
    };
    nextPageToken = pageOut.nextPageToken;
    if (pageOut.isLast) break;
  }

  const deletedIssues = (await step.run('orphan-cleanup', async () => {
    const jiraSettings = await getJiraSettings();
    assertJiraEnabled(jiraSettings);
    const jira = new JiraClient({
      baseUrl: jiraSettings.url,
      email: jiraSettings.username,
      apiToken: jiraSettings.apiToken,
    });
    const store = new BugBudgetRepository(input.db);
    return runOrphanCleanup({
      jql,
      truncatedByCap: accum.truncatedByCap,
      jira,
      store,
    });
  })) as number | 'skipped';

  await step.run('cache-and-audit', async () => {
    await bumpBugBudgetCacheVersion(input.db);
    await recordLastSyncUser(
      input.db,
      input.options.requestedByLabel ?? 'unknown',
      input.options.requestedById,
    );
  });

  return {
    success: true,
    total_processed: accum.totalProcessed,
    new_issues: accum.newIssues,
    updated_issues: accum.updatedIssues,
    errors: accum.errors,
    jql_used: jql,
    deleted_issues: deletedIssues,
  };
}
