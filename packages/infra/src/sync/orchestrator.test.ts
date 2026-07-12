import { describe, expect, it, vi } from 'vitest';
import {
  resolveSyncExpectedTotal,
  runBugBudgetSync,
  syncProgressPercentage,
} from './orchestrator';
import type { BugBudgetRow } from '@momus/domain';

function issue(key: string): Record<string, unknown> {
  return {
    key,
    fields: {
      project: { key: 'SWAT' },
      summary: `Summary ${key}`,
      status: { name: 'Open', statusCategory: { name: 'To Do' } },
      issuetype: { name: 'Bug' },
      priority: { name: 'High' },
      created: '2026-01-15T10:00:00.000+0700',
      updated: '2026-01-16T10:00:00.000+0700',
      labels: [],
    },
  };
}

describe('runBugBudgetSync (BB-SYNC-05)', () => {
  it('pages issues, upserts, and reports progress', async () => {
    const searchPage = vi
      .fn()
      .mockResolvedValueOnce({
        issues: [issue('SWAT-1'), issue('SWAT-2')],
        nextPageToken: 't2',
        isLast: false,
      })
      .mockResolvedValueOnce({
        issues: [issue('SWAT-3')],
        isLast: true,
      });

    const upsertMany = vi.fn(async (rows: BugBudgetRow[]) => ({
      newCount: rows.length,
      updatedCount: 0,
    }));
    const onProgress = vi.fn();
    const afterSuccess = vi.fn();

    const result = await runBugBudgetSync({
      jql: 'issuetype = Bug AND created >= "2026-01-01"',
      batchSize: 50,
      maxTotalIssues: 0,
      jira: { searchPage, fetchAllKeys: vi.fn() },
      store: {
        upsertMany,
        listKeys: vi.fn(),
        deleteByKeys: vi.fn(),
      },
      onProgress,
      afterSuccess,
      nowIso: '2026-07-11T04:00:00.000Z',
    });

    expect(result.success).toBe(true);
    expect(result.total_processed).toBe(3);
    expect(result.new_issues).toBe(3);
    expect(result.updated_issues).toBe(0);
    expect(result.errors).toEqual([]);
    expect(result.jql_used).toContain('issuetype = Bug');
    expect(result.deleted_issues).toBe('skipped'); // date filter
    expect(searchPage).toHaveBeenCalledTimes(2);
    expect(upsertMany).toHaveBeenCalledTimes(3); // per-issue upserts
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(afterSuccess).toHaveBeenCalledOnce();
  });

  it('collects per-issue upsert errors without aborting', async () => {
    const searchPage = vi.fn().mockResolvedValue({
      issues: [issue('OK-1'), issue('BAD-1'), issue('OK-2')],
      isLast: true,
    });

    const selectiveUpsert = vi.fn(async (rows: BugBudgetRow[]) => {
      for (const row of rows) {
        if (row.jira_key === 'BAD-1') throw new Error('upsert failed for BAD-1');
      }
      return { newCount: rows.length, updatedCount: 0 };
    });

    const result = await runBugBudgetSync({
      jql: 'project = SWAT',
      jira: {
        searchPage,
        fetchAllKeys: vi.fn().mockResolvedValue(['OK-1', 'OK-2']),
      },
      store: {
        upsertMany: selectiveUpsert,
        listKeys: vi.fn().mockResolvedValue(['OK-1', 'OK-2']),
        deleteByKeys: vi.fn().mockResolvedValue(0),
      },
      nowIso: '2026-07-11T04:00:00.000Z',
    });

    expect(result.success).toBe(true);
    expect(result.total_processed).toBe(2);
    expect(result.errors).toEqual([
      { jira_key: 'BAD-1', message: 'upsert failed for BAD-1' },
    ]);
  });

  it('skips orphan cleanup when JQL has a date filter', async () => {
    const fetchAllKeys = vi.fn();
    const deleteByKeys = vi.fn();
    const searchPage = vi.fn().mockResolvedValue({
      issues: [issue('A-1')],
      isLast: true,
    });

    const result = await runBugBudgetSync({
      jql: 'issuetype = Bug AND updated >= -30d',
      jira: { searchPage, fetchAllKeys },
      store: {
        upsertMany: vi.fn(async (rows) => ({ newCount: rows.length, updatedCount: 0 })),
        listKeys: vi.fn(),
        deleteByKeys,
      },
      nowIso: '2026-07-11T04:00:00.000Z',
    });

    expect(result.deleted_issues).toBe('skipped');
    expect(fetchAllKeys).not.toHaveBeenCalled();
    expect(deleteByKeys).not.toHaveBeenCalled();
  });

  it('skips orphan cleanup when fetch was truncated by max_total_issues (BB-EDGE-10)', async () => {
    const fetchAllKeys = vi.fn();
    const deleteByKeys = vi.fn();
    const searchPage = vi.fn().mockResolvedValue({
      issues: [issue('A-1'), issue('A-2'), issue('A-3')],
      nextPageToken: 'more',
      isLast: false,
    });

    const result = await runBugBudgetSync({
      jql: 'issuetype = Bug',
      maxTotalIssues: 2,
      batchSize: 100,
      jira: { searchPage, fetchAllKeys },
      store: {
        upsertMany: vi.fn(async (rows) => ({ newCount: rows.length, updatedCount: 0 })),
        listKeys: vi.fn().mockResolvedValue(['A-1', 'A-2', 'ORPHAN-1']),
        deleteByKeys,
      },
      nowIso: '2026-07-11T04:00:00.000Z',
    });

    expect(result.total_processed).toBe(2);
    expect(result.deleted_issues).toBe('skipped');
    expect(fetchAllKeys).not.toHaveBeenCalled();
    expect(deleteByKeys).not.toHaveBeenCalled();
  });

  it('deletes local orphans when JQL has no date filter and fetch was complete', async () => {
    const searchPage = vi.fn().mockResolvedValue({
      issues: [issue('KEEP-1')],
      isLast: true,
    });
    const fetchAllKeys = vi.fn().mockResolvedValue(['KEEP-1']);
    const deleteByKeys = vi.fn().mockResolvedValue(1);
    const listKeys = vi.fn().mockResolvedValue(['KEEP-1', 'GONE-1']);

    const result = await runBugBudgetSync({
      jql: 'issuetype = Bug AND project = SWAT',
      jira: { searchPage, fetchAllKeys },
      store: {
        upsertMany: vi.fn(async (rows) => ({ newCount: rows.length, updatedCount: 0 })),
        listKeys,
        deleteByKeys,
      },
      nowIso: '2026-07-11T04:00:00.000Z',
    });

    expect(result.deleted_issues).toBe(1);
    expect(fetchAllKeys).toHaveBeenCalledWith('issuetype = Bug AND project = SWAT');
    expect(deleteByKeys).toHaveBeenCalledWith(['GONE-1']);
  });

  it('caps batch size at 100', async () => {
    const searchPage = vi.fn().mockResolvedValue({ issues: [], isLast: true });
    await runBugBudgetSync({
      jql: 'issuetype = Bug',
      batchSize: 500,
      jira: {
        searchPage,
        fetchAllKeys: vi.fn().mockResolvedValue([]),
      },
      store: {
        upsertMany: vi.fn(),
        listKeys: vi.fn().mockResolvedValue([]),
        deleteByKeys: vi.fn().mockResolvedValue(0),
      },
      nowIso: '2026-07-11T04:00:00.000Z',
    });
    expect(searchPage).toHaveBeenCalledWith(
      expect.objectContaining({ maxResults: 100 }),
    );
  });

  it('syncOnePage accumulates counts across calls', async () => {
    const { syncOnePage } = await import('./orchestrator');
    const searchPage = vi.fn().mockResolvedValue({
      issues: [issue('P-1')],
      isLast: true,
    });
    const out = await syncOnePage({
      jql: 'issuetype = Bug',
      batchSize: 50,
      maxTotalIssues: 0,
      currentBatch: 1,
      accum: {
        totalProcessed: 2,
        newIssues: 2,
        updatedIssues: 0,
        errors: [],
        truncatedByCap: false,
      },
      jira: { searchPage, fetchAllKeys: vi.fn() },
      store: {
        upsertMany: vi.fn(async () => ({ newCount: 1, updatedCount: 0 })),
        listKeys: vi.fn(),
        deleteByKeys: vi.fn(),
      },
      transformOpts: { nowIso: '2026-07-11T04:00:00.000Z' },
    });
    expect(out.totalProcessed).toBe(3);
    expect(out.newIssues).toBe(3);
    expect(out.isLast).toBe(true);
  });
});

