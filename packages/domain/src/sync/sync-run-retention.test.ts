import { describe, expect, it } from 'vitest';
import { selectSyncRunIdsToPrune, type SyncRunRetentionRow } from './sync-run-retention';

const DAY_MS = 24 * 60 * 60 * 1000;

function row(
  id: number,
  createdAtIso: string,
  status: SyncRunRetentionRow['status'] = 'completed',
): SyncRunRetentionRow {
  return { id, created_at: createdAtIso, status };
}

describe('selectSyncRunIdsToPrune (BB-LIFE-02)', () => {
  const now = new Date('2026-07-11T10:00:00.000Z');

  it('keeps all when fewer than 500 runs', () => {
    const rows = [
      row(1, '2020-01-01T00:00:00.000Z'),
      row(2, '2021-01-01T00:00:00.000Z'),
    ];
    expect(selectSyncRunIdsToPrune(rows, now)).toEqual([]);
  });

  it('prunes terminal runs older than 180d and outside newest 500', () => {
    const rows: SyncRunRetentionRow[] = [];
    // ids 1..500 newest (within keep by count); id 501 old and beyond 500
    for (let i = 1; i <= 500; i++) {
      rows.push(row(i, new Date(now.getTime() - i * 60_000).toISOString()));
    }
    rows.push(row(501, new Date(now.getTime() - 200 * DAY_MS).toISOString(), 'completed'));
    rows.push(row(502, new Date(now.getTime() - 200 * DAY_MS).toISOString(), 'failed'));
    const ids = selectSyncRunIdsToPrune(rows, now);
    expect(ids.sort((a, b) => a - b)).toEqual([501, 502]);
  });

  it('keeps old runs that are still within newest 500', () => {
    const rows: SyncRunRetentionRow[] = [];
    for (let i = 1; i <= 500; i++) {
      rows.push(
        row(i, new Date(now.getTime() - (200 + i) * DAY_MS).toISOString(), 'completed'),
      );
    }
    expect(selectSyncRunIdsToPrune(rows, now)).toEqual([]);
  });

  it('keeps runs within 180d even if beyond newest 500', () => {
    const rows: SyncRunRetentionRow[] = [];
    for (let i = 1; i <= 500; i++) {
      rows.push(row(i, new Date(now.getTime() - i * 60_000).toISOString()));
    }
    // 501 is older by rank but still within 180 days
    rows.push(row(501, new Date(now.getTime() - 30 * DAY_MS).toISOString(), 'completed'));
    expect(selectSyncRunIdsToPrune(rows, now)).toEqual([]);
  });

  it('never prunes queued or running', () => {
    const rows: SyncRunRetentionRow[] = [];
    for (let i = 1; i <= 500; i++) {
      rows.push(row(i, new Date(now.getTime() - i * 60_000).toISOString()));
    }
    rows.push(row(501, new Date(now.getTime() - 200 * DAY_MS).toISOString(), 'queued'));
    rows.push(row(502, new Date(now.getTime() - 200 * DAY_MS).toISOString(), 'running'));
    rows.push(row(503, new Date(now.getTime() - 200 * DAY_MS).toISOString(), 'completed'));
    expect(selectSyncRunIdsToPrune(rows, now)).toEqual([503]);
  });
});
