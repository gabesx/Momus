import { after } from 'next/server';
import {
  SyncRunRepository,
  assertJiraEnabled,
  createServerClient,
  getJiraSettings,
  shouldRunInlineSync,
} from '@momus/infra';
import {
  EVENT_BUG_BUDGET_SYNC,
  executeBugBudgetSyncRun,
  inngest,
} from '@momus/jobs';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk, resolveSyncParams } from '@/lib/sync-params';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const params = resolveSyncParams(body);
    if (typeof params === 'string') return jsonFail(params, 422);

    const settings = await getJiraSettings();
    assertJiraEnabled(settings);

    const db = createServerClient();
    const runs = new SyncRunRepository(db);

    const active = await runs.findActive();
    if (active) {
      return jsonFail('A sync is already in progress', 409, {
        sync_run_id: active.id,
        active_status: active.status,
      });
    }

    let run;
    try {
      run = await runs.create({
        requestedBy: auth.user.id,
        syncType: params.syncType,
        jql: params.jql,
        batchSize: params.batchSize,
        maxTotalIssues: params.maxTotalIssues,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create sync run';
      if (message.includes('bug_budget_sync_runs') || message.includes('schema')) {
        return jsonFail(message, 503);
      }
      throw err;
    }

    const payload = {
      syncRunId: run.id,
      requestedByLabel: auth.user.email,
      requestedById: auth.user.id,
    };

    const inline = shouldRunInlineSync();
    if (inline) {
      after(() =>
        executeBugBudgetSyncRun(payload).catch((err) => {
          console.error('[bug-budget-sync] inline run failed', err);
        }),
      );
    } else if (process.env.INNGEST_EVENT_KEY) {
      await inngest.send({
        name: EVENT_BUG_BUDGET_SYNC,
        data: payload,
      });
    } else {
      await runs.markFailed(
        run.id,
        'No sync worker available: set INNGEST_EVENT_KEY or SYNC_INLINE_AFTER_RESPONSE=true',
      );
      return jsonFail(
        'No sync worker available: set INNGEST_EVENT_KEY or SYNC_INLINE_AFTER_RESPONSE=true',
        503,
        { sync_run_id: run.id },
      );
    }

    return jsonOk({
      queued: true,
      sync_run_id: run.id,
      message: inline ? 'Sync queued (inline worker)' : 'Sync queued',
      inline,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to queue sync';
    const status = message.includes('disabled') || message.includes('incomplete') ? 422 : 500;
    return jsonFail(message, status);
  }
}