describe('resolveSyncExpectedTotal', () => {
  it('uses Jira approx count when under the configured cap', () => {
    expect(resolveSyncExpectedTotal(912, 10000)).toBe(912);
  });

  it('caps approx count by max_total_issues', () => {
    expect(resolveSyncExpectedTotal(15000, 10000)).toBe(10000);
  });

  it('falls back to max_total_issues when approx is unavailable', () => {
    expect(resolveSyncExpectedTotal(0, 10000)).toBe(10000);
  });

  it('returns 0 when neither approx nor cap is set', () => {
    expect(resolveSyncExpectedTotal(0, 0)).toBe(0);
  });
});

describe('syncProgressPercentage', () => {
  it('scales against expected total and caps at 95', () => {
    expect(syncProgressPercentage(456, 912)).toBe(47);
    expect(syncProgressPercentage(912, 912)).toBe(95);
  });
});

describe('runBugBudgetSync progress with approximateCount', () => {
  it('reports expected_total from Jira approx count (not the raw cap)', async () => {
    const searchPage = vi.fn().mockResolvedValue({
      issues: [issue('A-1'), issue('A-2')],
      isLast: true,
    });
    const approximateCount = vi.fn().mockResolvedValue(912);
    const onProgress = vi.fn();

    const result = await runBugBudgetSync({
      jql: 'issuetype = Bug',
      maxTotalIssues: 10000,
      jira: { searchPage, fetchAllKeys: vi.fn(), approximateCount },
      store: {
        upsertMany: vi.fn(async (rows) => ({ newCount: rows.length, updatedCount: 0 })),
        listKeys: vi.fn().mockResolvedValue([]),
        deleteByKeys: vi.fn().mockResolvedValue(0),
      },
      onProgress,
      nowIso: '2026-07-11T04:00:00.000Z',
    });

    expect(approximateCount).toHaveBeenCalledWith('issuetype = Bug');
    expect(result.expected_total).toBe(912);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        total_processed: 0,
        expected_total: 912,
        max_total_issues: 10000,
      }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        total_processed: 2,
        expected_total: 912,
        is_last: true,
      }),
    );
  });
});
