import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * BB-CACHE-01 for analytics: per-instance TTL cache validated against the
 * bug_budget cache version, which the sync bumps on every successful run.
 * A hit skips refetching the whole bug_budget table; a version bump or TTL
 * expiry recomputes.
 */
type CacheEntry = {
  version: number;
  expiresAt: number;
  payload: unknown;
};

const TTL_MS = 300_000; // seed cache_ttl.summary default (300s)
const MAX_ENTRIES = 100;

const store = new Map<string, CacheEntry>();

export async function getBugBudgetCacheVersion(db: SupabaseClient): Promise<number> {
  const { data, error } = await db
    .from('cache_versions')
    .select('version')
    .eq('key', 'bug_budget')
    .maybeSingle();
  if (error) throw new Error(`read cache version failed: ${error.message}`);
  return data?.version ?? 0;
}

export function getCachedAnalytics(key: string, version: number): unknown | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.version !== version || Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.payload;
}

export function setCachedAnalytics(key: string, version: number, payload: unknown): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { version, expiresAt: Date.now() + TTL_MS, payload });
}

/** Test hook. */
export function clearAnalyticsCache(): void {
  store.clear();
}
