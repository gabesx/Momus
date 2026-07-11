import { SyncRunRepository, createServerClient } from '@momus/infra';
import { inngest } from './client';

/** Job timeout is 1200s; sweeper marks running > 2× timeout as failed (BB-NFR-05). */
const STUCK_AFTER_MS = 2 * 1200 * 1000;

export const stuckRunSweeper = inngest.createFunction(
  {
    id: 'bug-budget-stuck-run-sweeper',
    triggers: { cron: '*/15 * * * *' },
  },
  async ({ step }) => {
    return step.run('fail-stuck-runs', async () => {
      const db = createServerClient();
      const runs = new SyncRunRepository(db);
      const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
      const count = await runs.failStuckRuns(cutoff);
      return { failed: count, cutoff };
    });
  },
);
