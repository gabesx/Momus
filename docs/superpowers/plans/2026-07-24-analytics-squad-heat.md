# Analytics Squad Heat Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **squad × severity heat map** to the Defect Analytics dashboard so managers can see, at a glance, which squads carry the most open Critical/Major backlog — the concentration view the flat distribution table can't show.

**Architecture:** Pure rules extend `packages/domain/src/analytics/distribution.ts` (reusing its squad-key resolution); the heat matrix rides along on the existing `summary.distribution` payload, so no API route change; a new panel renders it on the homepage dashboard. Momus `bug_budget` only; respects all existing filters.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, CSS (no new chart lib — a colored HTML grid).

**Spec:** Realizes the "squad heat" lens listed as out-of-scope in `docs/superpowers/specs/2026-07-13-analytics-risk-panel-design.md`; sibling to `docs/superpowers/plans/2026-07-24-analytics-inflow-outflow.md`.

**Branch:** `feat/analytics-squad-heat`

---

## Definitions

- **Rows (squads):** `nonEmpty(real_project) ?? project` — identical to `distribution.by_squad` so the two views reconcile.
- **Columns (severity):** derived from `severity_issue`, ordered by a known priority `['Critical','Major','Minor','Low']` then any remaining values alphabetically, with blanks bucketed as `'Unspecified'`.
- **Cell value:** count of **open** issues (`is_open`) for that squad+severity — open backlog is the actionable heat. Row/column/grand totals included for reference.
- **Heat intensity (UI):** cell background scaled by `cell / maxCell` across the grid; Critical/Major columns emphasized. Theme-aware and accessible (never color alone — the number is always shown).

Rows ordered by open Critical/Major desc, then open desc (worst squads on top).

---

## File map

| Path | Role |
|---|---|
| `packages/domain/src/analytics/types.ts` | Add `AnalyticsSquadHeat` type + optional `squad_heat` on `AnalyticsDistributionResult` |
| `packages/domain/src/analytics/distribution.ts` | Compute the squad × severity matrix |
| `packages/domain/src/analytics/distribution.test.ts` | New cases (matrix counts, ordering, unspecified severity) |
| `apps/web/app/api/analytics/route.ts` | No logic change — verify `squad_heat` rides on `summary.distribution` |
| `apps/web/components/analytics/squad-heat-panel.tsx` | New heat-grid panel (create) |
| `apps/web/components/analytics/defect-analytics-dashboard.tsx` | Mount panel near the Distribution panel |
| `packages/domain/src/analytics/csv.ts` | (Optional) squad × severity section in export |

---

### Task 1: Domain — squad × severity matrix

**Files:**
- Modify: `packages/domain/src/analytics/types.ts`
- Modify: `packages/domain/src/analytics/distribution.ts`
- Modify: `packages/domain/src/analytics/distribution.test.ts`

- [ ] **Step 1:** Add `AnalyticsSquadHeat` type — `{ squads: string[]; severities: string[]; open: Record<string, Record<string, number>>; row_totals: Record<string, number>; col_totals: Record<string, number>; max: number }` — and an optional `squad_heat?: AnalyticsSquadHeat` on `AnalyticsDistributionResult` (backward-compatible).
- [ ] **Step 2:** In `computeAnalyticsDistribution`, build the matrix from open rows, reusing the existing `nonEmpty(real_project) ?? project` squad key and the severity ordering above. Compute row/col totals and `max` (largest cell, for UI scaling).
- [ ] **Step 3:** Order squads by open Critical/Major desc → open desc → name; order severities by the fixed priority list then alphabetical.
- [ ] **Step 4:** Failing-first Vitest cases: cell counts for a mixed fixture, squad ordering worst-first, `'Unspecified'` bucket for blank severity, open-only (closed rows excluded), empty input → empty arrays.
- [ ] **Step 5:** `pnpm --filter @momus/domain test`
- [ ] **Step 6:** Commit `feat(domain): analytics squad × severity heat matrix`

### Task 2: API + contract

**Files:** `apps/web/app/api/analytics/route.ts`, `packages/domain/src/analytics/contract.test.ts`, (optional) `csv.ts`

- [ ] Confirm `squad_heat` flows through `summary.distribution` (no route change).
- [ ] Add a contract-test assertion for the `squad_heat` shape.
- [ ] (Optional) Add a squad × severity section to the analytics CSV export.
- [ ] Commit `test(analytics): squad heat contract + optional CSV section`

### Task 3: UI — Squad heat panel

**Files:** `apps/web/components/analytics/squad-heat-panel.tsx` (new), `defect-analytics-dashboard.tsx`

- [ ] Build `SquadHeatPanel`: HTML grid, squads as rows, severity as columns, each cell showing the open count with a background scaled by `cell / max`. Row/column totals in a header/footer. Loading skeleton + empty state matching sibling panels.
- [ ] Accessibility: numeric label in every cell; `title`/`aria-label` per cell; sufficient contrast in light and dark themes.
- [ ] Mount in `defect-analytics-dashboard.tsx` adjacent to `DistributionPanel`; reads `data.summary.distribution.squad_heat`; respects current filters automatically.
- [ ] Commit `feat(web): squad × severity heat map on analytics homepage`

### Task 4: Verify

- [ ] `pnpm --filter @momus/domain test`
- [ ] `pnpm --filter web typecheck` and `@momus/domain typecheck`
- [ ] `pnpm --filter web build` (coordinate — a running `next dev` shares `.next`)
- [ ] Manual: load homepage (logged in), toggle a project/severity filter, confirm the heat grid updates and row totals reconcile with `by_squad` open counts.

### Task 5: PR

- [ ] Push `feat/analytics-squad-heat`; open PR with before/after screenshots + test plan; reference this plan and the risk-panel spec's out-of-scope note.

---

## Execution

Start Task 1 after this plan is saved. Domain-first (pure matrix + tests), then contract, then UI. Prefer inline execution in this session.
