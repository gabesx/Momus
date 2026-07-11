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
| PRD analysis | — | 2026-07-11 | Full document |
| Implementation plan | — | 2026-07-11 | §15 traceability |
| Development conventions | — | 2026-07-11 | — |
| Cursor agent rules | — | 2026-07-11 | — |

*No application code implemented yet.*

---

## Pending Work

### Phase 0 — Foundation

- [ ] Initialize Turborepo monorepo (pnpm workspaces)
- [ ] TypeScript, ESLint, Prettier, Husky configuration
- [ ] Supabase migrations for all tables
- [ ] Docker Compose local environment
- [ ] CI pipeline (GitHub Actions)
- [ ] Seed golden fixture data

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

- [ ] Jira REST v3 client (BB-SYNC-01)
- [ ] Encrypted credential storage (DEV-9)
- [ ] Sync orchestrator (BB-SYNC-05)
- [ ] Inngest job functions (BB-SYNC-06)
- [ ] Concurrency guard 409 (BB-SYNC-09)
- [ ] Settings API routes (BB-API-06)

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
| M0 | Scaffold | Week 2 | ⬜ Not started | Monorepo + schema + Docker |
| M1 | Domain Parity | Week 3 | ⬜ Not started | Appendix A fixtures green |
| M2 | Sync Pipeline | Week 5 | ⬜ Not started | Jira sync end-to-end |
| M3 | API Complete | Week 5 | ⬜ Not started | All §8 endpoints |
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
