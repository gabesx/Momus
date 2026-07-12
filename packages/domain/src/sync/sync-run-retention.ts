/** Lightweight row for BB-LIFE-02 retention eligibility. */
export type SyncRunRetentionRow = {
  id: number;
  created_at: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
};

export const RETENTION_MAX_AGE_DAYS = 180;
export const RETENTION_KEEP_NEWEST = 500;

const ACTIVE = new Set(['queued', 'running']);

/**
 * Return ids safe to delete: not in keep-set (newest N ∪ within max age)
 * and not queued/running.
 */
export function selectSyncRunIdsToPrune(
  rows: SyncRunRetentionRow[],
  now: Date = new Date(),
): number[] {
  if (rows.length === 0) return [];

  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const keep = new Set<number>();
  for (let i = 0; i < Math.min(RETENTION_KEEP_NEWEST, sorted.length); i++) {
    keep.add(sorted[i]!.id);
  }

  const cutoff = now.getTime() - RETENTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  for (const r of sorted) {
    if (new Date(r.created_at).getTime() >= cutoff) {
      keep.add(r.id);
    }
  }

  const toDelete: number[] = [];
  for (const r of sorted) {
    if (keep.has(r.id)) continue;
    if (ACTIVE.has(r.status)) continue;
    toDelete.push(r.id);
  }
  return toDelete;
}
