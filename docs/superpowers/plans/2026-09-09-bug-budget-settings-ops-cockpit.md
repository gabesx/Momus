# Bug Budget Settings Ops Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `/settings/atlassian#bug-budget` into an ops-first cockpit: sync/preview/progress/activity/health above the fold; projects, multipliers, and cron collapsed and lazy-loaded.

**Architecture:** Keep `BugBudgetTab` as the orchestrator. Extract presentational cards under `apps/web/components/settings/bug-budget/`. Eager-load sync_query + activity + stats on mount; lazy-load multipliers/projects/cron on first accordion open. Persist accordion open state in `sessionStorage`. No API or domain changes.

**Tech Stack:** Next.js 15 App Router, React 19 client components, existing `apiJson`, Vitest (no RTL in `@momus/web`), Momus `--bb-*` / `settings-card` CSS.

**Spec:** `docs/superpowers/specs/2026-09-09-bug-budget-settings-ops-cockpit-design.md`

## Global Constraints

- No new API routes or request/response contract changes
- No domain / golden-fixture / `bug_budget` table changes
- Stay on existing design tokens and `settings-card` / `btn-*` patterns
- Sync action uses `btn-primary`; Save Configuration uses `btn-outline`
- Setup sections default collapsed; open state key `momus.bbSettings.setupOpen`
- Do not mount heavy setup forms until their section is expanded (or was open in sessionStorage)

---

## File structure

| Path | Responsibility |
|---|---|
| `apps/web/lib/bb-settings-setup-open.ts` | Read/write setup accordion open ids in `sessionStorage` |
| `apps/web/lib/bb-settings-setup-open.test.ts` | Unit tests for storage helpers |
| `apps/web/components/settings/bug-budget/sync-ops-card.tsx` | JQL + sync params + action row |
| `apps/web/components/settings/bug-budget/sync-progress-card.tsx` | Progress UI |
| `apps/web/components/settings/bug-budget/sync-activity-list.tsx` | Compact last-N activity |
| `apps/web/components/settings/bug-budget/system-health-card.tsx` | Health stats + Refresh |
| `apps/web/components/settings/bug-budget/setup-section.tsx` | Controlled `<details>` with onOpen callback |
| `apps/web/components/settings/tabs/bug-budget-tab.tsx` | Orchestration: eager/lazy loads, busy, polling, compose UI |
| `apps/web/app/globals.css` | `.bb-setup-group`, denser ops spacing, activity compact tweaks |

---

### Task 1: Setup accordion sessionStorage helper

**Files:**
- Create: `apps/web/lib/bb-settings-setup-open.ts`
- Create: `apps/web/lib/bb-settings-setup-open.test.ts`

**Interfaces:**
- Produces:
  - `SETUP_OPEN_STORAGE_KEY = 'momus.bbSettings.setupOpen'`
  - `SetupSectionId = 'projects' | 'multipliers' | 'cron'`
  - `readSetupOpen(): Set<SetupSectionId>`
  - `writeSetupOpen(open: ReadonlySet<SetupSectionId>): void`
  - `toggleSetupOpen(id: SetupSectionId, isOpen: boolean): Set<SetupSectionId>`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SETUP_OPEN_STORAGE_KEY,
  readSetupOpen,
  toggleSetupOpen,
  writeSetupOpen,
} from './bb-settings-setup-open';

describe('bb-settings-setup-open', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('defaults to empty set when missing or invalid', () => {
    expect([...readSetupOpen()]).toEqual([]);
    sessionStorage.setItem(SETUP_OPEN_STORAGE_KEY, 'not-json');
    expect([...readSetupOpen()]).toEqual([]);
  });

  it('round-trips known section ids and ignores unknown', () => {
    writeSetupOpen(new Set(['projects', 'cron', 'nope' as 'projects']));
    expect([...readSetupOpen()].sort()).toEqual(['cron', 'projects']);
  });

  it('toggleSetupOpen adds and removes then persists', () => {
    const opened = toggleSetupOpen('multipliers', true);
    expect(opened.has('multipliers')).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(SETUP_OPEN_STORAGE_KEY)!)).toContain(
      'multipliers',
    );
    const closed = toggleSetupOpen('multipliers', false);
    expect(closed.has('multipliers')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @momus/web test -- lib/bb-settings-setup-open.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
export const SETUP_OPEN_STORAGE_KEY = 'momus.bbSettings.setupOpen';

export const SETUP_SECTION_IDS = ['projects', 'multipliers', 'cron'] as const;
export type SetupSectionId = (typeof SETUP_SECTION_IDS)[number];

function isSetupSectionId(value: unknown): value is SetupSectionId {
  return (
    typeof value === 'string' &&
    (SETUP_SECTION_IDS as readonly string[]).includes(value)
  );
}

export function readSetupOpen(): Set<SetupSectionId> {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SETUP_OPEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(isSetupSectionId));
  } catch {
    return new Set();
  }
}

