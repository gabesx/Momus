# Momus — JavaScript Development Conventions

Development rules and conventions for the Momus Bug Budget module. All contributors and AI agents must follow these standards.

**Stack:** TypeScript, Next.js 15 (App Router), Supabase, Inngest, Turborepo, Vitest, Playwright.

---

## 1. Project Architecture & Folder Structure

### 1.1 Monorepo Layout

```
apps/web/          → Next.js app (UI + API routes) — deployable to Vercel
packages/domain/   → Pure business logic (no I/O, no framework imports)
packages/infra/    → External integrations (Supabase, Jira, cache, crypto)
packages/jobs/     → Inngest background job definitions
packages/shared/   → Types, Zod schemas, constants, message catalog
supabase/          → Migrations, seeds, config
tests/             → Unit, integration, e2e (may mirror package structure)
```

### 1.2 Dependency Rules

| Package | May Import | Must NOT Import |
|---|---|---|
| `domain` | `shared` | `infra`, `jobs`, `web`, Next.js, Supabase client |
| `infra` | `shared`, `domain` | `web`, React |
| `jobs` | `shared`, `domain`, `infra` | `web`, React |
| `web` | All packages | — |

**Rationale:** `packages/domain` must remain pure so business rules (BB-CALC, BB-SYNC-04) are testable without mocking databases or HTTP.

### 1.3 File Naming

| Type | Convention | Example |
|---|---|---|
| React components | PascalCase `.tsx` | `StatCard.tsx` |
| Hooks | camelCase with `use` prefix | `useBugBudgetFilters.ts` |
| Utilities | camelCase `.ts` | `formatBusinessDays.ts` |
| API routes | `route.ts` in App Router convention | `app/api/bug-budget/route.ts` |
| Repositories | camelCase with `.repository.ts` suffix | `bugBudget.repository.ts` |
| Services | camelCase with `.service.ts` suffix | `syncOrchestrator.service.ts` |
| Types | PascalCase in `types/` or co-located | `BugBudgetRow.ts` |
| Tests | Same name with `.test.ts` or `.spec.ts` | `calculateCost.test.ts` |
| Constants | SCREAMING_SNAKE_CASE exports | `PRIORITY_MULTIPLIERS` |

### 1.4 Module Boundaries

- One clear responsibility per file. Target < 300 lines; split if exceeded.
- Colocate component-specific hooks and types with the component.
- Shared domain logic never lives in `apps/web` — extract to `packages/domain`.
- API route handlers are thin: validate input → call service → return response. No business logic in route files.

---

## 2. Coding Standards & Naming Conventions

### 2.1 TypeScript

- **Strict mode** enabled (`strict: true` in `tsconfig.json`).
- **No `any`** — use `unknown` and narrow, or define proper types. Exception: Jira `raw_jira_data` parsed fields.
- **Prefer `interface`** for object shapes; `type` for unions, intersections, and mapped types.
- **Explicit return types** on all exported functions in `packages/domain` and `packages/infra`.
- **Zod schemas** for all API request/response validation and environment variables.
- **Enums:** Use `as const` objects, not TypeScript `enum` keyword:

```typescript
// ✅ GOOD
export const SYNC_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

// ❌ BAD
export enum SyncStatus { Queued, Running, Completed, Failed }
```

### 2.2 Naming

| Entity | Convention | Example |
|---|---|---|
| Variables / functions | camelCase | `remainingBudget`, `calculateCost()` |
| Classes | PascalCase | `JiraClient`, `SyncOrchestrator` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_BUDGET`, `MAX_BATCH_SIZE` |
| Database columns | snake_case (match PRD schema) | `jira_key`, `defect_age_days` |
| API routes | kebab-case | `/api/bug-budget/open-bug-summary` |
| React components | PascalCase | `<StatCard />` |
| CSS/Tailwind | Tailwind utility classes; custom tokens in `tailwind.config` | `text-bb-danger` |
| Environment variables | SCREAMING_SNAKE_CASE | `SUPABASE_SERVICE_ROLE_KEY` |

### 2.3 Database Column Mapping

TypeScript types use camelCase; Supabase queries map to snake_case columns:

```typescript
// packages/shared/types/bug-budget.ts
export interface BugBudgetRow {
  jiraKey: string;
  defectAgeDays: number | null;
  isOpen: boolean;
}

// packages/infra/supabase/bugBudget.repository.ts
function toRow(db: DbBugBudget): BugBudgetRow {
  return {
    jiraKey: db.jira_key,
    defectAgeDays: db.defect_age_days,
    isOpen: db.is_open,
  };
}
```

### 2.4 Imports

- Use path aliases defined in `tsconfig.json` (`@momus/domain`, `@momus/infra`, etc.).
- Order: external packages → internal packages → relative imports.
- No default exports except Next.js pages and route handlers. Use named exports everywhere else.

### 2.5 Comments

- Code should be self-explanatory. Comment only non-obvious business rules.
- Reference PRD requirement IDs for business logic: `// BB-CALC-01: cost = priority × severity`.
- Do not add comments that narrate what the code does.

