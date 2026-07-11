# Scheduler Tick (BB-SCHED-01/02) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Minutely Inngest tick fires due `bug_budget_sync` schedules into the existing sync worker, and `next_run_at` is computed in Asia/Jakarta on save and after trigger.

**Architecture:** Domain Jakarta `computeNextRunAt` → infra cron helpers + `saveCronSchedule` → `packages/jobs/src/scheduler-tick.ts` (`* * * * *`) enqueues `bug-budget/sync`.

**Tech Stack:** TypeScript, Vitest, Inngest, Supabase, `@momus/domain` / `@momus/infra` / `@momus/jobs`.

**Spec:** `docs/superpowers/specs/2026-07-11-scheduler-tick-design.md`

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/domain/src/schedule/next-run-at.ts` | Pure Jakarta next-run math |
| `packages/domain/src/schedule/next-run-at.test.ts` | Unit tests |
| `packages/domain/src/index.ts` | Re-export |
| `packages/infra/src/supabase/config.ts` | Delegate to domain; `listDueCronSchedules`, `markCronTriggered` |
| `packages/infra/src/supabase/system-user.ts` | Ensure `automated@system` user |
| `supabase/migrations/YYYYMMDDHHMMSS_seed_automated_system_user.sql` | Seed system user + permission |
| `packages/jobs/src/scheduler-tick.ts` | Minutely Inngest function |
| `packages/jobs/src/index.ts` | Register function |

---

### Task 1: Domain — Jakarta `computeNextRunAt`

**Files:**
- Create: `packages/domain/src/schedule/next-run-at.ts`
- Create: `packages/domain/src/schedule/next-run-at.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { computeNextRunAt } from './next-run-at';

describe('computeNextRunAt (Asia/Jakarta)', () => {
  it('daily: same day later time', () => {
    // from Wed 2026-07-11 10:00 +07 → time 18:00 → same calendar day 18:00 +07
    const iso = computeNextRunAt({
      schedule_type: 'daily',
      interval_days: 1,
      time: '18:00',
      fromIso: '2026-07-11T03:00:00.000Z', // 10:00 Jakarta
    });
    expect(iso).toBe('2026-07-11T11:00:00.000Z'); // 18:00 Jakarta
  });

  it('daily: time already passed → next day', () => {
    const iso = computeNextRunAt({
      schedule_type: 'daily',
      interval_days: 1,
      time: '00:00',
      fromIso: '2026-07-11T03:00:00.000Z', // 10:00 Jakarta
    });
    expect(iso).toBe('2026-07-11T17:00:00.000Z'); // next day 00:00 Jakarta = Jul 11 17:00 UTC
  });

  it('custom: adds interval_days then applies time', () => {
    const iso = computeNextRunAt({
      schedule_type: 'custom',
      interval_days: 3,
      time: '00:00',
      fromIso: '2026-07-11T03:00:00.000Z',
    });
    // Jul 11 + 3 days = Jul 14 00:00 Jakarta → 2026-07-13T17:00:00.000Z
    expect(iso).toBe('2026-07-13T17:00:00.000Z');
  });

  it('weekly: advances to target weekday at time', () => {
    // 2026-07-11 is Saturday Jakarta; next monday 00:00
    const iso = computeNextRunAt({
      schedule_type: 'weekly',
      interval_days: 1,
      time: '00:00',
      day_of_week: 'monday',
      fromIso: '2026-07-11T03:00:00.000Z',
    });
    expect(iso).toBe('2026-07-12T17:00:00.000Z'); // Mon Jul 13 00:00 Jakarta
  });

  it('monthly: day_of_month this month or next', () => {
    const iso = computeNextRunAt({
      schedule_type: 'monthly',
      interval_days: 1,
      time: '00:00',
      day_of_month: 15,
      fromIso: '2026-07-11T03:00:00.000Z',
    });
    expect(iso).toBe('2026-07-14T17:00:00.000Z'); // Jul 15 00:00 Jakarta
  });
});
```

Verify wall-clock expectations carefully when implementing (UTC offset for Asia/Jakarta is +07 year-round, no DST). Adjust test expected ISO strings if off-by-one after first run — keep Jakarta semantics as source of truth.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @momus/domain exec vitest run src/schedule/next-run-at.test.ts
```