export function writeSetupOpen(open: ReadonlySet<SetupSectionId>): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SETUP_OPEN_STORAGE_KEY, JSON.stringify([...open]));
}

export function toggleSetupOpen(
  id: SetupSectionId,
  isOpen: boolean,
): Set<SetupSectionId> {
  const next = readSetupOpen();
  if (isOpen) next.add(id);
  else next.delete(id);
  writeSetupOpen(next);
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @momus/web test -- lib/bb-settings-setup-open.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/bb-settings-setup-open.ts apps/web/lib/bb-settings-setup-open.test.ts
git commit -m "feat(settings): sessionStorage helper for BB setup accordion"
```

---

### Task 2: Presentational cards (ops strip)

**Files:**
- Create: `apps/web/components/settings/bug-budget/sync-ops-card.tsx`
- Create: `apps/web/components/settings/bug-budget/sync-progress-card.tsx`
- Create: `apps/web/components/settings/bug-budget/sync-activity-list.tsx`
- Create: `apps/web/components/settings/bug-budget/system-health-card.tsx`
- Create: `apps/web/components/settings/bug-budget/setup-section.tsx`

**Interfaces:**
- Consumes: existing field/button CSS classes; activity shape from current tab
- Produces: named exports `SyncOpsCard`, `SyncProgressCard`, `SyncActivityList`, `SystemHealthCard`, `SetupSection`

- [ ] **Step 1: Add `SetupSection` controlled details wrapper**

```tsx
'use client';

type Props = {
  id: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function SetupSection({ id, title, open, onOpenChange, children }: Props) {
  return (
    <details
      className="settings-card bb-setup-section"
      open={open}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        if (next !== open) onOpenChange(next);
      }}
    >
      <summary className="bb-setup-section__summary">{title}</summary>
      {open ? <div className="bb-setup-section__body">{children}</div> : null}
    </details>
  );
}
```

Note: only render `children` when `open` so heavy forms are not mounted while collapsed.

- [ ] **Step 2: Extract `SyncProgressCard`**

Move the existing Sync Progress `<section>` markup from `bug-budget-tab.tsx` into:

```tsx
'use client';

export type SyncStatusData = {
  sync_run_id: number;
  status: string;
  percentage: number;
  processed: number;
  total_issues: number;
  current_batch: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
};

type Props = {
  syncRun: SyncStatusData;
  pollHint: string;
};

export function SyncProgressCard({ syncRun, pollHint }: Props) {
  // same markup as current progress section
}
```

- [ ] **Step 3: Extract `SyncActivityList`**

Props: `{ activities: Activity[]; limit?: number }` with default `limit = 5`. Slice before render: `activities.slice(0, limit)`.

- [ ] **Step 4: Extract `SystemHealthCard`**

Props: `{ stats: { total: number; bugs: number; open: number } | null; onRefresh: () => void }`.

- [ ] **Step 5: Extract `SyncOpsCard`**

Move JQL Query Configuration card markup. Action row must be:

```tsx
<button type="button" className="btn btn-primary" …>Sync with Database</button>
<button type="button" className="btn btn-outline" …>Test Fetch (Preview Only)</button>
<button type="button" className="btn btn-outline" …>Save Configuration</button>
<button type="button" className="btn btn-ghost" …>Clear JQL</button>
```

Pass handlers and field state as props from `BugBudgetTab` (keep logic in the tab for this task).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @momus/web typecheck`