---

## 3. Error Handling & Logging

### 3.1 Error Hierarchy

```typescript
// packages/shared/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError { /* 422 */ }
export class NotFoundError extends AppError { /* 404 */ }
export class ForbiddenError extends AppError { /* 403 */ }
export class ConflictError extends AppError { /* 409 — BB-SYNC-09 */ }
export class JiraIntegrationError extends AppError { /* 400/500 */ }
```

### 3.2 API Error Responses

Standardize on BB-API-01 format:

```typescript
// Validation (422)
{ "message": "Validation failed", "errors": { "jql": ["JQL must not exceed 2000 characters"] } }

// Business failure (400/500)
{ "success": false, "message": "Jira connection failed: invalid credentials" }

// Conflict (409)
{ "success": false, "message": "A sync is already in progress", "syncRunId": 42 }
```

### 3.3 Error Handling Rules

- **Never swallow errors** — catch only to add context, then re-throw or return structured error.
- **Domain layer** throws typed errors; never returns `{ success: false }`.
- **API routes** catch `AppError` subclasses and map to HTTP status codes.
- **Sync jobs** collect per-issue transform errors without aborting the run (BB-SYNC-05).
- **Jira 429** — honor `Retry-After` header before retry (BB-EDGE-08).

### 3.4 Logging

Use structured JSON logging via a shared logger:

```typescript
import { logger } from '@momus/infra/logging';

logger.info('sync.started', { syncRunId, jql, requestedBy });
logger.error('sync.issue_transform_failed', { jiraKey, error: err.message });
logger.info('sync.completed', { syncRunId, totalProcessed, newIssues, updatedIssues });
```

| Event | Level | Required Fields |
|---|---|---|
| Sync start/end | `info` | `syncRunId`, `jql`, `requestedBy` |
| Per-issue transform error | `warn` | `jiraKey`, `error` |
| Orphan cleanup deletion | `info` | `deletedKeys[]`, `count` |
| Settings change | `info` | `userId`, `setting`, `action` |
| Jira 429 | `warn` | `retryAfter`, `jql` |
| Stuck run swept | `warn` | `syncRunId`, `startedAt` |

- **Never log** Jira API tokens, passwords, or full `raw_jira_data` in production logs.
- **Mask tokens** in all UI and API responses (`****************`).

---

## 4. API Design Guidelines

### 4.1 Route Structure

```
GET    /bug-budget                          → Dashboard page (SSR)
GET    /bug-budget/{id}                     → Detail page
GET    /bug-budget/export/csv               → CSV export (register BEFORE /{id})
GET    /api/bug-budget/open-bug-summary     → JSON summary
GET    /api/bug-budget/open-defect-summary  → JSON summary
POST   /api/settings/bug-budget/sync-with-progress  → Queue sync
GET    /api/settings/bug-budget/sync-status/{id}    → Poll progress
```

### 4.2 Route Handler Pattern

```typescript
// apps/web/app/api/bug-budget/open-bug-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { openBugSummaryQuerySchema } from '@momus/shared/schemas';
import { getOpenBugSummary } from '@momus/domain/budget';

export async function GET(request: NextRequest) {
  const user = await requirePermission('view_analytics');
  const params = openBugSummaryQuerySchema.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const result = await getOpenBugSummary(params);
  return NextResponse.json({ success: true, projects: result });
}
```

### 4.3 API Conventions

- **Validation:** Zod parse at the route boundary; never pass raw `request.json()` deeper.
- **Permissions:** Check at route entry via `requirePermission()` (BB-PERM-01).
- **Idempotency:** Sync upserts on `jira_key` — safe to retry.
- **Pagination:** `page`, `per_page` (25/50/100); `all` capped to 100 with M-03 notice.
- **CSV export:** Stream response; do not buffer entire dataset in memory.
- **AJAX dashboard:** Support `X-Requested-With: XMLHttpRequest` for partial HTML (BB-API-02) or migrate to JSON API with client rendering.
- **Response times:** Summary endpoints must hit cache (BB-CACHE-01); target < 200ms on cache hit.

### 4.4 JQL Safety

- JQL is passed to Jira API, **never interpolated into SQL**.
- Max length: 2000 characters.
- Treat all JQL as untrusted input (BB-NFR-04).

---

## 5. Database Access Patterns

### 5.1 Repository Pattern

All database access goes through typed repositories in `packages/infra/supabase/`:

```typescript
// packages/infra/supabase/bugBudget.repository.ts
export class BugBudgetRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsert(row: BugBudgetInsert): Promise<UpsertResult> { /* ... */ }
  async findByFilters(filters: BugBudgetFilters): Promise<PaginatedResult<BugBudgetRow>> { /* ... */ }
  async deleteByKeys(keys: string[]): Promise<number> { /* ... */ }
}
```

- **No raw SQL in route handlers or domain layer.**
- **Upsert key:** `jira_key` (BB-DATA-01).
- **Transactions:** Use Supabase RPC or sequential operations with explicit error handling for multi-table writes (settings save).

### 5.2 Query Conventions

- Use Supabase query builder for simple queries; RPC functions for complex aggregations (summary endpoints).
- Always specify columns — never `SELECT *` in production queries.
- Filter builders in `packages/domain/filters` produce typed filter objects; repositories translate to SQL.
- Index-aware queries: filter on indexed columns (`created_year`, `quarter`, `created_date`, `is_open`).

### 5.3 Migrations

- All schema changes via `supabase/migrations/` SQL files.
- Naming: `YYYYMMDDHHMMSS_description.sql`.
- Never modify a migration after it has been applied to any shared environment.
- Include indexes defined in BB-DATA-02.
- Seed data for golden fixtures in `supabase/seed/`.

### 5.4 JSON Columns

Columns storing JSON arrays (`labels`, `linked_issues`, `ac_related_labels`, `components`, `fix_versions`) must use consistent encoding:

```typescript
// Store
const labels = JSON.stringify(['ac-related', 'sprint-42']);

// Query (ac_related filter — BB-API-03)
// Use Supabase JSON containment: .contains('ac_related_labels', '["ac-related"]')
```

---

## 6. Testing Requirements

### 6.1 Test Pyramid

| Level | Tool | Location | When Required |
|---|---|---|---|
| Unit | Vitest | `packages/domain/**/*.test.ts` | Every domain function |
| Integration | Vitest | `tests/integration/` | API routes, repositories, sync |
| Golden fixtures | Vitest | `tests/fixtures/` | Appendix A (normative) |
| E2E | Playwright | `tests/e2e/` | Critical user flows |

### 6.2 TDD for Domain Logic

All `packages/domain` code follows test-first development:

1. Write failing test referencing PRD requirement ID.
2. Run test — confirm failure.
3. Implement minimal code.
4. Run test — confirm pass.
5. Commit.

### 6.3 Golden Fixtures (Normative)

Appendix A fixtures are **acceptance tests**, not optional:

```typescript
// tests/fixtures/transform-a1.test.ts
describe('BB-SYNC-04: Transform fixture A.1', () => {
  it('transforms AO-102 Jira issue to expected bug_budget row', () => {
    const result = transformJiraIssue(A1_INPUT);
    expect(result.jira_key).toBe('AO-102');
    expect(result.defect_age_days).toBe(5);
    expect(result.is_open).toBe(false);
    // ... all columns from Appendix A.1 table
  });
});
```

### 6.4 Test Conventions

- Test descriptions include PRD IDs: `'BB-CALC-01: returns cost 150 for Highest + Critical'`.
- Use factory functions for test data (`createBugBudgetRow(overrides)`).
- Mock external services (Jira, Supabase) at the infra boundary, never in domain tests.
- Integration tests use Supabase local (Docker).
- Minimum coverage: 100% on `packages/domain`; 80% on `packages/infra` and API routes.

### 6.5 E2E Critical Flows

- Dashboard load with default filters
- Filter application + URL pushState
- CSV export download
- Settings: test connection → sync with progress → poll completion
- Summary modal open + year change
- Permission denial (403) for unauthorized user

---

## 7. Security Best Practices

### 7.1 Authentication & Authorization

- All routes require authenticated, non-candidate user (BB-PERM-01).
- Permission checks via middleware before any data access.
- Sync-status polling: 403 unless requester owns the run or has `manage_users` (BB-PERM-02).
- Use Supabase RLS as defense-in-depth; primary enforcement in application layer.

### 7.2 Secret Management

| Secret | Storage | Access |
|---|---|---|
| Jira API token | Supabase Vault (encrypted) | Server-side only; masked in UI |
| Supabase service role key | Vercel env var | Server-side only |
| Inngest signing key | Vercel env var | Webhook verification only |

- **Never** commit secrets to git.
- **Never** expose service role key to client.
- **Never** return unmasked tokens in API responses.

### 7.3 Input Validation

- Zod schemas validate all API inputs at the route boundary.
- JQL max 2000 chars; batch_size 1–5000; multiplier values 0.1–1000.
- SQL injection prevented by parameterized queries (Supabase client).
- XSS prevented by React's default escaping; sanitize only if rendering HTML from Jira descriptions.