- [ ] **Step 3: Implement**

```ts
// packages/domain/src/schedule/next-run-at.ts
import { TIMEZONE } from '../constants/defaults';

export type NextRunAtInput = {
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom' | string;
  interval_days: number;
  time: string; // HH:MM
  day_of_week?: string | null;
  day_of_month?: number | null;
  fromIso?: string;
  from?: Date;
};

/** Parts of `instant` in Asia/Jakarta. */
export function jakartaParts(instant: Date): {
  y: number; m: number; d: number; hh: number; mm: number; weekday: string;
} { /* Intl.DateTimeFormat en-CA / en-US weekday long */ }

/** Construct UTC Date for Jakarta local wall time y-m-d hh:mm. */
export function zonedJakartaToUtc(
  y: number, m: number, d: number, hh: number, mm: number,
): Date {
  // Use known +07 fixed offset: Date.UTC(y, m-1, d, hh-7, mm)
  // Document: Asia/Jakarta has no DST.
}

export function computeNextRunAt(input: NextRunAtInput): string {
  const from = input.fromIso ? new Date(input.fromIso) : (input.from ?? new Date());
  const [hh, mm] = input.time.split(':').map((x) => Number(x) || 0);
  // daily / weekly / monthly / custom per spec
  // return Date.toISOString()
}
```

Use `TIMEZONE` from `packages/domain/src/constants/defaults.ts` (`Asia/Jakarta`).

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @momus/domain exec vitest run src/schedule/next-run-at.test.ts
```

- [ ] **Step 5: Export from `packages/domain/src/index.ts`**

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/schedule packages/domain/src/index.ts
git commit -m "feat(domain): Jakarta computeNextRunAt for cron schedules"
```

---

### Task 2: Infra — wire helper + due/mark + system user

**Files:**
- Modify: `packages/infra/src/supabase/config.ts`
- Create: `packages/infra/src/supabase/system-user.ts`
- Modify: `packages/infra/src/supabase/index.ts` (export)
- Create: `supabase/migrations/<timestamp>_seed_automated_system_user.sql`

- [ ] **Step 1: Replace infra `computeNextRunAt`**

Remove local simplified implementation. Re-export domain helper or wrap:

```ts
import { computeNextRunAt as computeNextRunAtDomain } from '@momus/domain';

export function computeNextRunAt(input: {
  schedule_type: string;
  interval_days: number;
  time: string;
  day_of_week?: string | null;
  day_of_month?: number | null;
  from?: Date;
}): string {
  return computeNextRunAtDomain({ ...input, from: input.from });
}
```

Keep `saveCronSchedule` calling `computeNextRunAt(payload)`.

- [ ] **Step 2: Add repository methods on `BugBudgetConfigRepository` (or small `CronScheduleRepository`)**

```ts
async listDueCronSchedules(nowIso: string): Promise<CronScheduleRow[]> {
  const { data, error } = await this.db
    .from('cron_schedules')
    .select('*')
    .eq('is_active', true)
    .eq('command', 'bug-budget:sync')
    .lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true });
  if (error) throw new Error(`listDueCronSchedules failed: ${error.message}`);
  return (data ?? []) as CronScheduleRow[];
}

async markCronTriggered(
  id: number,
  input: {
    last_run_at: string;
    last_run_status: string;
    last_run_result: string;
    next_run_at: string;
  },
): Promise<void> {
  const { error } = await this.db
    .from('cron_schedules')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`markCronTriggered failed: ${error.message}`);
}
```

- [ ] **Step 3: System user helper**

```ts
// packages/infra/src/supabase/system-user.ts
export const AUTOMATED_SYSTEM_EMAIL = 'automated@system';

export async function ensureAutomatedSystemUser(db: SupabaseClient): Promise<{ id: number; email: string }> {
  // select by email; if missing insert users row is_candidate=false
  // ensure user_permissions includes view_analytics (and access_settings optional)
  // return { id, email }
}
```

- [ ] **Step 4: Migration seed**

