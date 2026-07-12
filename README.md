# Momus

Centralized bug and defect tracking system — Bug Budget module rebuild.

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Database:** Supabase PostgreSQL
- **Monorepo:** Turborepo + pnpm workspaces
- **Deploy:** Vercel (frontend + API)

## Prerequisites

- Node.js 22+
- pnpm 9+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (optional, for containerized web + Inngest dev)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local Supabase (Postgres, Auth, Studio)
pnpm db:start

# Copy env vars (run `supabase status` to get keys)
cp .env.example .env.local
# Edit .env.local with anon + service_role keys from `supabase status`

# Apply migrations + seed (first time or after schema changes)
pnpm db:reset

# Start Next.js dev server
pnpm dev
```

Open:
- App: http://localhost:3000
- Bug Budget: http://localhost:3000/bug-budget
- Health: http://localhost:3000/api/health
- Worker health: http://localhost:3000/api/health/worker
- Supabase Studio: http://localhost:54323
- Ops runbook: [docs/ops/runbook.md](docs/ops/runbook.md)

## Project Structure

```
apps/web/           Next.js application
packages/domain/    Pure business logic (Phase 1)
packages/infra/     Supabase, Jira clients
packages/jobs/      Background jobs (Phase 2)
packages/shared/    Types, messages, schemas
supabase/           Migrations, seeds, config
```

## Database

Migrations live in `supabase/migrations/`:

| Migration | Contents |
|---|---|
| `000000` | Core schema: `bug_budget`, sync runs, settings, config |
| `000001` | RLS policies |
| `000002` | Seed data (multipliers, mappings, holidays) |

```bash
pnpm db:reset      # Reset DB and re-apply all migrations + seeds
pnpm db:types      # Generate TypeScript types from schema
```

## Docker (optional)

```bash
# Supabase still runs via CLI
pnpm db:start

# Web + Inngest dev containers
docker compose -f docker/docker-compose.yml up
```

## Docs

- [`prd.md`](prd.md) — Product requirements (source of truth)
- [`plan.md`](plan.md) — Implementation roadmap
- [`conventions.md`](conventions.md) — Development standards
- [`history-log.md`](history-log.md) — Progress changelog