Expected: PASS (cards may be unused until Task 3 — that is OK if exported)

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/settings/bug-budget/
git commit -m "feat(settings): extract bug budget ops presentational cards"
```

---

### Task 3: Wire ops cockpit layout + eager/lazy loading in `BugBudgetTab`

**Files:**
- Modify: `apps/web/components/settings/tabs/bug-budget-tab.tsx`
- Modify: `apps/web/app/globals.css` (ops + setup styles — can land here or Task 4; prefer here if layout needs classes)

**Interfaces:**
- Consumes: helpers from Task 1; cards from Task 2
- Produces: ops-first layout; `loadOpsMeta` / `loadSetupSection` behavior

- [ ] **Step 1: Split load functions**

Replace single `loadMeta` with:

```ts
const loadOpsMeta = useCallback(async () => {
  const [cfg, act, dash] = await Promise.all([
    apiJson<{ config?: { sync_query?: { /* same fields as today */ } } }>(
      '/api/settings/bug-budget/config',
    ),
    apiJson<{ activities?: Activity[] }>('/api/settings/bug-budget/sync-activity'),
    apiJson<{ stats?: { total: number; bugs: number; open: number } }>(
      '/api/bug-budget?per_page=25',
    ),
  ]);
  // apply sync_query, activities, stats only — do not set multipliers/budgets/mappings/cron yet
}, []);

const setupLoadedRef = useRef<Set<SetupSectionId>>(new Set());

const loadSetupSection = useCallback(
  async (id: SetupSectionId) => {
    if (setupLoadedRef.current.has(id)) return;
    if (id === 'projects' || id === 'multipliers') {
      const cfg = await apiJson<{ config?: { /* multipliers, budgets, mappings */ } }>(
        '/api/settings/bug-budget/config',
      );
      if (!cfg.success || !cfg.config) {
        onAlert('error', cfg.message ?? 'Failed to load setup config');
        return;
      }
      // set priority, severity, budgets, mappings from cfg
      setupLoadedRef.current.add('projects');
      setupLoadedRef.current.add('multipliers');
      return;
    }
    if (id === 'cron') {
      const schedule = await apiJson<{ schedule?: Record<string, unknown> }>(
        '/api/settings/bug-budget/cron-schedule',
      );
      if (!schedule.success || !schedule.schedule) {
        onAlert('error', schedule.message ?? 'Failed to load schedule');
        return;
      }
      // apply cron state (same mapping as today)
      setupLoadedRef.current.add('cron');
    }
  },
  [onAlert],
);
```

On mount:

```ts
const [setupOpen, setSetupOpen] = useState<Set<SetupSectionId>>(() => new Set());

useEffect(() => {
  setSetupOpen(readSetupOpen());
  void loadOpsMeta();
}, [loadOpsMeta]);

useEffect(() => {
  for (const id of setupOpen) {
    void loadSetupSection(id);
  }
}, [setupOpen, loadSetupSection]);
```

When sync completes, call `loadOpsMeta()` (not full setup reload). Refresh button on health calls `loadOpsMeta()`. After successful save of multipliers/projects/cron, keep current in-memory state (already updated) or re-call `loadSetupSection` after clearing the corresponding `setupLoadedRef` entry if you need server echo — prefer keep local state as today.

- [ ] **Step 2: Reorder JSX**

Structure:

```tsx
<div className="bb-layout">
  <div className="bb-main">
    {/* connection banner */}
    <SyncOpsCard … />
    {syncRun ? <SyncProgressCard … /> : null}
    <SyncActivityList activities={activities} limit={5} />
    <div className="bb-setup-group">
      <h2 className="bb-setup-group__title">Setup</h2>
      <SetupSection
        id="projects"
        title="Project Budget & Mapping"
        open={setupOpen.has('projects')}
        onOpenChange={(open) => setSetupOpen(toggleSetupOpen('projects', open))}
      >
        {/* existing projects UI */}
      </SetupSection>
      <SetupSection
        id="multipliers"
        title="Bug Cost Multiplier Settings"
        open={setupOpen.has('multipliers')}
        onOpenChange={(open) => setSetupOpen(toggleSetupOpen('multipliers', open))}
      >
        {/* existing multipliers UI */}
      </SetupSection>
      <SetupSection
        id="cron"
        title="Automated Sync Schedule"
        open={setupOpen.has('cron')}
        onOpenChange={(open) => setSetupOpen(toggleSetupOpen('cron', open))}
      >
        {/* existing cron UI */}
      </SetupSection>
    </div>
  </div>
  <aside className="bb-side">
    <SystemHealthCard stats={stats} onRefresh={() => void loadOpsMeta()} />
  </aside>
