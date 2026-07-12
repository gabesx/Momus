import { buildDefaultJql } from '@momus/domain';
import {
  BugBudgetConfigRepository,
  SyncRunRepository,
  computeNextRunAt,
  createServerClient,
  ensureAutomatedSystemUser,
} from '@momus/infra';
import { EVENT_BUG_BUDGET_SYNC, inngest } from './client';

/**
 * BB-SCHED-01/02 — minutely tick: due cron_schedules → enqueue bug-budget/sync.
 */
export const schedulerTick = inngest.createFunction(
  {
    id: 'bug-budget-scheduler-tick',
    triggers: { cron: '* * * * *' },
  },
  async ({ step }) => {
    return step.run('dispatch-due-schedules', async () => {
      const db = createServerClient();
      const config = new BugBudgetConfigRepository(db);
      const runs = new SyncRunRepository(db);
      const now = new Date();
      const nowIso = now.toISOString();
      const due = await config.listDueCronSchedules(nowIso);
      const results: Array<Record<string, unknown>> = [];
      const systemUser =
        due.length > 0 ? await ensureAutomatedSystemUser(db) : null;

      for (const schedule of due) {
        try {
          const active = await runs.findActive();
          if (active) {
            results.push({
              id: schedule.id,
              status: 'skipped_overlap',
              active_id: active.id,
            });
            continue;
          }

          if (!systemUser) {
            throw new Error('automated system user unavailable');
          }

          const params = (schedule.command_params ?? {}) as {
            jql?: string | null;
            batch_size?: number;
            max_total_issues?: number;
          };
          let jql = (params.jql ?? '').trim();
          if (!jql) {
            const syncQuery = await config.getSyncQuery();
            jql = syncQuery.jql?.trim() || buildDefaultJql({ year: syncQuery.year });
          }
          const batchSize = params.batch_size ?? 50;
          const maxTotalIssues = params.max_total_issues ?? 0;

          const run = await runs.create({
            requestedBy: systemUser.id,
            syncType: 'custom',
            jql,
            batchSize,
            maxTotalIssues,
          });

          try {
            await inngest.send({
              name: EVENT_BUG_BUDGET_SYNC,
              data: {
                syncRunId: run.id,
                requestedByLabel: systemUser.email,
                requestedById: systemUser.id,
              },
            });
          } catch (sendErr) {
            const sendMessage =
              sendErr instanceof Error ? sendErr.message : String(sendErr);
            await runs.markFailed(
              run.id,
              `Scheduler enqueue failed: ${sendMessage}`,
            );
            throw sendErr;
          }

          const nextRunAt = computeNextRunAt({
            schedule_type: schedule.schedule_type,
            interval_days: schedule.interval_days,
            time: schedule.time,
            day_of_week: schedule.day_of_week,
            day_of_month: schedule.day_of_month,
            from: now,
          });

          await config.markCronTriggered(schedule.id, {
            last_run_at: nowIso,
            last_run_status: 'queued',
            last_run_result: `Triggered sync run #${run.id}`,
            next_run_at: nextRunAt,
          });

          results.push({
            id: schedule.id,
            status: 'triggered',
            sync_run_id: run.id,
            next_run_at: nextRunAt,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            '[scheduler-tick] schedule failed',
            schedule.id,
            schedule.name,
            message,
          );
          results.push({ id: schedule.id, status: 'error', message });
        }
      }

      return { checked: due.length, results, at: nowIso };
    });
  },
);
