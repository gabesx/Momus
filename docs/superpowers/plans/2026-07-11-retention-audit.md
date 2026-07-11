# Sync-run Retention & Settings Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily prune of `bug_budget_sync_runs` per BB-LIFE-02, and best-effort `audit_logs` writes on Bug Budget settings saves (DEV-10 / BB-LIFE-05) with masked Jira token.

**Architecture:** Pure domain retention eligibility → infra load/delete + `AuditLogRepository` → Inngest daily `retention-prune` → settings POST routes load before → save → best-effort audit.

**Tech Stack:** TypeScript, Vitest, Inngest, Supabase, `@momus/domain` / `@momus/infra` / `@momus/jobs` / `@momus/web`.

**Spec:** `docs/superpowers/specs/2026-07-11-retention-audit-design.md`

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/domain/src/sync/sync-run-retention.ts` | Pure: ids to prune (180d ∪ newest 500; never queued/running) |
| `packages/domain/src/sync/sync-run-retention.test.ts` | Unit tests |
| `packages/domain/src/index.ts` | Re-export |
| `packages/infra/src/supabase/sync-runs.repository.ts` | `listRetentionCandidates`, `deleteByIds`, `prunePerRetentionPolicy` |
| `packages/infra/src/supabase/audit-logs.repository.ts` | Insert `audit_logs` |
| `packages/infra/src/supabase/index.ts` | Export audit repo |
| `packages/jobs/src/retention-prune.ts` | Inngest cron `0 20 * * *` (03:00 Asia/Jakarta) |
| `packages/jobs/src/index.ts` | Register `retentionPrune` |
| `apps/web/lib/audit.ts` | Best-effort `writeSettingsAudit` helper |
| Six settings POST routes | Call audit helper after successful save |

---

### Task 1: Domain — sync-run retention eligibility

**Files:**
- Create: `packages/domain/src/sync/sync-run-retention.ts`
- Create: `packages/domain/src/sync/sync-run-retention.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @momus/domain exec vitest run src/sync/sync-run-retention.test.ts
```

Expected: FAIL (module / export missing).

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Re-export from `packages/domain/src/index.ts`**

Add: `export * from './sync/sync-run-retention';`

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter @momus/domain exec vitest run src/sync/sync-run-retention.test.ts
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/sync/sync-run-retention.ts packages/domain/src/sync/sync-run-retention.test.ts packages/domain/src/index.ts
git commit -m "feat(domain): BB-LIFE-02 sync-run retention eligibility"
```

---

### Task 2: Infra — prune helpers on SyncRunRepository

**Files:**
- Modify: `packages/infra/src/supabase/sync-runs.repository.ts`

- [ ] **Step 1: Add methods to `SyncRunRepository`**

```ts
import { selectSyncRunIdsToPrune, type SyncRunRetentionRow } from '@momus/domain';

// inside class SyncRunRepository:

async listRetentionCandidates(): Promise<SyncRunRetentionRow[]> {
  const { data, error } = await this.db
    .from('bug_budget_sync_runs')
    .select('id, created_at, status')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listRetentionCandidates failed: ${error.message}`);
  return (data ?? []) as SyncRunRetentionRow[];
}

async deleteByIds(ids: number[], batchSize = 200): Promise<number> {
  if (ids.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const { data, error } = await this.db
      .from('bug_budget_sync_runs')
      .delete()
      .in('id', chunk)
      .select('id');
    if (error) throw new Error(`deleteByIds failed: ${error.message}`);
    deleted += data?.length ?? 0;
  }
  return deleted;
}