</div>
```

Add Retry buttons inside setup bodies when load failed: track `setupError: Partial<Record<SetupSectionId, string>>`, clear on success, show `{error} <button onClick={() => { setupLoadedRef.current.delete(id); void loadSetupSection(id); }}>Retry</button>`.

- [ ] **Step 3: Keep polling effect unchanged** except `loadMeta` → `loadOpsMeta`.

- [ ] **Step 4: Manual smoke (dev server)**

1. Open `http://localhost:3000/settings/atlassian#bug-budget`
2. Confirm Setup sections collapsed; Sync is primary button
3. Expand Projects — network shows config fetch; form appears
4. Collapse/re-expand — no second fetch
5. Preview/Sync still work

- [ ] **Step 5: Typecheck + unit tests**

Run:

```bash
pnpm --filter @momus/web typecheck
pnpm --filter @momus/web test -- lib/bb-settings-setup-open.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/settings/tabs/bug-budget-tab.tsx apps/web/components/settings/bug-budget/
git commit -m "feat(settings): ops cockpit layout with eager/lazy BB loads"
```

---

### Task 4: Visual polish CSS

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add setup group + section styles near existing `.bb-layout` block**

```css
.bb-main > .settings-card:first-of-type,
.bb-main > .bb-conn-banner {
  /* keep banner + ops slightly denser */
}

.bb-ops-card .btn-row {
  margin-top: 0.35rem;
}

.bb-setup-group {
  margin-top: 0.5rem;
}

.bb-setup-group__title {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--bb-secondary);
}

.bb-setup-section {
  padding: 0;
}

.bb-setup-section__summary {
  list-style: none;
  cursor: pointer;
  font-weight: 700;
  padding: 1rem 1.25rem;
}

.bb-setup-section__summary::-webkit-details-marker {
  display: none;
}

.bb-setup-section__body {
  padding: 0 1.25rem 1.25rem;
}

.bb-side .settings-card--side {
  /* unchanged sticky behavior */
}
```

Also add `className="settings-card bb-ops-card"` on the ops card wrapper inside `SyncOpsCard` if not already.

- [ ] **Step 2: Verify mobile stack** — existing `@media (max-width: 900px)` already forces `.bb-layout` to one column; confirm health is not sticky fighting accordion (`.settings-card--side { position: static }` already present).

- [ ] **Step 3: Visual smoke on desktop + narrow viewport**

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/globals.css apps/web/components/settings/bug-budget/sync-ops-card.tsx
git commit -m "style(settings): polish bug budget ops cockpit spacing"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run checks**

```bash
pnpm --filter @momus/web test
pnpm --filter @momus/web typecheck
pnpm --filter @momus/web lint
```

Expected: all PASS (or lint only pre-existing issues unrelated to this work)

- [ ] **Step 2: Checklist against success criteria**

| Criterion | How to confirm |
|---|---|
| Ops above the fold | Laptop viewport: Sync + activity visible without expanding Setup |
| Setup not mounted until expand | React/devtools or network: no project form until open; collapsed `children` null |
| Sync is primary | Sync uses `btn-primary`; Save is `btn-outline` |
| No API drift | Preview/Sync/Save/cron/multipliers/projects still hit same routes |

- [ ] **Step 3: Commit any leftover fixes, or skip if clean**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Ops strip order (conn → sync → progress → activity + health) | 3 |
| Setup accordion collapsed by default | 1, 3 |
| sessionStorage open state | 1, 3 |
| Button hierarchy Sync primary | 2, 3 |
| Eager sync_query + activity + stats | 3 |
| Lazy multipliers/projects/cron | 3 |
| Polling unchanged semantics | 3 |
| Component extraction | 2 |
| Visual polish / mobile | 4 |
| Lazy-load error + Retry | 3 |
| Light unit tests (no RTL) | 1 |
| No API/domain changes | all |

## Placeholder / consistency notes

- `SyncStatusData` / `Activity` types: define once in `sync-progress-card.tsx` (or a tiny `types.ts` under `settings/bug-budget/`) and import into the tab — do not duplicate divergent shapes.
- Config is still one GET endpoint; eager path ignores setup fields; lazy path may refetch the same config — acceptable per spec.
