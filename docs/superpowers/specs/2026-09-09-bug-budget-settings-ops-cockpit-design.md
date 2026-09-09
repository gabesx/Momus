# Bug Budget Settings Ops Cockpit — Design Spec

**Date:** 2026-09-09  
**Status:** Approved for planning  
**Scope:** Optimize `/settings/atlassian#bug-budget` for day-to-day ops (IA + perf + visual polish)  
**Stack:** Next.js 15 App Router, existing settings client components, existing Momus APIs

## Goal

Restructure the Bug Budget settings tab into an **ops cockpit**: preview, sync, watch progress, and check activity/health are above the fold; infrequent setup (projects, multipliers, schedule) is collapsed by default. Improve load behavior and visual hierarchy without changing API contracts or domain logic.

## Non-goals

- New sub-tabs or routes under Bug Budget settings
- API / route / domain / Inngest contract changes
- Rewriting Atlassian, Analytics, or Roster tabs
- Rebrand or new design system (stay on `--bb-*` + `settings-card` patterns)
- Golden-fixture or `bug_budget` table changes

## Primary user job

**Day-to-day ops:** enter/adjust JQL, Preview, Sync, watch progress, skim recent activity and system health. Setup is occasional and may be one expand deeper.

## Approach

**Ops cockpit with setup accordion** (approved):

1. Always-visible ops strip: connection → sync config/actions → progress (when active) → activity + health
2. Collapsed-by-default setup group: Project Budget & Mapping, Cost Multipliers, Automated Sync Schedule
3. Eager load ops data; lazy load setup payloads on first accordion open
4. Light component extraction from `bug-budget-tab.tsx`; same tab shell

## Information architecture (top → bottom)

1. **Connection banner** — existing ok/bad + Manage Atlassian (unchanged semantics)
2. **JQL / Sync ops card** — query, sync type, batch/max, period fields when non-custom; actions with hierarchy:
   - **Primary (`btn-primary`):** Sync with Database (replace current `btn-success` so Save is no longer the strongest control)
   - **Secondary (`btn-outline`):** Test Fetch (Preview Only)
   - **Outline (`btn-outline`):** Save Configuration
   - **Ghost (`btn-ghost`):** Clear JQL
3. **Sync Progress** — only when a sync run is present (queued/running/completed/failed for current session)
4. **Sync Activity** — compact list (show last ~5 of the already-fetched activity window); keep “last 7 days” data source as today
5. **System Health** — sidebar on desktop (`bb-layout`); stacks under main column on `≤900px`
6. **Setup group** (label: “Setup”) — three collapsed sections:
   - Project Budget & Mapping (incl. Fetch from Jira picker)
   - Bug Cost Multiplier Settings
   - Automated Sync Schedule

Open/closed state for setup sections persisted in `sessionStorage` (key e.g. `momus.bbSettings.setupOpen`) so a setup session survives refresh within the tab.

## Performance & data loading

### Today

`loadMeta()` on mount hits four endpoints in parallel: config, sync-activity, bug-budget stats, cron-schedule.

### Target

| Phase | When | Data |
|---|---|---|
| Eager | Tab mount | `config.sync_query` (JQL/sync params only), sync activity, dashboard stats (`total` / `bugs` / `open`) |
| Lazy | First open of relevant setup section | Multipliers, project budgets/mappings, full cron schedule |

Rules:

- Parent still loads connection via existing Atlassian settings shell.
- Lazy sections cache results in component state; re-open does not refetch unless Refresh / successful save / sync completion triggers a targeted reload.
- Sync completion continues to refresh ops meta (activity + stats; sync_query if needed).
- Polling: 2s interval only while status is `queued` or `running`; clear on `completed` / `failed` or 5 consecutive poll failures (existing behavior).
- Prefer splitting the config GET client-side usage (use only needed fields eagerly) over new endpoints. If the single `/api/settings/bug-budget/config` response is small, one eager config fetch is acceptable; **do not** block first paint on rendering setup forms — still defer mounting heavy setup UI until expand.

No new API routes required for v1.

## Components

Path: `apps/web/components/settings/tabs/` (and optional `settings/bug-budget/` subfolder if files multiply)

| Piece | Responsibility |
|---|---|
| `BugBudgetTab` | Orchestration, busy state, alerts, polling, load eager/lazy |
| `SyncOpsCard` | JQL, sync type/params, examples, action row |
| `SyncProgressCard` | Progress bar, status, result/error |
| `SyncActivityList` | Compact recent activity |
| `SystemHealthCard` | Stats + Refresh |
| Setup wrappers | Accordion/`details` for projects, multipliers, cron (can stay inline initially if extraction is noisy) |

Behavior and endpoint payloads stay identical to current handlers (`save-sync-query`, `fetch-from-jira`, `sync-with-progress`, `sync-status`, multipliers/projects/cron routes).

## Visual polish

- Reuse `settings-card`, `btn-*`, `bb-layout`, `health-grid`, `progress` patterns.
- Slightly denser ops strip spacing; setup group visually secondary (muted group label, collapsed summaries showing section title only).
- Mobile: existing `@media (max-width: 900px)` stack; health not sticky; accordions full width.
- No purple gradients, new card chrome, or hero treatments — this is an admin settings surface inside the existing product shell.

## Error handling

- Keep parent `onAlert` for success/error/info.
- Lazy-load failure: `onAlert('error', …)` + empty section body with Retry that re-invokes the lazy fetch.
- Preserve single `busy` discriminator so Sync/Preview/Save do not overlap.

## Testing

- Manual/smoke: `#bug-budget` hash still selects tab; Preview / Sync / Save still hit existing endpoints.
- Light client test (Vitest + RTL if already used for settings): setup sections default collapsed; first expand triggers lazy fetch once (mock `apiJson`).
- No domain / golden fixture changes.

## Success criteria

1. Ops actions (Preview, Sync, progress, activity, health) visible without scrolling past setup forms on a typical laptop viewport.
2. Initial tab work does not render or require interaction with project/multiplier/cron forms until expanded.
3. Button hierarchy makes Sync the obvious primary action.
4. No API contract drift; existing sync and save flows still work.

## Out of scope follow-ups (optional later)

- Dedicated slim config endpoints
- Deep-link hash to open a specific setup section
- Persist accordion state in `localStorage` across sessions
