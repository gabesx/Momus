# Executive QA Report — Implementation Plan (Epic)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. This is an epic delivered in phases; each phase is its own branch + PR.

**Goal:** A dedicated **Executive Report** web page answering: are we getting better or worse, which product is riskiest, are we fixing fast enough, are releases safe, which teams need help. Structured as an **Executive Summary** + per-product **Product Health** sections. The weekly chat digest carries the Exec Summary highlights and links to this page.

**Decisions (confirmed):**
- Home = dedicated web report page (printable/exportable); digest links to it.
- **Release-blocking** = `is_open && priority === 'Highest' && severity_issue === 'Critical'` (both at top). Values live in a `RELEASE_BLOCKING` constant for easy tuning.
- Product sections = **dynamic** from `real_project` (fallback `project`), ordered by risk.

**Reuse:** `computeWeeklyDigest` (created/resolved/net), `computeAnalyticsDistribution` + `squad_heat`, `computeAnalyticsRisk`, `computeTrends`, existing Jira browse-URL builder.

**Sequencing note:** builds on the weekly-digest branch (`computeWeeklyDigest`). Start after that PR merges to master (or stack on it). Each phase below is a separate PR.

---

## New capabilities needed (shared across phases)

1. **Weekly trend grain** — trends currently support month/quarter/year; add an 8-week weekly series (for "Bug Trend, last 8 weeks").
2. **Per-priority distribution** — open counts by `priority` (severity breakdown already exists via `squad_heat`).
3. **Release-blocking predicate** — `isReleaseBlocking(row)` + counts.
4. **Issue-level projection** — `AnalyticsIssueRow` lacks `jira_key`, `reporter`, `assignee`. Extend the analytics projection (`BugBudgetQueryRepository.listAllForFilters` + type) to carry them so issue lists can show owner/reporter and link to Jira.
5. **Issue-list builders** — `topOpenBySeverity(rows, n)` and `oldestOpen(rows, n)` returning `{ jira_key, summary?, severity, priority, assignee, reporter, age_days, url }`.

---

## Phase 1 — Executive Summary + report page shell (first shippable slice)

**Deliverable:** `/reports/executive` page with the Executive Summary block; digest links to it.

- [ ] **Domain:** `RELEASE_BLOCKING` constant + `isReleaseBlocking`; `computeExecutiveSummary(rows, nowIso)` → total open, new/closed this week (reuse weekly), backlog now vs week ago, release-blocking count, top squad, and the **release-blocking issue list** (jira_key/assignee/reporter). Tests.
- [ ] **Infra projection:** add `jira_key`, `reporter`, `assignee` to the analytics row projection + type; unit-cover the mapping. Jira base URL from settings for links.
- [ ] **API:** `GET /api/reports/executive` (requireViewAnalytics) → exec summary payload (cache like `/api/analytics`).
- [ ] **Web:** `/reports/executive` page + `ExecutiveSummary` component (stat tiles, backlog trend sparkline reusing inflow/outflow data, release-blocker table with Jira links). Nav entry.
- [ ] **Verify + PR.**

## Phase 2 — Product Health (per product)

**Deliverable:** one Product Health section per product on the same page.

- [ ] **Domain:** weekly trend grain (8 weeks); per-priority distribution; `computeProductHealth(rows, product, nowIso)` → open by severity, open by priority, new vs closed (this week + trend), 8-week trend, top-10 critical/open, oldest open, release-blocking defects. Tests.
- [ ] **API:** extend the report endpoint with `products: ProductHealth[]` (dynamic from `real_project`, risk-ordered).
- [ ] **Web:** `ProductHealthSection` component (severity/priority bars, new-vs-closed, 8-week sparkline, top-10 + oldest tables with links, release-blockers), repeated per product with a product jump-nav.
- [ ] **Verify + PR.**

## Phase 3 — Polish & delivery

- [ ] Print/export (print stylesheet or HTML export) for the report page.
- [ ] Weekly digest: add release-blocking count + "Open the executive report" link to the page.
- [ ] Optional: filters (date range, product) on the report page.
- [ ] **Verify + PR.**

---

## Resolved data facts

- **Issue title:** `bug_budget.summary` (TEXT) exists → issue-list tables can show the title + key.
- **Jira links:** reuse the existing `jiraUrl(base, key)` builder with the settings-derived `jiraBrowseBase` (as in `issues-table.tsx`); links are `${base}/browse/<key>`.
- **Issue-level fields available on `bug_budget`:** `jira_key`, `summary`, `reporter`, `assignee`/`engineer_assignee`, `priority`, `severity_issue`, `fix_versions`, `defect_age_days`.

---

## Execution

Phase 1 first, domain-first within it. Confirm the two open questions, then start Phase 1 Task 1. Each phase ships as its own PR.