/** Apply BB-LIFE-02: keep newest 500 ∪ last 180d; never delete queued/running. */
async prunePerRetentionPolicy(now: Date = new Date()): Promise<{
  deleted: number;
  kept: number;
  candidateCount: number;
}> {
  const candidates = await this.listRetentionCandidates();
  const toDelete = selectSyncRunIdsToPrune(candidates, now);
  const deleted = await this.deleteByIds(toDelete);
  return {
    deleted,
    kept: candidates.length - deleted,
    candidateCount: candidates.length,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @momus/infra typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/infra/src/supabase/sync-runs.repository.ts
git commit -m "feat(infra): prune sync runs per BB-LIFE-02 retention policy"
```

---

### Task 3: Jobs — daily `retention-prune`

**Files:**
- Create: `packages/jobs/src/retention-prune.ts`
- Modify: `packages/jobs/src/index.ts`

- [ ] **Step 1: Implement job**

```ts
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
```

- [ ] **Step 2: Register in `packages/jobs/src/index.ts`**

```ts
import { inngest, EVENT_BUG_BUDGET_SYNC } from './client';
import { syncBugBudget } from './sync-bug-budget';
import { stuckRunSweeper } from './stuck-run-sweeper';
import { schedulerTick } from './scheduler-tick';
import { retentionPrune } from './retention-prune';
import { executeBugBudgetSyncRun } from './execute-sync-run';

export {
  inngest,
  EVENT_BUG_BUDGET_SYNC,
  syncBugBudget,
  stuckRunSweeper,
  schedulerTick,
  retentionPrune,
  executeBugBudgetSyncRun,
};

export const functions = [
  syncBugBudget,
  stuckRunSweeper,
  schedulerTick,
  retentionPrune,
];
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @momus/jobs typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/jobs/src/retention-prune.ts packages/jobs/src/index.ts
git commit -m "feat(jobs): daily sync-run retention prune cron"
```

---

### Task 4: Infra — `AuditLogRepository`

**Files:**
- Create: `packages/infra/src/supabase/audit-logs.repository.ts`
- Modify: `packages/infra/src/supabase/index.ts`

- [ ] **Step 1: Implement repository**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type WriteAuditLogInput = {
  userId: number | null;
  action: string;
  entityType: string;
  entityKey: string | null;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
};

export class AuditLogRepository {
  constructor(private readonly db: SupabaseClient) {}

  async write(input: WriteAuditLogInput): Promise<void> {
    const { error } = await this.db.from('audit_logs').insert({
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_key: input.entityKey,
      before_value: input.beforeValue,
      after_value: input.afterValue,
    });
    if (error) throw new Error(`audit_logs write failed: ${error.message}`);
  }
}
```

- [ ] **Step 2: Export from `packages/infra/src/supabase/index.ts`**

Add: `export * from './audit-logs.repository';`

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @momus/infra typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/infra/src/supabase/audit-logs.repository.ts packages/infra/src/supabase/index.ts
git commit -m "feat(infra): AuditLogRepository for settings audit trail"
```

---

### Task 5: Web — best-effort audit helper + settings routes

**Files:**
- Create: `apps/web/lib/audit.ts`
- Modify:
  - `apps/web/app/api/settings/bug-budget/save-multipliers/route.ts`
  - `apps/web/app/api/settings/bug-budget/save-project-settings/route.ts`
  - `apps/web/app/api/settings/bug-budget/save-sync-query/route.ts`
  - `apps/web/app/api/settings/bug-budget/cron-schedule/route.ts`
  - `apps/web/app/api/settings/bug-budget/save-connection/route.ts`
  - `apps/web/app/api/settings/confluence/route.ts`

- [ ] **Step 1: Create `apps/web/lib/audit.ts`**

```ts
import { AuditLogRepository, createServerClient } from '@momus/infra';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function writeSettingsAudit(input: {
  db?: SupabaseClient;
  userId: number;
  action: 'create' | 'update';
  entityType: string;
  entityKey: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const db = input.db ?? createServerClient();
    await new AuditLogRepository(db).write({
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityKey: input.entityKey,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[audit]', input.entityType, input.entityKey, message);
  }
}
```

- [ ] **Step 2: Wire `save-multipliers/route.ts`**

After auth + parse, before save:

```ts
import { BugBudgetConfigRepository, createServerClient, loadSettingsConfig, parseMultipliers } from '@momus/infra';
import { writeSettingsAudit } from '@/lib/audit';
// ...
const db = createServerClient();
const beforeCfg = await loadSettingsConfig(db);
const before = {
  priority_multipliers: beforeCfg.priority_multipliers,
  severity_multipliers: beforeCfg.severity_multipliers,
};
await new BugBudgetConfigRepository(db).saveMultipliers(payload);
await writeSettingsAudit({
  db,
  userId: auth.user.id,
  action: 'update',
  entityType: 'bug_budget_config',
  entityKey: 'multipliers',
  beforeValue: before,
  afterValue: {
    priority_multipliers: {
      highest: payload.priority_highest,
      high: payload.priority_high,
      medium: payload.priority_medium,
      low: payload.priority_low,
      lowest: payload.priority_lowest,
    },
    severity_multipliers: {
      critical: payload.severity_critical,
      major: payload.severity_major,
      moderate: payload.severity_moderate,
      minor: payload.severity_minor,
      low: payload.severity_low,
    },
  },
});
```

- [ ] **Step 3: Wire `save-project-settings/route.ts`**

```ts
import { BugBudgetConfigRepository, createServerClient, loadSettingsConfig } from '@momus/infra';
import { writeSettingsAudit } from '@/lib/audit';
// after validation, before save:
const beforeCfg = await loadSettingsConfig(db);
const before = {
  project_budgets: beforeCfg.project_budgets,
  project_mappings: beforeCfg.project_mappings,
  excluded_projects: beforeCfg.excluded_projects,
};
await repo.saveProjectSettings(...);
const afterCfg = await loadSettingsConfig(db);
await writeSettingsAudit({
  db,
  userId: auth.user.id,
  action: 'update',
  entityType: 'bug_budget_config',
  entityKey: 'project_settings',
  beforeValue: before,
  afterValue: {
    project_budgets: afterCfg.project_budgets,
    project_mappings: afterCfg.project_mappings,
    excluded_projects: afterCfg.excluded_projects,
  },
});
```

- [ ] **Step 4: Wire `save-sync-query/route.ts`**

```ts
const before = await new BugBudgetConfigRepository(db).getSyncQuery();
await new BugBudgetConfigRepository(db).saveSyncQuery(payload);
await writeSettingsAudit({
  db,
  userId: auth.user.id,
  action: 'update',
  entityType: 'bug_budget_config',
  entityKey: 'sync_query',
  beforeValue: before as unknown as Record<string, unknown>,
  afterValue: payload as unknown as Record<string, unknown>,
});
```

- [ ] **Step 5: Wire `cron-schedule/route.ts` POST**

```ts
const repo = new BugBudgetConfigRepository(db);
const before = await repo.getOrCreateCronSchedule();
const schedule = await repo.saveCronSchedule({ ... });
await writeSettingsAudit({
  db,
  userId: auth.user.id,
  action: 'update',
  entityType: 'cron_schedules',
  entityKey: 'bug_budget_sync',
  beforeValue: before as unknown as Record<string, unknown>,
  afterValue: schedule as unknown as Record<string, unknown>,
});
```

- [ ] **Step 6: Wire `save-connection/route.ts` POST** (masked token)

```ts
import { writeSettingsAudit } from '@/lib/audit';
// existing imports already have toPublicJiraConnection
const stored = await getJiraSettings();
const beforePublic = toPublicJiraConnection(stored);
const next = parseJiraConnectionBody(body, stored);
await saveJiraSettings(next);
const afterPublic = toPublicJiraConnection(next);
await writeSettingsAudit({
  userId: auth.user.id,
  action: 'update',
  entityType: 'settings',
  entityKey: 'jira',
  beforeValue: beforePublic as unknown as Record<string, unknown>,
  afterValue: afterPublic as unknown as Record<string, unknown>,
});
```

Assert mentally: `afterPublic.api_token` is always `****************` when a token exists (existing `maskJiraToken`).

- [ ] **Step 7: Wire `confluence/route.ts` POST**

```ts
const before = toPublicConfluenceSettings(await getConfluenceSettings());
const next = parseConfluenceBody(body);
await saveConfluenceSettings(next);
const after = toPublicConfluenceSettings(next);
await writeSettingsAudit({
  userId: auth.user.id,
  action: 'update',
  entityType: 'settings',
  entityKey: 'confluence',
  beforeValue: before as unknown as Record<string, unknown>,
  afterValue: after as unknown as Record<string, unknown>,
});
```

- [ ] **Step 8: Typecheck web**

```bash
pnpm --filter @momus/web typecheck
```

Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/audit.ts \
  apps/web/app/api/settings/bug-budget/save-multipliers/route.ts \
  apps/web/app/api/settings/bug-budget/save-project-settings/route.ts \
  apps/web/app/api/settings/bug-budget/save-sync-query/route.ts \
  apps/web/app/api/settings/bug-budget/cron-schedule/route.ts \
  apps/web/app/api/settings/bug-budget/save-connection/route.ts \
  apps/web/app/api/settings/confluence/route.ts
git commit -m "feat(web): best-effort audit_logs on settings saves"
```

---

### Task 6: Verification

- [ ] **Step 1: Domain retention tests**

```bash
pnpm --filter @momus/domain exec vitest run src/sync/sync-run-retention.test.ts
```

Expected: 5 passed.

- [ ] **Step 2: Existing Jira mask tests still pass**

```bash
pnpm --filter @momus/infra exec vitest run src/supabase/settings.test.ts
```

Expected: pass (token masking unchanged).

- [ ] **Step 3: Full typechecks**

```bash
pnpm --filter @momus/domain typecheck
pnpm --filter @momus/infra typecheck
pnpm --filter @momus/jobs typecheck
pnpm --filter @momus/web typecheck
```

Expected: all exit 0.

- [ ] **Step 4: Confirm job registration**

Open `packages/jobs/src/index.ts` and verify `retentionPrune` is in `functions`.

- [ ] **Step 5: Fix any gaps; commit if needed**

Optional smoke (not required for done): save multipliers → row in `audit_logs`; plant old terminal sync runs → run prune manually / wait for cron.

---

## Spec coverage

| Spec item | Task |
|---|---|
| Domain prune eligibility (180d ∪ 500, never active) | 1 |
| Infra load + batch delete | 2 |
| Daily Inngest cron 03:00 Jakarta | 3 |
| `AuditLogRepository` | 4 |
| Six settings POSTs + masked Jira | 5 |
| Best-effort audit (log, don't fail save) | 5 (`writeSettingsAudit`) |
| Domain tests + typechecks | 1, 6 |
| Non-goals (runbook/health/UI) | — out of scope |

## Self-review notes

- Cron `0 20 * * *` UTC = 03:00 Asia/Jakarta (fixed +07).
- Connection audit must use `toPublicJiraConnection` only — never raw `apiToken`.
- Retention does not touch `bug_budget` / `raw_jira_data`.
- `listRetentionCandidates` loads all id/status/created_at rows; acceptable at current sync-run volumes; revisit if table grows huge.
