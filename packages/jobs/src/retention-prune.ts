import { SyncRunRepository, createServerClient } from '@momus/infra';
import { inngest } from './client';

/** BB-LIFE-02 — daily prune at 03:00 Asia/Jakarta (20:00 UTC). */
export const retentionPrune = inngest.createFunction(
  {
    id: 'bug-budget-retention-prune',
    triggers: { cron: '0 20 * * *' },
  },
  async ({ step }) => {
    return step.run('prune-sync-runs', async () => {
      const db = createServerClient();
      const runs = new SyncRunRepository(db);
      return runs.prunePerRetentionPolicy(new Date());
    });
  },
);
