# Momus — History Log

Structured changelog documenting implementation progress, design decisions, completed features, pending work, and notable milestones throughout the project lifecycle.

---

## How to Use This Document

| Section | Purpose |
|---|---|
| **Changelog** | Reverse-chronological record of significant events |
| **Design Decisions** | Architectural and product choices with rationale |
| **Completed Features** | Checklist of delivered functionality |
| **Pending Work** | Outstanding tasks by phase |
| **Milestones** | Key dates and deliverable status |
| **Deviations from PRD** | Intentional changes from legacy behavior |

**Convention:** Add a new changelog entry at the top for every significant action — planning decisions, phase completions, blockers resolved, deployments, and sign-offs. Use ISO dates and link to PRD requirement IDs where applicable.

---

## Changelog

### 2026-07-12 — Supabase Auth (BB-PERM)

| Event | Details |
|---|---|
| **Auth** | Supabase `@supabase/ssr` cookie sessions; `/sign-in` (password + magic link/OTP toggle) |
| **Permissions** | `getSessionUser()` maps `auth_user_id` → `public.users` + `user_permissions` (BB-PERM-01/02/03) |
| **Users admin** | `/settings/users` invite/edit via service role (`manage_users`) |
| **Ops** | Bootstrap runbook: `docs/ops/supabase-auth-bootstrap.md` |
| **Dev bypass** | `MOMUS_DEV_AUTH_BYPASS` local/Vitest only — not Vercel production |

### 2026-07-11 — Atlassian Settings UI

| Event | Details |
|---|---|
| **Route** | `/settings/atlassian` with tabs Shared / Jira / Confluence / Bug Budget |
| **Wired** | Shared credentials + Bug Budget (connection, JQL sync, multipliers, budgets, cron, activity) |
| **Stubs** | Confluence form (not persisted); Jira extra fields (default project/cache) UI-only |
| **APIs added** | `GET .../config`, `GET .../sync-activity` |

### 2026-07-11 — Phase 3 API & Data Access (core)

| Event | Details |
|---|---|
| **Auth** | `requirePermission` / `requireViewAnalytics` (BB-PERM-01 stub) |
| **Query repo** | `BugBudgetQueryRepository` + `loadSummaryConfig` |
| **Summaries** | `GET /api/bug-budget/open-bug-summary`, `open-defect-summary` (BB-API-05) |
| **Dashboard** | `GET /api/bug-budget` — filters + stats + pagination (BB-API-03/04) |
| **Detail** | `GET /api/bug-budget/[id]` |
| **CSV** | `GET /api/bug-budget/export/csv` + `/bug-budget/export/csv` — D-1 fixed (19 aligned cols + computed cost) |
| **Tests** | Domain 33 (incl. CSV); infra 17; typecheck green |
| **Deferred** | Cache TTLs (BB-CACHE-01), SQL-side filtering for large datasets |

### 2026-07-11 — Save-connection API

| Event | Details |
|---|---|
| **Routes** | `GET\|POST /api/settings/bug-budget/save-connection` (+ alias `/connection`) |
| **Behavior** | Persists `jira_url` / `jira_username` / `jira_api_token` / `jira_enabled`; masked token keeps stored secret (BB-NFR-04) |
| **Tests** | `parseJiraConnectionBody` / `toPublicJiraConnection` (6 cases) |

### 2026-07-11 — Phase 2 Sync Hardening (per-page + inline)

| Event | Details |
|---|---|
| **Per-page Inngest steps** | `syncOnePage` / `runOrphanCleanup` extracted; job runs one durable step per Jira page |
| **BB-SYNC-07** | Non-prod inline sync via `after()` when `INNGEST_EVENT_KEY` unset (`shouldRunInlineSync`) |
| **Shared runner** | `executeBugBudgetSyncRun` used by Inngest + inline paths |
| **Legacy alias** | `POST .../sync-with-database` → sync-with-progress |
| **Tests** | 11 infra Vitest tests (orchestrator + inline policy) |
| **E2E blocker** | Momus DB still has `jira_enabled=false` and empty username/token — live sync pending credentials |
| **Status** | 🟡 Phase 2 code complete; sandbox E2E awaits Jira settings |

