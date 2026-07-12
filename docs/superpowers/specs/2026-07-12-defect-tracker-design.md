# Defect Tracker (Momus) — Design

**Date:** 2026-07-12  
**Status:** Approved  
**Approach:** Momus-native module beside existing Analytics + Bug Budget (same app shell, `bug_budget` SoT). Not a QARATMS port and not a UI redesign.  
**Scope:** Full Tracker surfaces for cutover: filtered list, missing fields, no linked test execution, inline field write-backs with sync-safe overrides. Jira write API is out of scope.

## North star

QA operators use Momus Defect Tracker to find incomplete or unlinked bugs/defects, fix Momus-owned fields inline, and keep those fixes across Jira sync — without leaving the existing Momus nav/UX.

## What stays unchanged

| Surface | Status |
|---|---|
| `/` Defect Analytics | Unchanged (separate epic / PR) |
| `/bug-budget` Bug Budget | Unchanged |
| App shell (`AppHeader`, auth, CSRF, `bb-*` styles) | Reused |
| `bug_budget` core columns + sync pipeline | Extended only (additive override metadata + skip rules) |

## Decisions (locked)

1. **Disposition:** Rebuild in Momus (Approach A — domain + API + `/tracker` page).
2. **Write-backs:** Momus `bug_budget` only for `parent`, `linked_issues`, `severity_issue`, `service_feature`. Jira remains read-only; push-to-Jira is a later epic.
3. **Overrides:** Per-field flags so sync **upserts** as today but **skips** overridden columns (does not wipe/rebuild the table).
4. **Surfaces:** All list + **Missing fields** + **No linked test** (+ project grouping if useful).
5. **Nav:** `/tracker`, label **Defect Tracker**, between Analytics and Bug Budget.
6. **Edit UX:** Inline table cells.

## Data model — `tracker_overrides`

Additive column on `bug_budget`:

```sql
tracker_overrides JSONB NOT NULL DEFAULT '{}'::jsonb
```

Shape — keys only among the four editable fields:

```json
{
  "severity_issue": { "at": "2026-07-12T02:00:00.000Z", "by": "123" },
  "parent": { "at": "...", "by": "..." }
}
```

| Rule | Detail |
|---|---|
| Values | Stored in existing columns (`parent`, `linked_issues`, `severity_issue`, `service_feature`) |
| Flags | Key present in `tracker_overrides` ⇒ Momus SoT for that field; sync must not overwrite it |
| PATCH | Writes column value(s) and sets/updates corresponding override key(s) |
| Clear / reset to Jira | Out of v1 (optional later: drop key so next sync fills again) |
| Contract | Additive only — no rename/remove of existing `bug_budget` columns (BB-DATA-07) |

**Sync behavior:** Existing upsert-by-`jira_key` continues. For each row, when applying Jira → Momus, omit any of the four columns whose name is a key in `tracker_overrides`. Unedited rows behave exactly as today.

## Architecture

```
packages/domain/src/tracker/*   filters, missing-field rules, linked-test membership,
                                patch validation, override merge helpers (pure)

packages/infra                  list/query; PATCH row; sync upsert respects overrides

apps/web                        /tracker UI; GET/PATCH /api/tracker*

packages/jobs (sync)            honor tracker_overrides when writing Jira payload → row
```

Dependency rule unchanged: domain imports only shared; no React/DB in domain.

## UI + API

**UI (`/tracker`)** — same visual language as Bug Budget:

1. Header + refresh  
2. Filter bar (project, year, type, search, … — domain-driven)  
3. Tabs: **All** | **Missing fields** | **No linked test** (optional project group chips)  
4. Paginated `bb-table` with inline edit on the four fields; badge when overridden  
5. Link to Jira / existing detail where useful  

**API**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/tracker` | Filtered list, tab counts, filter options |
| `PATCH` | `/api/tracker/[jiraKey]` | CSRF; subset of four fields → columns + override keys |

**Auth:** Authenticated non-candidate (same family as other Momus views). Prefer existing view/edit permission patterns; do not invent a parallel auth stack.

## Errors

- `PATCH`: 422 unknown/invalid fields; 404 missing key; 403 unauthenticated; CSRF required on POST/PATCH.  
- Inline edit: row-level error; do not wipe sibling cell state.  
- List failures: same alert pattern as Analytics / Bug Budget.

## Caching

Invalidate or version-bump any Tracker list/count cache on successful Bug Budget sync (parity with legacy Tracker flush-on-sync intent).

## Testing

- Domain Vitest: missing-field rules, no-linked-test filter, override helpers.  
- Sync/unit: upsert skips overridden columns.  
- API: GET filters; PATCH sets column + override key.  
- Do not weaken Appendix A / Bug Budget golden fixtures.

## Milestones

| ID | Deliverable |
|---|---|
| **M1** | Types + `tracker_overrides` migration + contract tests |
| **M2** | Domain filters / missing fields / linked-test / patch validation |
| **M3** | `GET`/`PATCH` API + sync skip wiring |
| **M4** | `/tracker` UI (tabs, filters, inline edit, nav) |
| **M5** | Override badges, tab counts polish, cache flush on sync |

## Out of scope

- Jira write-back API  
- Leaderboard  
- Redesign of Defect Analytics or Bug Budget  
- Reset-override / “revert to Jira” UX (unless needed as tiny follow-up)  
- Performance module  

## Cutover note

Marks Defect Tracker (+ Momus-owned write path for the four fields) as **rebuild in Momus** for BB-MIG-05 disposition. QARATMS Tracker can retire after this ships and cutover checklist passes.
