import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncStatus } from '@momus/shared';

export type SyncRunRow = {
  id: number;
  requested_by: number;
  sync_type: string;
  jql: string;
  batch_size: number;
  max_total_issues: number;
  status: SyncStatus;
  total_issues: number;
  processed: number;
  current_batch: number;
  percentage: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type CreateSyncRunInput = {
  requestedBy: number;
  syncType?: string;
  jql: string;
  batchSize?: number;
  maxTotalIssues?: number;
};

export class SyncRunRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findActive(): Promise<SyncRunRow | null> {
    const { data, error } = await this.db
      .from('bug_budget_sync_runs')
      .select('*')
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`findActive sync run failed: ${error.message}`);
    return (data as SyncRunRow | null) ?? null;
  }

  async create(input: CreateSyncRunInput): Promise<SyncRunRow> {
    const { data, error } = await this.db
      .from('bug_budget_sync_runs')
      .insert({
        requested_by: input.requestedBy,
        sync_type: input.syncType ?? 'custom',
        jql: input.jql,
        batch_size: input.batchSize ?? 50,
        max_total_issues: input.maxTotalIssues ?? 0,
        status: 'queued',
      })
      .select('*')
      .single();
    if (error) throw new Error(`create sync run failed: ${error.message}`);
    return data as SyncRunRow;
  }

  async getById(id: number): Promise<SyncRunRow | null> {
    const { data, error } = await this.db
      .from('bug_budget_sync_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`get sync run failed: ${error.message}`);
    return (data as SyncRunRow | null) ?? null;
  }

  async markRunning(id: number): Promise<void> {
    const { error } = await this.db
      .from('bug_budget_sync_runs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        percentage: 0,
      })
      .eq('id', id);
    if (error) throw new Error(`markRunning failed: ${error.message}`);
  }

  async updateProgress(
    id: number,
    progress: {
      processed: number;
      totalIssues?: number;
      currentBatch: number;
      percentage: number;
    },
  ): Promise<void> {
    const percentage = Math.min(95, Math.max(0, progress.percentage));
    const { error } = await this.db
      .from('bug_budget_sync_runs')
      .update({
        processed: progress.processed,
        current_batch: progress.currentBatch,
        percentage,
        ...(progress.totalIssues != null ? { total_issues: progress.totalIssues } : {}),
      })
      .eq('id', id);
    if (error) throw new Error(`updateProgress failed: ${error.message}`);
  }

  async markCompleted(
    id: number,
    result: Record<string, unknown>,
  ): Promise<void> {
    const totalProcessed =
      typeof result.total_processed === 'number' ? result.total_processed : undefined;
    const { error } = await this.db
      .from('bug_budget_sync_runs')
      .update({
        status: 'completed',
        percentage: 100,
        result,
        completed_at: new Date().toISOString(),
        error_message: null,
        ...(totalProcessed != null
          ? { processed: totalProcessed, total_issues: totalProcessed }
          : {}),
      })
      .eq('id', id);
    if (error) throw new Error(`markCompleted failed: ${error.message}`);
  }

  async markFailed(id: number, errorMessage: string): Promise<void> {
    const { error } = await this.db
      .from('bug_budget_sync_runs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new Error(`markFailed failed: ${error.message}`);
  }

  /** BB-NFR-05: mark stuck running runs as failed. */
  async failStuckRuns(olderThanIso: string): Promise<number> {
    const { data, error } = await this.db
      .from('bug_budget_sync_runs')
      .update({
        status: 'failed',
        error_message: 'Marked failed by stuck-run sweeper',
        completed_at: new Date().toISOString(),
      })
      .eq('status', 'running')
      .lt('started_at', olderThanIso)
      .select('id');
    if (error) throw new Error(`failStuckRuns failed: ${error.message}`);
    return data?.length ?? 0;
  }

  /** Last N days of terminal sync runs for activity log. */
  async listRecent(days = 7, limit = 50): Promise<SyncRunRow[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db
      .from('bug_budget_sync_runs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listRecent sync runs failed: ${error.message}`);
    return (data ?? []) as SyncRunRow[];
  }
}