### 2026-07-11 — Phase 2 Jira Client + Sync Wiring

| Event | Details |
|---|---|
| **Jira client** | `@momus/infra` REST v3: search/jql, approximate-count, myself, 429 Retry-After (BB-SYNC-01) |
| **Orchestrator** | `runBugBudgetSync` — upsert, progress, orphan cleanup guards (date filter + BB-EDGE-10 cap), per-issue errors (BB-SYNC-05); 6 Vitest tests |
| **Repos** | `SyncRunRepository`, `BugBudgetRepository`, cache version bump, config (multipliers/projects/cron) |
| **Inngest** | `bug-budget/sync` job + stuck-run sweeper cron; `/api/inngest` serve route (BB-SYNC-06, BB-NFR-05) |
| **Settings API** | test-connection, get-issue-count, fetch-from-jira, sync-with-progress (409), sync-status, save-multipliers, save-project-settings, cron-schedule (BB-API-06) |
| **Auth** | Dev stub via `MOMUS_DEV_AUTH_BYPASS` + seeded `admin@momus.local` (full auth Phase 3) |
| **Deferred** | DEV-9 Vault encryption; per-page Inngest steps; BB-SCHED-01 tick (Phase 5) |
| **Status** | 🟡 Phase 2 core wiring done; live Jira sandbox E2E still needed for exit criteria |

### 2026-07-11 — Phase 1 Domain Logic Complete

| Event | Details |
|---|---|
| **Package** | `@momus/domain` — cost, budget status, summary, age, transform, JQL, filters, stats, badges |
| **Golden fixtures** | Appendix A.1 / A.2 / A.3 all green (30 Vitest tests) |
| **OQ-1** | Default JQL uses rolling calendar year at runtime (`buildDefaultJql`) |
| **Status** | 🟢 Phase 1 exit criteria met for domain package |

### 2026-07-11 — Remote Supabase Migrations Applied

| Event | Details |
|---|---|
| **Target project** | `performance` (`puwugzzvxvatgjhpdagy`, ap-northeast-2, ACTIVE) |
| **Migrations applied** | `momus_initial_schema`, `momus_rls_policies`, `momus_seed_data` |
| **Adaptations** | Skipped `users`, `settings`, `audit_logs` (pre-existing). `requested_by` uses INTEGER FK to existing `users.id`. |
| **Seed verified** | 6 config rows, 1 cron schedule, 12 Jira field mappings, 8 QA names, 6 holidays |
| **Status** | 🟢 Remote database ready for Momus development |

### 2026-07-11 — Phase 0 Foundation (Database + Framework)

| Event | Details |
|---|---|
| **Monorepo scaffolded** | Turborepo + pnpm workspaces with `apps/web`, `packages/{shared,domain,infra,jobs}`. |
| **Next.js 15 app** | App Router with `/`, `/bug-budget` placeholder, `/api/health` endpoint. Build verified green. |
| **Supabase migrations** | 3 migrations: initial schema (11 tables), RLS policies, seed data (multipliers, mappings, holidays). |
| **Docker** | `docker/docker-compose.yml` for web + Inngest dev; Supabase via CLI. |
| **CI** | GitHub Actions workflow for typecheck + build. |
| **Status** | 🟢 Phase 0 scaffold complete — run `supabase start` + `pnpm db:reset` locally to apply migrations. |

### 2026-07-11 — Project Initialization & Planning

| Event | Details |
|---|---|
| **PRD ingested** | Analyzed `prd.md` v1.1 (Bug Budget module reverse-engineered spec). 1,060 lines covering data model, business rules, API, UI, migration, and golden fixtures. |
| **Planning artifacts created** | `plan.md` (implementation roadmap), `history-log.md` (this document), `conventions.md` (JS development standards), `.cursor/rules/` (agent conventions). |
| **Stack selected** | Next.js 15 + TypeScript on Vercel; Supabase PostgreSQL + Vault; Inngest for background sync jobs; Turborepo monorepo; Docker Compose for local dev. |
| **Architecture decided** | Monorepo with `apps/web`, `packages/domain`, `packages/infra`, `packages/jobs`. Business logic isolated in pure TypeScript packages. Sync via Inngest step functions (one Jira page per step). |
| **Phase plan defined** | 8 phases (0–7) over ~11 weeks: Foundation → Domain → Sync → API → UI → Ops → Migration → Production. |
| **Open questions logged** | OQ-1 through OQ-6 from PRD §16.3 pending owner sign-off before Phase 2. |
| **Deviations catalogued** | DEV-1 through DEV-10 from PRD §16.2 flagged for sign-off; all marked as accepted recommendations in plan. |
| **Status** | 🟡 Planning complete — awaiting open question sign-off and Phase 0 kickoff. |

