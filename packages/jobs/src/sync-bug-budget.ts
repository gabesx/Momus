import { EVENT_BUG_BUDGET_SYNC, inngest, type BugBudgetSyncEventData } from './client';
import { executeBugBudgetSyncRun } from './execute-sync-run';

/**
 * BB-SYNC-06 — background sync job with one Inngest step per Jira page.
 */
export const syncBugBudget = inngest.createFunction(
  {
    id: 'bug-budget-sync',
    retries: 2,
    concurrency: { limit: 1 },
    triggers: { event: EVENT_BUG_BUDGET_SYNC },
  },
  async ({ event, step }) => {
    const data = event.data as BugBudgetSyncEventData;
    return executeBugBudgetSyncRun({
      syncRunId: data.syncRunId,
      requestedByLabel: data.requestedByLabel,
      requestedById: data.requestedById,
      step: {
        run: (id, fn) => step.run(id, fn),
      },
    });
  },
);
