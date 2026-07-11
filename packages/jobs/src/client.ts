import { Inngest } from 'inngest';

/** Shared Inngest client for Momus jobs. */
export const inngest = new Inngest({ id: 'momus' });

export const EVENT_BUG_BUDGET_SYNC = 'bug-budget/sync' as const;

export type BugBudgetSyncEventData = {
  syncRunId: number;
  requestedByLabel?: string;
  requestedById?: number;
};