### 7.4 CSRF & State-Changing Endpoints

- All `POST` endpoints require CSRF token or SameSite cookie auth.
- Inngest webhook verified via signing key.

### 7.5 Personal Data (BB-LIFE-04)

- `assignee`, `reporter`, `creator`, `qa_checker`, `tested_by`, `owner` contain Jira display names.
- `raw_jira_data` contains account IDs, avatars, descriptions.
- Do not ship to third-party analytics.
- Include in data-subject deletion process.

---

## 8. Git Workflow & Commit Conventions

### 8.1 Branching

| Branch | Purpose |
|---|---|
| `main` | Production-ready; protected |
| `develop` | Integration branch |
| `feat/<name>` | Feature branches |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Tooling, deps, config |

### 8.2 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer: PRD refs, breaking changes]
```

| Type | Usage |
|---|---|
| `feat` | New feature or requirement implementation |
| `fix` | Bug fix (include D-* ID if fixing known defect) |
| `test` | Adding or updating tests |
| `refactor` | Code change without behavior change |
| `chore` | Build, deps, config |
| `docs` | Documentation only |

**Examples:**

```
feat(domain): implement BB-CALC-01 cost calculator
fix(export): align CSV headers and export computed cost (D-1)
test(fixtures): add Appendix A.2 summary golden fixture
feat(sync): add 409 concurrency guard (BB-SYNC-09)
```

### 8.3 Pull Request Rules

- One concern per PR; keep diffs reviewable (< 500 lines preferred).
- PR title follows commit convention.
- PR description includes: summary, PRD requirement IDs addressed, test plan.
- All CI checks must pass before merge.
- Golden fixture tests must not be weakened to make CI pass.

### 8.4 Pre-Commit Hooks (Husky)

- ESLint (no warnings)
- Prettier format check
- TypeScript type check (`tsc --noEmit`)
- Unit tests for changed `packages/domain` files

---

## 9. UI Development Conventions

### 9.1 Component Structure

```typescript
// components/bug-budget/StatCard.tsx
interface StatCardProps {
  label: string;
  value: number;
  meta?: string;
  accent: 'primary' | 'danger' | 'success' | 'info' | 'critical';
  onClick?: () => void;
}

export function StatCard({ label, value, meta, accent, onClick }: StatCardProps) {
  // ...
}
```

- Functional components only.
- Props interface defined above component.
- Extract hooks for stateful logic (`useBugBudgetFilters`, `useSyncPolling`).

### 9.2 Design Tokens (BB-UI-12)

Use Tailwind custom colors matching Bootstrap 5 hex values:

| Token | Hex | Tailwind Class |
|---|---|---|
| primary | `#0d6efd` | `text-bb-primary` / `bg-bb-primary` |
| danger | `#dc3545` | `text-bb-danger` / `bg-bb-danger` |
| success | `#198754` | `text-bb-success` / `bg-bb-success` |
| warning | `#ffc107` | `text-bb-warning` / `bg-bb-warning` |
| info | `#0dcaf0` | `text-bb-info` / `bg-bb-info` |
| dark | `#212529` | `text-bb-dark` / `bg-bb-dark` |

### 9.3 Message Catalog

All user-facing strings from PRD Appendix B. Import from `@momus/shared/messages`:

```typescript
import { MESSAGES } from '@momus/shared/messages';
// MESSAGES.M05 = 'No Issues Found'
```

Never hardcode user-facing strings in components.

### 9.4 Component States (BB-UI-11)

Every async component implements: loading, empty, error, success.

---

## 10. Background Jobs (Inngest)

### 10.1 Job Structure

```typescript
// packages/jobs/sync-bug-budget.ts
export const syncBugBudget = inngest.createFunction(
  { id: 'bug-budget-sync', retries: 2, concurrency: { limit: 1, key: 'bug-budget' } },
  { event: 'bug-budget/sync.requested' },
  async ({ event, step }) => {
    const runId = event.data.syncRunId;
    await step.run('mark-running', () => markRunning(runId));
    // One step per Jira page
    for (let page = 0; ; page++) {
      const result = await step.run(`fetch-page-${page}`, () => fetchAndUpsertPage(runId, page));
      if (result.isLast) break;
    }
    await step.run('finalize', () => markCompleted(runId));
  },
);
```

### 10.2 Job Rules

- One Inngest step per Jira API page (≤100 issues).
- Progress persisted to DB between steps (percentage ≤ 95 until complete).
- Concurrency limit: 1 per `bug-budget` key (BB-SYNC-09).
- Retries: 2 with 60s/300s backoff.
- Stuck-run sweeper as separate cron job.

---

*Conventions version: 1.0 — 2026-07-11*
*Aligned with: PRD v1.1, plan.md v1.0*
