# Analytics settings layout polish — Design Spec

**Date:** 2026-09-09  
**Status:** Approved for planning  
**Route:** `/settings/atlassian#analytics`  
**Scope:** Information architecture + visual polish for the Analytics settings tab only

## Goal

Make Analytics settings scannable like the Bug Budget ops cockpit: Menu visibility and Digest stay above the fold, infrequent KPI/Escape tuning folds under Setup, and Save stays reachable via a sticky bar. No API or domain behavior changes.

## Non-goals

- New endpoints or settings schema changes
- Extracting Analytics into many files (stay in `analytics-tab.tsx` + CSS)
- Redesigning Atlassian / Bug Budget / Roster tabs
- Changing menu-visibility or digest semantics

## Decisions (approved)

| Topic | Choice |
|---|---|
| Approach | IA + CSS polish; reuse Bug Budget `SetupSection` |
| Always open | Menu visibility, SLA thresholds, Weekly digest |
| Collapsed Setup | KPI thresholds, Defect escape detection |
| Save | Sticky primary bar at bottom of tab |
| Menu toggles | 2×2 grid; short labels |

## Information architecture

Top → bottom:

1. **Menu visibility** (hero `settings-card`)
2. **SLA thresholds** (`settings-card`, always open)
3. **Weekly digest** (`settings-card`, always open)
4. **Setup** (`bb-setup-group`)
   - KPI thresholds (`SetupSection`, default closed)
   - Defect escape detection (`SetupSection`, default closed)
5. **Sticky Save** bar

Setup open state persisted in `sessionStorage` key `momus.analyticsSettings.setupOpen` (array of section ids: `kpi`, `escape`). Same read/write pattern as Bug Budget’s `bb-settings-setup-open` helpers (either a tiny sibling module or inline mirror — prefer a small `analytics-settings-setup-open.ts` to avoid coupling keys).

## Menu visibility hero

- Title: Menu visibility  
- Helper: when a module is off, nav/pages/APIs hard-hide except allowlisted users; Settings stays available  
- Grid of four checkboxes (CSS, not inline): Defect Analytics, Defect Tracker, Leaderboard, Bug Budget  
- When any module is off, show allowlist panel:
  - Legend: Hide from everyone — still show to selected users  
  - Scrollable checklist of approved candidates (existing fetch)  
  - Row copy: `name — email`

## SLA and Digest

Keep current fields and actions. Light spacing/alignment only (existing `field-row` / `field` patterns). Digest retains Enable, provider, webhook, day/hour, Send digest now.

## Setup accordion

Reuse `apps/web/components/settings/bug-budget/setup-section.tsx` (generic enough — path name is historical). Hints optional, e.g.:

- KPI: “When dashboard tiles turn warning/danger”  
- Escape: “How production escapes are detected”

Bodies hold today’s KPI inputs + reset button, and escape mode/labels/types UI unchanged.

## Sticky Save

- Container class e.g. `bb-settings-sticky-save` inside the tab  
- `position: sticky; bottom: 0;` with background, top border, z-index above cards  
- Button: existing Save analytics settings / Saving…  
- Pad bottom of `.bb-main` content (or sticky bar’s sibling stack) so the last setup section is not obscured

## Files (expected)

| Path | Change |
|---|---|
| `apps/web/components/settings/tabs/analytics-tab.tsx` | Reorder sections; SetupSection; sticky save; shorter labels |
| `apps/web/app/globals.css` | Menu visibility grid/allowlist; sticky save bar |
| `apps/web/lib/analytics-settings-setup-open.ts` (new, optional) | sessionStorage helpers for Setup open set |

## Testing

- Manual: sections order; Setup collapses/expands and survives refresh within tab  
- Allowlist still appears only when a module is unchecked  
- Save still POSTs full settings and calls `reloadMe`  
- Sticky Save remains visible while scrolling long Setup content  
- Mobile: 2×2 menu grid stacks to one column; sticky bar usable  

## Out of scope follow-ups

- Split `analytics-tab.tsx` into subcomponents  
- Two-column desktop layout  
- Sticky Save shared across all settings tabs  
