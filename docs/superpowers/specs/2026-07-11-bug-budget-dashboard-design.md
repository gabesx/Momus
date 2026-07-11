# Bug Budget Dashboard UI — Design Spec

**Date:** 2026-07-11  
**Status:** Approved for planning  
**Scope:** Phase 4 BB-UI-02 through BB-UI-08 (full parity, one pass)  
**Stack:** Next.js 15 App Router, client components, existing Momus APIs

## Goal

Ship a Momus `/bug-budget` dashboard that matches legacy QARATMS structure and behavior (header actions, clickable stats, severity panel, filters with debounce + pushState, issues table with columns/sort/pagination, CSV export, fullscreen bug/defect summary modals, detail page), wired to existing Phase 3 APIs and Momus design tokens.

## Non-goals

- QARATMS global header / sidebar / menu visibility
- Select2, Bootstrap JS, Font Awesome / Bootstrap Icons CDN
- BB-CACHE-01 cache layer
- Replacing `MOMUS_DEV_AUTH_BYPASS` with production Supabase Auth
- Pixel-perfect Bootstrap class-name port

## Approach

**Client dashboard shell** (approved):

- `/bug-budget` — client `BugBudgetDashboard` owns URL state and fetches
- `/bug-budget/[id]` — detail page (numeric id or `jira_key`)
- Calls existing `GET /api/bug-budget`, summary endpoints, CSV export, detail API
- Visual language: Momus `--bb-*` tokens + settings card/button patterns
- Badge colors from `@momus/domain`

## Architecture

```
Browser URLSearchParams
        │
        ▼
BugBudgetDashboard (client)
        │  debounce 100ms + pushState / popstate
        ▼
GET /api/bug-budget?...  ──► stats, filter_options, issues, pagination, jira_browse_base
GET /api/bug-budget/open-bug-summary?year=
GET /api/bug-budget/open-defect-summary?year=
GET /api/bug-budget/export/csv?...
GET /api/bug-budget/[id]
```

Page chrome: local header (title + toolbar) only — no full app shell yet.

## Layout (top → bottom)

1. **Header** — title, subtitle, toolbar  
2. **Stat cards** — six cards  
3. **Severity panel** — bars + collapsible AC/priority detail  
4. **Filters** — collapsible advanced panel  
5. **Issues table** — header controls, table, pagination  
6. **Modals** — Open Bug Summary, Open Defect Summary, Column Visibility  

## Components

Path: `apps/web/components/bug-budget/`

| Component | Responsibility |
|---|---|
| `BugBudgetDashboard` | URL state, fetch orchestration, alerts |
| `DashboardHeader` | Open Bug/Defect Summary, Settings, Columns, Export CSV |
| `StatCards` | Six cards; five apply filter presets; Avg Age non-clickable |
| `SeverityPanel` | Relative bars + collapse for AC / priority breakdown |
| `FilterPanel` | Collapsible form mirroring legacy fields |
| `IssuesTable` | Columns, badges, Jira links, per-page, sort, pagination |
| `ColumnVisibilityModal` | Toggle columns; Key required; persist localStorage |
| `SummaryModal` | Fullscreen; year select; project budget cards from API |

Detail: `apps/web/app/bug-budget/[id]/page.tsx` — read-only fields + raw Jira JSON.

## URL / filter contract

Reuse legacy / API query param names already supported by `GET /api/bug-budget` and `apps/web/lib/bug-budget-params.ts` where present:

- Selects: `project`, `status`, `status_category`, `issue_type`, `issue_type_group`, `reporter`, `year`, `quarter`, `ac_related`
- Text: `assignee`
- Dates: `date_from`, `date_to`
- Age: `age_min`, `age_max`
- Flags: `show_all`, `include_all_projects`, `not_done`, `open_critical_major`
- Table: `page`, `per_page`, `sort`, `direction`

**Behavior**

- Filter change → 100ms debounce → `history.pushState` → refetch  
- Browser back/forward → `popstate` → refetch  
- Stat card click → merge that card’s filter patch, reset `page=1`, refetch  
- Reset → clear filters to defaults  