```sql
INSERT INTO public.users (email, name, is_candidate)
VALUES ('automated@system', 'Automated System', false)
ON CONFLICT (email) DO NOTHING;  -- only if email unique; else where-not-exists pattern

INSERT INTO public.user_permissions (user_id, permission)
SELECT u.id, p.perm
FROM public.users u
CROSS JOIN (VALUES ('view_analytics'), ('access_settings')) AS p(perm)
WHERE u.email = 'automated@system'
ON CONFLICT DO NOTHING;  -- adapt to actual unique constraints
```

Check `users.email` uniqueness in schema; use `WHERE NOT EXISTS` if no unique constraint on email.

- [ ] **Step 5: Typecheck infra**

```bash
pnpm --filter @momus/infra typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/infra supabase/migrations
git commit -m "feat(infra): due cron queries, Jakarta next_run_at, automated system user"
```

---

### Task 3: Jobs — `scheduler-tick` minutely cron

**Files:**
- Create: `packages/jobs/src/scheduler-tick.ts`
- Modify: `packages/jobs/src/index.ts`

- [ ] **Step 1: Implement tick**

```ts
import {
  BugBudgetConfigRepository,
  SyncRunRepository,
  createServerClient,
  ensureAutomatedSystemUser,
  computeNextRunAt,
  buildDefaultJql, // from domain via infra or import @momus/domain
} from '@momus/infra'; // or split imports
import { buildDefaultJql } from '@momus/domain';
import { EVENT_BUG_BUDGET_SYNC, inngest } from './client';

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

      for (const schedule of due) {
        try {
          const active = await runs.findActive();
          if (active) {
            results.push({ id: schedule.id, status: 'skipped_overlap', active_id: active.id });
            continue;
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

          const systemUser = await ensureAutomatedSystemUser(db);
          const run = await runs.create({
            requestedBy: systemUser.id,
            syncType: 'custom',
            jql,
            batchSize,
            maxTotalIssues,
          });

          await inngest.send({
            name: EVENT_BUG_BUDGET_SYNC,
            data: {
              syncRunId: run.id,
              requestedByLabel: systemUser.email,
              requestedById: systemUser.id,
            },
          });

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

          results.push({ id: schedule.id, status: 'triggered', sync_run_id: run.id, next_run_at: nextRunAt });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[scheduler-tick] schedule failed', schedule.id, message);
          results.push({ id: schedule.id, status: 'error', message });
        }
      }

      return { checked: due.length, results, at: nowIso };
    });
  },
);
```

Notes:
- If `INNGEST_EVENT_KEY` missing in local, tick may fail send — log error; leave `next_run_at` unchanged so next minute retries (per spec hard-failure-before-complete). Only call `markCronTriggered` **after** successful `inngest.send`.
- Order: create run → send → mark. If send fails after create, mark run failed via `runs.markFailed` to avoid stuck queued orphan.

- [ ] **Step 2: Register**

```ts
import { schedulerTick } from './scheduler-tick';
export const functions = [syncBugBudget, stuckRunSweeper, schedulerTick];
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @momus/jobs typecheck
pnpm --filter @momus/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/jobs
git commit -m "feat(jobs): minutely scheduler tick for bug_budget_sync"
```

---

### Task 4: Verification

- [ ] **Step 1:** Domain schedule tests

```bash
pnpm --filter @momus/domain exec vitest run src/schedule
```

- [ ] **Step 2:** Full package typechecks

```bash
pnpm --filter @momus/domain typecheck
pnpm --filter @momus/infra typecheck
pnpm --filter @momus/jobs typecheck
```

- [ ] **Step 3: Manual smoke (optional)**  
  With Inngest dev + DB: activate schedule with `next_run_at` in the past; wait ≤1m; confirm new `bug_budget_sync_runs` row and advanced `next_run_at`.

- [ ] **Step 4:** Fix gaps; commit if needed

---

## Spec coverage

| Spec item | Task |
|---|---|
| Jakarta `computeNextRunAt` | 1, 2 |
| Settings save uses helper | 2 |
| Minutely tick | 3 |
| Overlap skip | 3 |
| `automated@system` | 2, 3 |
| `last_run_*` + next after trigger | 3 |
| Domain tests + typecheck | 1, 4 |

## Self-review notes

- Fixed-offset Jakarta (+07) is acceptable and documented (no DST).
- Mark triggered only after successful enqueue; orphan queued runs get `markFailed` if send fails.
- Retention / audit / lock column remain out of scope.