---

## Design Decisions

### DD-001: JavaScript/TypeScript Stack (2026-07-11)

**Decision:** Rebuild on TypeScript with Next.js App Router instead of retaining PHP/Laravel.

**Rationale:** User requirement for Vercel deployment, Supabase integration, and modern maintainability. TypeScript provides type safety for the 83-column `bug_budget` schema and complex business rules.

**Alternatives considered:** Node.js + Express (rejected — no SSR benefit); Remix (rejected — smaller Vercel ecosystem).

---

### DD-002: Inngest for Background Jobs (2026-07-11)

**Decision:** Use Inngest for Jira sync orchestration and scheduler tick.

**Rationale:** Vercel serverless functions cap at 300s (Pro). Legacy sync runs up to 1200s with pagination. Inngest supports step functions (one step per Jira page), retries with backoff, concurrency controls, and cron — all Vercel-native.

**Alternatives considered:** Vercel Cron + chunked API routes (rejected — complex state management); separate Railway/Fly.io worker (rejected — adds deployment surface); Supabase Edge Functions (rejected — 150s timeout).

**PRD reference:** BB-SYNC-06, BB-SCHED-01/02, BB-SYNC-09.

---

### DD-003: Supabase as Primary Database (2026-07-11)

**Decision:** Supabase PostgreSQL for all persistent storage including `bug_budget`, settings, and audit logs.

**Rationale:** User requirement. Managed Postgres with migration tooling, RLS for permissions, Vault for encrypted Jira token storage (DEV-9, BB-NFR-04). Table name and column contract preserved for downstream consumers (BB-DATA-07).

**Alternatives considered:** PlanetScale (rejected — no JSON column parity); raw PostgreSQL on RDS (rejected — more ops overhead).

---

### DD-004: DB-Backed Configuration (2026-07-11)

**Decision:** Store multipliers, project budgets, mappings, and exclusions in `bug_budget_config` table instead of PHP config files.

**Rationale:** PRD DEV-1 recommendation. Enables atomic writes, audit logging (DEV-10), and eliminates config cache clear pattern.

**PRD reference:** §4.5C, DEV-1, BB-MIG-03.

---

### DD-005: Structured Scope Settings (2026-07-11)

**Decision:** Replace JQL regex parsing for default issue types and excluded projects with structured settings arrays. JQL generated from settings, not parsed from JQL.

**Rationale:** PRD DEV-2 recommendation. Eliminates fragile inverse dependency where dashboard scope is derived by regex-parsing the JQL string (BB-SCOPE-02).

**PRD reference:** DEV-2, DEV-6, DEV-7.

---

### DD-006: Tailwind + shadcn/ui over Bootstrap 5 (2026-07-11)

**Decision:** Use Tailwind CSS with shadcn/ui components while reproducing Bootstrap 5 design tokens (§9.6 hex values).

**Rationale:** Modern React component ecosystem. Bootstrap 5 JS bundle not needed. Design token table ensures visual parity.

**PRD reference:** BB-UI-12.

---

### DD-007: Turborepo Monorepo (2026-07-11)

**Decision:** pnpm workspaces + Turborepo with shared packages.

**Rationale:** Business logic (`packages/domain`) must be testable independently of Next.js and shareable with Inngest job functions. Monorepo enables atomic cross-package changes.

---

### DD-008: Rolling Calendar Year for Default JQL (2026-07-11, Pending Sign-Off)

**Decision (recommended):** Default JQL `created` scope uses current calendar year computed at runtime.

**Rationale:** PRD OQ-1. Hardcoded `2026-01-01` to `2026-12-31` goes stale every January 1. Evidence from legacy source suggests manual annual bump.