**Stat card filter patches** (parity with legacy HTML):

| Card | Patch |
|---|---|
| Total Issues | clear `not_done`, `status_category`, `date_from`, `date_to`, `open_critical_major` |
| Open Issues | `not_done=1`, clear `status_category`, `open_critical_major` |
| Closed Issues | `status_category=done`, clear `not_done`, `open_critical_major` |
| Open Critical/Major | `not_done=1`, `open_critical_major=1`, clear `status_category` |
| Recent (30d) | `date_from=<today-30 Asia/Jakarta>`, clear open/status/critical quick filters |
| Avg Age | not clickable |

## Table columns

**Default visible:** Key (required), Project, Summary, Status, Priority, Severity, Assignee, Test Assignee, Reporter, Created, Age  

**Optional:** Issue Type, Closed, Complete Date, Resolution Date  

- Key links to `{jira_browse_base}/browse/{jira_key}` in a new tab  
- Column visibility stored in `localStorage` (e.g. `momus.bugBudget.columns`); corrupt → defaults  
- Apply columns shows M-04 toast  

## Summary modals

- Fullscreen overlay (Momus CSS, not Bootstrap modal)  
- Year select: All Years + 2020…current+1  
- Load on open and on year change  
- Render project cards from summary API (budget, cost, remaining, status color, severity tables) using domain budget/status helpers where available  
- Loading spinner + legacy-style “Loading…” copy while fetching  

## Detail page

- Route `/bug-budget/[id]` resolves via `GET /api/bug-budget/[id]`  
- Show core fields (key, project, summary, status, priority, severity, assignee, dates, age, type)  
- “Open in Jira” when browse base present  
- Collapsible / preformatted `raw_jira_data` (never log secrets; display only)  
- Back link to `/bug-budget`  

## CSV export

- Toolbar **Export CSV** → `GET /api/bug-budget/export/csv` (or `/bug-budget/export/csv` alias) with **current** filter query string  
- Full navigation download (not AJAX JSON)  

## States (BB-UI-11)

| State | Behavior |
|---|---|
| Loading | Skeleton / muted placeholders for stats + table |
| Empty | M-05 / M-06 |
| Error | Dismissible error alert; keep last good data if any |
| Success | Column-apply toast (M-04); summary loads show content |

## Errors & edges

- Auth/API failure → error alert  
- Missing `jira_browse_base` → Key as plain text  
- Summary slow → modal spinner  
- Large reporter lists → native `<select>` (no Select2)  

## Messages

Use `@momus/shared` catalog verbatim (M-01 scope banner if API provides scope text; M-04 columns; M-05/M-06 empty; others as needed).

## File plan (implementation)

- `apps/web/app/bug-budget/page.tsx` — mount dashboard  
- `apps/web/app/bug-budget/[id]/page.tsx` — detail  
- `apps/web/components/bug-budget/*` — components above  
- `apps/web/app/globals.css` — dashboard-specific classes under `.bug-budget-*` / `.budget-*`  
- Extend `bug-budget-params` helpers if gaps vs legacy params  

## Done when

- [ ] `/bug-budget` shows header, stats, severity, filters, table, pagination against live API  
- [ ] Filters debounce + pushState; back/forward works  
- [ ] Stat cards apply expected filter patches  
- [ ] Columns modal persists; CSV respects filters  
- [ ] Bug + Defect summary modals load and render project cards  
- [ ] Detail page loads by id / jira_key  
- [ ] Visual review against legacy screenshot (structure + tokens, not Bootstrap clone)  
- [ ] `pnpm --filter @momus/web typecheck` passes  

## Traceability

| PRD / plan | Coverage |
|---|---|
| BB-UI-02 | Dashboard layout |
| BB-UI-03 | Stat cards |
| BB-UI-04 | Filter panel + debounce/pushState |
| BB-UI-05/06 | Table, columns, pagination, Jira links, empty states |
| BB-UI-07 | Summary modals |
| BB-UI-08 | Detail page |
| BB-UI-11 | Loading/empty/error/success |
| BB-UI-12 | Momus tokens (existing) |
