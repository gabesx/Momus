# Defect Tracker People Filters + Column Sort — Design Spec

**Date:** 2026-09-09  
**Status:** Approved for planning  
**Scope:** `/tracker` — filter by Reporter / Creator / Owner; sortable table headers  
**Stack:** `@momus/domain` tracker filter/sort, Next.js tracker UI + `/api/tracker`

## Goal

Let users narrow Defect Tracker rows by **Reporter**, **Creator**, and **Owner/Ownership**, and sort by clicking **any** table column header (asc/desc), with state in the URL.

## Non-goals

- Pushing filters/sort into Supabase `ORDER BY` / SQL `WHERE`
- New API routes
- Changing inline edit behavior for Momus-owned fields
- Bug Budget dashboard filter/sort changes

## Approach (approved)

**Client-side on the already-fetched tracker row set** (same path as today: `repo.listForFilters()` → `applyTrackerFilters` → paginate):

1. Extend `TrackerFilterParams` with `reporter`, `creator`, `owner`
2. Domain filtering + `sortTrackerRows` before `slice` for pagination
3. URL: people params + `sort` + `direction`
4. UI: dropdown + optional text per person field; clickable `<th>` with `aria-sort`

## People filters

### Params

| Param | Meaning |
|---|---|
| `reporter` | Filter by reporter |
| `creator` | Filter by creator |
| `owner` | Filter by ownership display value |

One string per field (no separate `_q` keys).

### Match rules

For each param, if set (non-empty after trim):

1. If the value **exactly equals** a known distinct option (case-sensitive as stored), require exact equality on the row field.
2. Otherwise treat as **case-insensitive substring** contains.
3. Special option **`Unassigned`**: matches rows where the resolved value is empty/null.

### Field resolution

| Filter | Row value |
|---|---|
| Reporter | `row.reporter` |
| Creator | `row.creator` |
| Owner/Ownership | `firstNonEmpty(row.owner, row.tester_assignee)` — **same as table cell** |

### UI

In advanced filters (Apply / Reset / chips), for each of the three people fields use **one draft string**:

- **Dropdown** sets that string to the selected option (`""` = All, or a distinct name, or `Unassigned`)
- **Text input** edits the same string (free-text contains when not an exact option)
- No separate competing dropdown/text values — Apply sends one param per field
- Draft → Apply pattern unchanged; changing people filters resets `page` to 1
- Active chips for `reporter` / `creator` / `owner`

### Options source

Extend `extractFilterOptions` (or tracker-specific helper) and `/api/tracker` `filter_options` with:

- `reporters: string[]`
- `creators: string[]`
- `owners: string[]` (distinct of resolved owner‖tester_assignee, excluding empties; UI adds Unassigned)

Options built from the full `listForFilters()` set (same as projects/years today).

## Column sort

### Params

| Param | Values |
|---|---|
| `sort` | Column id (see below) |
| `direction` | `asc` \| `desc` |

When `sort` is absent, keep current post-filter order (no forced default sort).

### Interaction

- Click header: set that column; first click → `asc`, click again → `desc` (toggle only; no clear-on-third)
- Changing sort resets `page` to 1
- Visual: sort control in `<th>`, `aria-sort`, subtle ▲/▼ indicator

### Column ids (both table views)

Cover all headers present in `missing_fields` / `all` and `no_linked_test` views, including at least:

`issue_type`, `jira_key`, `summary`, `missing_fields`, `reporter`, `creator`, `owner`, `created_date`, `end_date`, `parent`, `description`, `labels`, `severity_issue`, `service_feature`, `missing_description_fields`, `project`, `status`, `linked_issues`

Sort key for each column = display/normalized string (or date epoch for date columns). Nulls/empty **last** in both directions. Composite cells (linked issues, labels, missing-field badges) sort by stable display string.

### Domain

```ts
sortTrackerRows(rows: TrackerIssueRow[], sort: string | null | undefined, direction: 'asc' | 'desc' | null | undefined): TrackerIssueRow[]
```

Called in `/api/tracker` **after** `applyTrackerFilters`, **before** pagination slice.

## Wiring

| Layer | Change |
|---|---|
| `packages/domain` `TrackerFilterParams` | + `reporter`, `creator`, `owner`, `sort`, `direction` |
| `applyTrackerFilters` | people match rules |
| `sortTrackerRows` | new |
| `extractFilterOptions` | reporters/creators/owners |
| `apps/web/lib/tracker-params.ts` | parse/serialize new keys |
| `TrackerFilters` / chips | UI |
| `TrackerTable` | sortable headers; receive `sort`/`direction` + `onSortChange` |
| `defect-tracker-dashboard` | pass sort state through URL |
| `GET /api/tracker` | filter → sort → slice; richer `filter_options` |

## Testing

- Domain: owner matches `owner` and `tester_assignee`; Unassigned; exact vs contains; sort asc/desc; nulls last; date columns
- Params: round-trip `reporter`/`creator`/`owner`/`sort`/`direction`
- No golden-fixture weakening

## Success criteria

1. Can filter tracker list by reporter, creator, and owner (dropdown and free text)
2. Owner filter matches table Owner/Ownership display semantics
3. Every visible column header toggles asc/desc sort via URL
4. Pagination totals reflect filtered+sorted set; page resets on filter/sort change
