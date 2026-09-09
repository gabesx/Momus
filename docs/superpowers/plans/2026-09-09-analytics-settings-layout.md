# Analytics Settings Layout Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `/settings/atlassian#analytics` so Menu visibility is the hero, Digest and SLA stay open, KPI + Escape fold under Setup, and Save sticks to the bottom of the tab — CSS/IA only, no API changes.

**Architecture:** Reorder JSX in `analytics-tab.tsx`, reuse Bug Budget `SetupSection` + a tiny sessionStorage helper mirrored from `bb-settings-setup-open.ts`, add menu-grid / allowlist / sticky-save rules in `globals.css`.

**Tech Stack:** Next.js client component, existing `--bb-*` / `settings-card` / `bb-setup-*` CSS.

**Spec:** `docs/superpowers/specs/2026-09-09-analytics-settings-layout-design.md`

## Global Constraints

- No API or settings schema changes
- Keep menu-visibility, allowlist, digest send, save + `reloadMe` behavior identical
- Reuse `SetupSection` from `settings/bug-budget/setup-section.tsx`
- sessionStorage key: `momus.analyticsSettings.setupOpen` with ids `kpi` | `escape`
- Stay on existing Momus settings visual language (no new design system)
- Branch off current `master` (include #51 / menu-visibility if not yet merged — implement against the tab that already has `menu_visibility`)

---

## File map

| Path | Role |
|---|---|
| `apps/web/lib/analytics-settings-setup-open.ts` | sessionStorage open-set helpers |
| `apps/web/lib/analytics-settings-setup-open.test.ts` | Unit tests for read/toggle |
| `apps/web/components/settings/tabs/analytics-tab.tsx` | Reorder IA; SetupSection; sticky Save; short labels |
| `apps/web/app/globals.css` | Menu grid, allowlist panel, sticky save |

---

### Task 1: Setup-open sessionStorage helper

**Files:**
- Create: `apps/web/lib/analytics-settings-setup-open.ts`
- Create: `apps/web/lib/analytics-settings-setup-open.test.ts`

**Interfaces:** Mirror `bb-settings-setup-open.ts`:

```ts
export const ANALYTICS_SETUP_OPEN_STORAGE_KEY = 'momus.analyticsSettings.setupOpen';
export const ANALYTICS_SETUP_SECTION_IDS = ['kpi', 'escape'] as const;
export type AnalyticsSetupSectionId = (typeof ANALYTICS_SETUP_SECTION_IDS)[number];

export function readAnalyticsSetupOpen(): Set<AnalyticsSetupSectionId>;
export function writeAnalyticsSetupOpen(open: ReadonlySet<AnalyticsSetupSectionId>): void;
export function toggleAnalyticsSetupOpen(
  id: AnalyticsSetupSectionId,
  isOpen: boolean,
): Set<AnalyticsSetupSectionId>;
```

- [ ] **Step 1: Write failing tests** (empty storage → empty set; round-trip write/read; toggle add/remove; ignore junk ids)

- [ ] **Step 2: Implement helper** (guard `typeof sessionStorage === 'undefined'` for SSR)

- [ ] **Step 3: Run** `pnpm --filter web exec vitest run lib/analytics-settings-setup-open.test.ts` — PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): analytics settings setup accordion session state"
```

---

### Task 2: CSS — menu grid, allowlist, sticky save

**Files:**
- Modify: `apps/web/app/globals.css`

**Add (near existing `.bb-setup-*` / settings styles):**

```css
.bb-menu-visibility__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1.25rem;
  margin-top: 0.5rem;
}

@media (max-width: 640px) {
  .bb-menu-visibility__grid {
    grid-template-columns: 1fr;
  }
}

.bb-menu-visibility__allowlist {
  margin-top: 0.85rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--bb-border);
  border-radius: var(--bb-radius, 8px);
  background: color-mix(in srgb, var(--bb-bg, #fff) 92%, var(--bb-border));
}

.bb-menu-visibility__allowlist-list {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.bb-menu-visibility__allowlist-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.bb-settings-sticky-save {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 0;
  margin-top: 0.5rem;
  background: color-mix(in srgb, var(--bb-bg, #fff) 92%, transparent);
  border-top: 1px solid var(--bb-border);
  backdrop-filter: blur(6px);
}

.bb-analytics-settings {
  padding-bottom: 0.5rem;
}
```

Tune tokens to match nearby `--bb-*` usage in the file (prefer existing vars over inventing new ones).

- [ ] **Step 1: Add CSS**

- [ ] **Step 2: Commit**

```bash
git commit -m "style(web): analytics menu visibility grid and sticky save"
```

---

### Task 3: Restructure `analytics-tab.tsx`

**Files:**
- Modify: `apps/web/components/settings/tabs/analytics-tab.tsx`
- Reuse: `apps/web/components/settings/bug-budget/setup-section.tsx`

**Interfaces:**
- Import `SetupSection`, `readAnalyticsSetupOpen`, `toggleAnalyticsSetupOpen`
- State: `setupOpen` initialized via `readAnalyticsSetupOpen()` on client (same pattern as bug-budget-tab: `useState(() => new Set())` then `useEffect` to hydrate from sessionStorage if BB does that — **match whatever bug-budget-tab actually does for first paint**)

**Menu visibility labels** (short):

```ts
{ key: 'defect_analytics', label: 'Defect Analytics' },
{ key: 'defect_tracker', label: 'Defect Tracker' },
{ key: 'leaderboard', label: 'Leaderboard' },
{ key: 'bug_budget', label: 'Bug Budget' },
```

**JSX order:**

1. Wrapper: `<div className="bb-layout"><div className="bb-main bb-analytics-settings">…`
2. Menu visibility card — grid of toggles; allowlist uses `bb-menu-visibility__*` classes (remove inline styles)
3. SLA card (unchanged fields)
4. Digest card (unchanged fields/actions)
5. `<div className="bb-setup-group"><h3 className="bb-setup-group__title">Setup</h3>` + two `SetupSection`s for KPI and Escape (move existing bodies inside)
6. Sticky save: `<div className="bb-settings-sticky-save"><button className="btn btn-primary" …>`

Setup toggle handler:

```ts
onOpenChange={(open) => setSetupOpen(toggleAnalyticsSetupOpen(id, open))}
```

Hydrate open set on mount:

```ts
useEffect(() => {
  setSetupOpen(readAnalyticsSetupOpen());
}, []);
```

- [ ] **Step 1: Implement restructure**

- [ ] **Step 2: Typecheck** `pnpm --filter web typecheck`

- [ ] **Step 3: Manual smoke** (or note for human): order, accordion persist, allowlist, sticky save, save still works

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): analytics settings hybrid layout with setup accordion"
```

---

### Task 4: Verify + PR

- [ ] **Step 1:** `pnpm --filter web exec vitest run lib/analytics-settings-setup-open.test.ts` + typecheck

- [ ] **Step 2:** Manual checklist from spec

- [ ] **Step 3:** Branch `feat/analytics-settings-layout`, push, open PR against `master`

---

## Spec coverage

| Spec item | Task |
|---|---|
| sessionStorage setup open | 1 |
| Menu grid + allowlist CSS + sticky save CSS | 2 |
| IA reorder + SetupSection + sticky Save + short labels | 3 |
| No API changes | all (by omission) |