**Status:** ⏳ Pending Emile sign-off.

---

## Completed Features

| Feature | Phase | Date | PRD Refs |
|---|---|---|---|
| Turborepo monorepo scaffold | 0 | 2026-07-11 | plan.md §3 |
| Next.js 15 web app (placeholder pages) | 0 | 2026-07-11 | BB-UI-02 scaffold |
| Supabase schema migrations (11 tables) | 0 | 2026-07-11 | BB-DATA-01–05, DEV-1/3/4/5 |
| RLS policies + permission helper | 0 | 2026-07-11 | BB-PERM-01 |
| Seed data (multipliers, mappings, holidays) | 0 | 2026-07-11 | §4.5C, Appendix A prep |
| Docker Compose (web + Inngest) | 0 | 2026-07-11 | plan.md §9 |
| CI pipeline (GitHub Actions) | 0 | 2026-07-11 | plan.md Phase 0 |
| PRD analysis | — | 2026-07-11 | Full document |
| Implementation plan | — | 2026-07-11 | §15 traceability |
| Development conventions | — | 2026-07-11 | — |
| Cursor agent rules | — | 2026-07-11 | — |

---

## Pending Work

### Phase 0 — Foundation

- [x] Initialize Turborepo monorepo (pnpm workspaces)
- [x] Configure TypeScript strict mode, Prettier
- [ ] Configure ESLint, Husky pre-commit
- [x] Supabase migrations for all tables
- [x] Docker Compose local environment
- [x] CI pipeline (GitHub Actions)
- [ ] Seed golden fixture data (Appendix A test rows)
- [x] Apply migrations locally (`supabase start` + `db:reset`)
- [x] Apply migrations to remote Supabase (`performance` project)

### Phase 1 — Domain Logic

- [ ] Cost calculator (BB-CALC-01)
- [ ] Budget calculator (BB-CALC-02/03/04)
- [ ] Open/closed logic (BB-CALC-05)
- [ ] Business-day age calculator (BB-CALC-06/07)
- [ ] Jira issue transform (BB-SYNC-04)
- [ ] JQL builders (BB-SCOPE-01/02/03)
- [ ] Filter builder (BB-API-03)
- [ ] Stats + summary builders (BB-API-04/05)
- [ ] Golden fixture tests (Appendix A)

### Phase 2 — Jira Integration & Sync

- [x] Encrypted credential storage (DEV-9) — deferred; settings store plaintext + mask in UI
- [x] Sync orchestrator (BB-SYNC-05) + Vitest
- [x] Inngest job functions (BB-SYNC-06) + stuck-run sweeper (BB-NFR-05) + per-page steps
- [x] Inline sync non-prod (BB-SYNC-07)
- [x] Concurrency guard 409 (BB-SYNC-09)
- [x] Settings API routes (BB-API-06 core)
- [x] Sync-run / bug_budget repositories + cache version bump
- [ ] Live Jira sandbox E2E (blocked: credentials not in `settings`)

### Phase 3 — API & Data Access

- [ ] Dashboard data endpoint with filters
- [ ] Summary endpoints (BB-API-02)
- [ ] CSV export with computed cost (D-1 fix)
- [ ] Cache layer (BB-CACHE-01)
- [ ] Permission middleware (BB-PERM-01/02)

### Phase 4 — Frontend UI

- [ ] Dashboard page (BB-UI-02–06)
- [ ] Summary modals (BB-UI-07)
- [ ] Detail page (BB-UI-08)
- [ ] Settings tab (BB-UI-09)
- [ ] Message catalog (Appendix B)

### Phase 5 — Scheduling & Operations

- [ ] Inngest cron scheduler (BB-SCHED-01/02)
- [ ] Sync-run retention (BB-LIFE-02)
- [ ] Audit logging (DEV-10)
- [ ] Health checks + structured logging

### Phase 6 — Migration & Validation

- [ ] Data migration scripts (BB-MIG-01)
- [ ] Reconciliation checks (BB-MIG-02)
- [ ] Downstream consumer inventory (BB-DATA-08)
- [ ] Parallel run validation (BB-MIG-04)
- [ ] Acceptance criteria AC-1–AC-10

