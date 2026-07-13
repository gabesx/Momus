# Leaderboard SSR + slim query

**Date:** 2026-07-13  
**Status:** Approved  
**Approach:** B — SSR initial data + narrow/period-scoped SQL

## Goal

Make `/leaderboard` paint ranked data on first load (no empty shell → client fetch waterfall), and stop loading the full `bug_budget` table with summary columns for every leaderboard request.

## Non-goals

- No SQL aggregation RPC / Postgres ranking yet
- No change to bug-budget list / analytics `listAllForFilters` consumers
- No production-build or Google Fonts work (dev-only noise)

## Design

### 1. Slim query (`packages/infra`)

Add `BugBudgetQueryRepository.listForLeaderboard(range: DateRange | null)`:

- Select only leaderboard columns (14):  
  `reporter, issue_type, project, status, created_date, jira_key, summary, severity_issue, priority, parent, service_feature, ac_related_labels, tester_assignee, owner`
- When `range` is set, filter `created_date` to the inclusive period window (reuse `resolvePeriodRange` / meta dates from domain)
- Keep `fetchAllPages` pagination
- Leave `listAllForFilters` / `SUMMARY_COLUMNS` unchanged for other features

Wire both:

- `GET /api/leaderboard`
- `GET /api/leaderboard/reporter-issues`

to `listForLeaderboard`. Domain still runs `computeLeaderboard` / drill filters in memory on the smaller row set (issue-type, reporter completeness, rejected keywords).

### 2. Shared loader (`apps/web`)

Extract `loadLeaderboard(params)` (auth + query + `computeLeaderboard` + `filter_options`) used by:

- API route
- Server page

Same auth gate: `requireViewAnalytics`. Same JSON shape as today (`LeaderboardResult` + `filter_options`).

### 3. SSR page

`app/leaderboard/page.tsx` becomes an async server component:

- Parse `searchParams` → `LeaderboardFilterParams`
- Call `loadLeaderboard`
- Pass `initialData` + `initialParams` into `LeaderboardDashboard`

Client dashboard:

- Seed state from `initialData` / `initialParams`
- Skip the first client refetch when URL params match the SSR payload
- Keep existing client fetches for filter Apply, popstate, and reporter drill

## Behavioral parity

- Rankings and drill results must match current golden/domain tests for the same period window
- Default period remains `quarterly` with domain-resolved year/period
- Period `all` still pages all rows, but with the narrow column set only

## Success criteria

- First HTML response for `/leaderboard` includes rank data (or a server-rendered shell that hydrates with `initialData` without an immediate duplicate fetch)
- Leaderboard SQL selects ≤14 columns and applies date bounds when period ≠ `all`
- Existing leaderboard domain tests still pass; add/adjust infra or web tests for the new query helper / skip-refetch behavior as needed
