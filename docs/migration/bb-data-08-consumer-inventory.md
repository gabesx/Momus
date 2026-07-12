# BB-DATA-08: `bug_budget` Downstream Consumer Inventory

**Source:** Legacy Test Case Management
**Date:** 2026-07-11  
**Purpose:** Column-level dependency inventory for Momus migration cutover (PRD §4.7, BB-DATA-08)

**Search patterns** (excluding `storage/framework/views/`, `vendor/`, `node_modules/`, `.git/`):

- `BugBudget::`
- `table('bug_budget')` / `DB::table('bug_budget')`
- `App\Models\BugBudget`
- `bug_budget_sync_runs`
- `raw_jira_data` (tied to `bug_budget`)

---

## Summary Table

| Consumer | Access pattern | Critical columns |
|---|---|---|
| **Defect Analytics** (`DefectAnalyticsService`) | `BugBudget::query()` aggregations | `is_open`, `issue_type`, `status`, `severity_issue`, `priority`, `created_year`, `created_num_month`, `created_month_alpha`, `quarter`, `project`, `assignee_final`, `sprint`, `created_date`, `defect_age_days`, `end_date`, `actual_end`, `ac_related_labels`, `labels` |
| **Defect Tracker** (4+ services) | `BugBudget::query()` filters/counts/pagination | `project`, `issue_type`, `created_year`, `reporter`, `summary`, `jira_key`, `description`, `parent`, `parent_link`, `ac_related_labels`, `service_feature`, `severity_issue`, `tester_assignee`, `linked_issues`, `has_linked_test_execution`, `created_date` |
| **Defect Analytics Controller** (extra) | Eloquent read + local writes after Jira | `last_synced_at`, `jira_key`, `description`, `parent`, `parent_link`, `linked_issues`, `has_linked_test_execution`, `severity_issue`, `service_feature` |
| **Leaderboard** | `BugBudget::query()` + in-memory agg | `reporter`, `issue_type`, `project`, `status`, `created_date`, `jira_key`, `summary`, `severity_issue`, `priority` |
| **Performance** | `DB::table('bug_budget')` + `Schema::hasTable` | `reporter`, `issue_type`, `created_date`, `jira_key` |
| **Test Documentation** | **No table access** — Jira REST only | — |
| **Bug Budget module** (owner) | Query/summary/settings services | `is_open`, `final_issue_type`, `issue_type`, `defect_age_days`, `ac_related_labels`, … |
| **Sync producer** | Writer (`updateOrCreate`) | All fillable incl. `raw_jira_data` |

---

## Per-consumer notes

### Defect Analytics — `app/Services/DefectAnalytics/DefectAnalyticsService.php`
- Uses **`issue_type` only** (not `final_issue_type`).
- AC filters use JSON (`ac_related_labels`, `labels`).
- Cache keys `defect_analytics.*` appear **TTL-only** — sync does not clearly flush them (gap vs PRD wording).

### Defect Tracker
- `BugDefectTrackerService`, `DefectFilterService`, `MissingFieldDetectionService`, `LinkedTestExecutionService`, `DefectProjectGroupsService`.
- Prefers `has_linked_test_execution` when present; else `linked_issues` + history join.
- Tracker cache version-bumped on sync.

### DefectAnalyticsController (extra vs PRD §4.7)
- Inline edits write `parent`, `linked_issues`, `severity_issue`, `service_feature` to `bug_budget` after Jira API calls — cutover must cover these write paths.

### Leaderboard — `LeaderboardController.php`
- `issue_type` only; status keyword heuristics in PHP (not `is_open`).

### Performance — raw SQL
- Only §4.7 consumer that bypasses Eloquent — column renames break silently.
- May prefer `jira_table_history` when available; test both paths.

### Test Documentation
- **Misclassified in PRD §4.7** — no `bug_budget` reads. Remove from downstream list.

---

## Columns that must not drift

| Column / topic | Why |
|---|---|
| `is_open` | Analytics + Bug Budget open filters/summaries |
| `defect_age_days` | Business-day ages; AVG in analytics; filters in Bug Budget |
| `issue_type` | All §4.7 consumers except Bug Budget summary APIs |
| `final_issue_type` | Bug Budget open summary scopes only |
| JSON `labels`, `ac_related_labels`, `linked_issues` | Filters + tracker linked-test logic |
| `has_linked_test_execution` | Tracker no-test-execution tab |
| `reporter`, `created_date`, `jira_key` | Performance raw SQL |

---

## OQ-4: `GET /api/bug-budget/stats`

- Route exists (`BugBudgetController::apiStats`).
- **No callers** found (`route('api.bug_budget.stats')` / URL string = 0 outside definition).
- Dashboard uses server-rendered / AJAX summary HTML, not this endpoint.
- **Supports dropping** the stats API unless an out-of-repo client exists.

---

## Gaps / unknowns

1. Test Documentation should be removed from PRD §4.7 consumer table.
2. Defect Analytics cache invalidation may not match “flush on every sync.”
3. `final_issue_type` only used by Bug Budget summaries — still load-bearing for Momus parity.
4. Controller write-backs to `bug_budget` need a Momus story.
5. Performance history fallback can skip `bug_budget` — regression both paths.
6. No evidence of external (out-of-repo) `bug_budget` consumers.

---

## Migration checklist (from this inventory)

- [x] Preserve `is_open`, `defect_age_days`, `issue_type`, `final_issue_type` semantics (Momus contract + MIG-01/02)
- [x] Preserve JSON encodings for `labels`, `ac_related_labels`, `linked_issues`
- [x] Keep `has_linked_test_execution` or equivalent
- [x] Coordinate Performance path — **moved to another project** (not Momus Bug/Defect scope)
- [ ] Decide Defect Analytics cache flush vs TTL (when rebuilt)
- [ ] Drop or document `/api/bug-budget/stats` (OQ-4 → **drop** unless external client)
- [x] Remove Test Documentation from downstream list (not a `bug_budget` consumer)
- [ ] Include DefectAnalyticsController write paths in Analytics rebuild (Momus SoT)
- [x] BB-MIG-01/02 bulk copy + reconciliation
- [x] BB-MIG-03/04 settings + parallel-run diffs
- [ ] BB-MIG-05 downstream cutover (Momus only; QARATMS deleted after window)
- [ ] BB-MIG-06 30-day rollback then hard-delete QARATMS

**Dispositions (2026-07-12):** Analytics → rebuild 1st · Tracker → rebuild 2nd · Leaderboard → rebuild 3rd (new menu) · Performance → moved elsewhere · Test Documentation → N/A · OQ-4 stats → drop.

**Topology note (2026-07-12):** QARATMS and its database will be removed. Do **not** plan MySQL FDW/replica compatibility.