### Phase 7 — Production Deployment

- [ ] Vercel + Supabase production setup
- [ ] Performance validation (BB-NFR-02)
- [ ] Security review (BB-NFR-04)
- [ ] DNS cutover

### Sign-Offs Required

- [ ] OQ-1: Rolling calendar year for default JQL (Emile)
- [ ] OQ-2: Multiplier retroactive repricing (Emile + QA lead)
- [ ] OQ-3: Keep internal detail page (Emile)
- [ ] OQ-4: Drop unused stats API (Emile, after BB-DATA-08 inventory)
- [ ] OQ-6: Budget legend granularity (QA lead)
- [ ] DEV-1 through DEV-10: Recommended deviations (Emile / QA lead)

---

## Milestones

| ID | Name | Target | Status | Notes |
|---|---|---|---|---|
| M0 | Scaffold | Week 2 | ✅ Done | Monorepo + Momus Supabase project |
| M1 | Domain Parity | Week 3 | ✅ Done | Appendix A fixtures green (30 tests) |
| M2 | Sync Pipeline | Week 5 | 🟡 In progress | Jira client + orchestrator + Inngest + settings API wired |
| M3 | API Complete | Week 5 | 🟡 In progress | Summaries + dashboard + CSV done; cache pending |
| M4 | UI Parity | Week 7 | ⬜ Not started | QA visual review |
| M5 | Ops Ready | Week 8 | ⬜ Not started | Scheduler + audit |
| M6 | Migration Validated | Week 10 | ⬜ Not started | Parallel run clean |
| M7 | Production | Week 11 | ⬜ Not started | Live on Vercel |

---

## Deviations from PRD (Intentional)

These are planned improvements over legacy behavior, per PRD §16.1 (defects to fix) and §16.2 (recommended deviations).

| ID | Legacy Behavior | Momus Behavior | PRD Ref |
|---|---|---|---|
| D-1 | CSV exports null `bug_cost` with misaligned headers | Export computed cost; aligned headers | §16.1 |
| D-2 | Duplicate/case-variant project budget keys | Normalized keys; typo fixed | §16.1 |
| D-3 | Three conflicting multiplier defaults | Single source of truth in DB | §16.1 |
| D-4 | Legacy `bug_budget_settings` table | Dropped; uses `settings` + `bug_budget_config` | §16.1 |
| D-5 | Capped sync could delete rows beyond cap | Skip cleanup when fetch truncated | §16.1 |
| D-6 | Different age-badge scales (list vs detail) | Standardized on list scale (>60/>20/>5) | §16.1 |
| DEV-1 | PHP config file writes | Transactional DB writes | §16.2 |
| DEV-2 | JQL regex parsing for scope | Structured settings → generated JQL | §16.2 |
| DEV-3 | Hardcoded 2024–2025 holidays | Data-driven `indonesian_holidays` table | §16.2 |
| DEV-4 | Hardcoded QA-checker names | Configurable `qa_checker_names` | §16.2 |
| DEV-5 | Hardcoded Jira custom field IDs | `jira_field_mappings` settings | §16.2 |
| DEV-8 | No sync concurrency guard | 409 on active run | §16.2 |
| DEV-9 | Plaintext API token in settings | Supabase Vault encryption | §16.2 |
| DEV-10 | No settings audit trail | `audit_logs` entries | §16.2 |

---

## Blockers & Risks Log

| Date | Blocker | Impact | Resolution | Status |
|---|---|---|---|---|
| 2026-07-11 | OQ-1 through OQ-6 unsigned | Blocks Phase 2 JQL implementation | Schedule sign-off meeting with Emile + QA lead | 🔴 Open |
| 2026-07-11 | Auth integration with parent QARATMS undefined | Blocks permission middleware | Spike in Phase 0; clarify JWT/session contract | 🟡 Open |
| 2026-07-11 | Downstream consumer inventory not started | Blocks migration cutover | BB-DATA-08 grep inventory in Phase 6 | 🟡 Planned |

---

*History log version: 1.0 — 2026-07-11*
*Maintained by: Momus development team*
*Update frequency: On every significant project event*
