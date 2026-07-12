# BB-MIG-05 — Downstream cutover (QARATMS deleted; Momus only)

**Prerequisite:** BB-MIG-01…04 complete (data copied, settings migrated, parallel-run diffs clean).  
**Topology:** QARATMS application **and** its MySQL database will be **deleted**. Momus is the sole system of record. **No** MySQL compatibility view, FDW, or dual-write.

**Inventory source:** [bb-data-08-consumer-inventory.md](./bb-data-08-consumer-inventory.md)

---

## Goal

Cut traffic and ownership to Momus in one coordinated release such that:

1. Bug Budget (sync, UI, settings, cron) runs **only** on Momus.
2. Every former §4.7 `bug_budget` consumer is **rebuilt in Momus**, **moved elsewhere**, or **explicitly retired** — none still depend on QARATMS MySQL.
3. QARATMS can be taken read-only (BB-MIG-06), then deleted after the rollback window.

---

## Consumer disposition matrix (DATA-08)

**Decided 2026-07-12** (Emile). Cutover blocked only while rebuilds below are incomplete (not while TBD).

| Consumer | Access today | Disposition | Rebuild order | Owner | Done |
|---|---|---|---|---|---|
| **Bug Budget** (module) | Owner of table + sync | **Momus (live)** | — | Momus | [x] |
| **Defect Analytics** | `BugBudget::query()` aggs | **Rebuild in Momus** | **1st** | Momus | [ ] |
| **Defect Analytics Controller write-backs** | Writes after Jira to `bug_budget` | **Rebuild with Analytics** (Momus SoT) | with #1 | Momus | [ ] |
| **Defect Tracker** | Eloquent filters/counts | **Rebuild in Momus** (own module/menu) | **2nd** | Momus | [ ] |
| **Leaderboard** | `BugBudget::query()` | **Rebuild in Momus** (new menu) | **3rd** | Momus | [ ] |
| **Performance** | `DB::table('bug_budget')` | **Moved elsewhere** (already split to another project) — not a Momus Bug/Defect deliverable | — | Other project | [x] |
| **Test Documentation** | Jira REST only | **N/A** — drop from §4.7 list | — | — | [x] |
| **`GET /api/bug-budget/stats` (OQ-4)** | No in-repo callers | **Drop** | — | Momus | [ ] |

### Rebuild sequence

1. **Defect Analytics** (+ write-backs) — first product epic after Phase 7 deploy  
2. **Defect Tracker** — own module/menu  
3. **Leaderboard** — new Momus menu item  

Performance is **out of scope** for Momus rebuild; that project owns its data dependency after QARATMS deletion.

---

## Pre-cutover go/no-go

All must be **PASS** before route flip:

| # | Check | How | Pass? |
|---|---|---|---|
| G1 | Data parity | `pnpm mig:reconcile` → `ok: true` | [ ] |
| G2 | Parallel-run diffs | `pnpm mig:diff -- --year=<Y>` clean for ≥1 sync cycle (prefer 1–2 weeks) | [ ] |
| G3 | Settings + Vault token | `pnpm mig:settings` done; Jira token re-entered; Test Connection OK | [ ] |
| G4 | Momus sync only | Cron/manual sync on Momus; QARATMS Bug Budget sync **disabled** | [ ] |
| G5 | Consumer matrix | Dispositions decided (2026-07-12); Analytics/Tracker/Leaderboard rebuilt or accepted deferred with no QARATMS dependency | [ ] |
| G6 | Column contract | No drift on `is_open`, `defect_age_days`, `issue_type`, `final_issue_type`, JSON labels/linked_issues, `has_linked_test_execution` | [ ] |
| G7 | Rollback ready | BB-MIG-06 plan signed; QARATMS image/DB snapshot retained | [ ] |

---

## Cutover procedure (Momus prevails)

1. **Freeze QARATMS Bug Budget writes** — disable sync job/cron and settings mutations that touch `bug_budget`.
2. **Final incremental sync on Momus** — same JQL as parallel run; confirm `mig:diff` still clean (or accept known deltas).
3. **Route flip** — DNS / reverse proxy / app entrypoint serve Momus Bug Budget (and any rebuilt consumers).
4. **Disable QARATMS public routes** for Bug Budget (and retired modules); keep app deployable read-only per MIG-06.
5. **Monitor 48h** — sync health (`/api/health`, `/api/health/worker`), error rates, one CSV export, open summaries.
6. **Do not delete** QARATMS app or MySQL until MIG-06 window ends.

### Explicit non-goals

- No Postgres→MySQL replication for leftover Laravel code.
- No long-lived “compatibility schema” on a dying database.
- No silent keep of Performance/`DB::table('bug_budget')` against deleted MySQL.

---

## Per-consumer verification (when rebuilt or moved)

Use DATA-08 columns as the regression list:

- **Defect Analytics** — trends/KPI cards; AC/label filters; confirm cache invalidation story (TTL vs flush-on-sync).
- **Defect Tracker** — tabs/filters; `has_linked_test_execution` path; missing-field detection.
- **Write-backs** — if kept, edits persist on Momus `bug_budget` (not a deleted MySQL row).
- **Leaderboard** — reporter aggregations; status heuristics if still used.
- **Performance** — both `bug_budget` and any history-table fallback paths.

---

## Exit criteria (BB-MIG-05)

- [ ] Go/no-go G1–G7 passed  
- [ ] Momus is only writer/reader SoT for Bug Budget data  
- [ ] Every former consumer is Momus / external / retired (documented)  
- [ ] QARATMS no longer serves Bug Budget traffic (read-only standby only)
