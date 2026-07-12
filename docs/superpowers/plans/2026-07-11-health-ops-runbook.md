# Health Endpoints & Ops Runbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public `/api/health` (hardened) + `/api/health/worker` (Inngest env + latest sync-run) and living `docs/ops/runbook.md` linked from README.

**Architecture:** Thin Next.js routes + `apps/web/lib/health.ts` helpers; middleware allowlist; docs-only runbook.

**Tech Stack:** Next.js 15, TypeScript, Supabase, existing `@momus/infra`.

**Spec:** `docs/superpowers/specs/2026-07-11-health-ops-runbook-design.md`

---

## File structure

| Path | Responsibility |
|---|---|
| `apps/web/lib/health.ts` | Env flags + last sync-run snapshot helpers |
| `apps/web/app/api/health/route.ts` | App health (existing; ensure middleware-safe) |
| `apps/web/app/api/health/worker/route.ts` | Worker health |
| `apps/web/middleware.ts` | Allow health paths when signed-out |
| `docs/ops/runbook.md` | Ops runbook |
| `README.md` | Links |
| `docs/superpowers/specs/2026-07-11-health-ops-runbook-design.md` | Spec (already written) |

---

### Task 1: Health helpers + worker route + middleware

**Files:**
- Create: `apps/web/lib/health.ts`
- Create: `apps/web/app/api/health/worker/route.ts`
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Create `apps/web/lib/health.ts`**

```ts
import { createServerClient } from '@momus/infra';

export type LatestSyncRunSnapshot = {
  id: number;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

export function getInngestEnvFlags(): {
  inngest_event_key: boolean;
  inngest_signing_key: boolean;
  sync_inline_fallback: boolean;
} {
  return {
    inngest_event_key: Boolean(process.env.INNGEST_EVENT_KEY?.trim()),
    inngest_signing_key: Boolean(process.env.INNGEST_SIGNING_KEY?.trim()),
    sync_inline_fallback: process.env.SYNC_INLINE_AFTER_RESPONSE === 'true',
  };
}

/** True when sync can be enqueued or run inline. */
export function isWorkerConfigured(flags = getInngestEnvFlags()): boolean {
  return flags.inngest_event_key || flags.sync_inline_fallback;
}

export async function fetchLatestSyncRun(): Promise<LatestSyncRunSnapshot | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('bug_budget_sync_runs')
    .select('id, status, created_at, started_at, completed_at, error_message')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`latest sync run query failed: ${error.message}`);
  if (!data) return null;
  return {
    id: Number(data.id),
    status: String(data.status),
    created_at: String(data.created_at),
    started_at: (data.started_at as string | null) ?? null,
    completed_at: (data.completed_at as string | null) ?? null,
    error_message: (data.error_message as string | null) ?? null,
  };
}
```

- [ ] **Step 2: Create `apps/web/app/api/health/worker/route.ts`**

```ts
import { NextResponse } from 'next/server';
import {
  fetchLatestSyncRun,
  getInngestEnvFlags,
  isWorkerConfigured,
} from '@/lib/health';

export async function GET() {
  const flags = getInngestEnvFlags();
  const checks: Record<string, unknown> = { ...flags, database: 'unknown' };

  try {
    checks.latest_sync_run = await fetchLatestSyncRun();
    checks.database = 'ok';
  } catch (err) {
    checks.database = err instanceof Error ? err.message : 'unavailable';
    checks.latest_sync_run = null;
  }

  const dbOk = checks.database === 'ok';
  const workerOk = isWorkerConfigured(flags);
  const healthy = dbOk && workerOk;

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      service: 'momus-worker',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
```

- [ ] **Step 3: Update middleware allowlist**

In `apps/web/middleware.ts`, add health paths next to auth exceptions:

```ts
  if (
    pathname === '/signed-out' ||
    pathname.startsWith('/api/auth/sign-in') ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/health/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @momus/web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/health.ts apps/web/app/api/health/worker/route.ts apps/web/middleware.ts
git commit -m "feat(web): public /api/health/worker probe"
```

---

### Task 2: Ops runbook + README

**Files:**
- Create: `docs/ops/runbook.md`
- Modify: `README.md`

- [ ] **Step 1: Write `docs/ops/runbook.md`** covering:
  - Components table (web, DB, Inngest worker, scheduler, retention) + health URLs
  - Common ops from plan §14.2 (manual sync, full recon JQL, stuck runs, rotate token, holidays, rollback)
  - Monitoring alerts from §14.3
  - Inngest function ids: `bug-budget-sync`, `bug-budget-stuck-run-sweeper`, `bug-budget-scheduler-tick`, `bug-budget-retention-prune`
  - Env: `INNGEST_EVENT_KEY`, signing key, `SYNC_INLINE_AFTER_RESPONSE`
  - Note: never paste real API tokens; health shows masked token only

- [ ] **Step 2: README** — under Open: / Health section, add worker URL and link to `docs/ops/runbook.md`

- [ ] **Step 3: Commit**

```bash
git add docs/ops/runbook.md README.md docs/superpowers/specs/2026-07-11-health-ops-runbook-design.md
git commit -m "docs(ops): add operations runbook and health links"
```

---

### Task 3: Verification

- [ ] Typecheck `@momus/web`
- [ ] Confirm middleware allowlists health
- [ ] Confirm no raw token in health route (existing `maskJiraToken`)
- [ ] Optional local curl of both endpoints

---

## Spec coverage

| Spec item | Task |
|---|---|
| Worker env + latest sync | 1 |
| Middleware public | 1 |
| Runbook + README | 2 |
| Existing `/api/health` kept | 1 (unchanged body; allowlist) |
| No Inngest external API | — |
