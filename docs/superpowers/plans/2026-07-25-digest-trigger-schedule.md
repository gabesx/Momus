# Weekly Digest — Manual Trigger + Configurable Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) A manual **"Send digest now"** button (synchronous, with success/error feedback — doubles as a webhook test), and (2) an admin-configurable **day + hour** for the weekly digest instead of the hardcoded Monday 08:00 cron.

**Architecture:** Extract the digest build+post orchestration into a shared `runAnalyticsDigest` helper (infra) used by both the Inngest cron and a new send-now API route. Store `digest_day` + `digest_hour` in `analytics_settings`; the cron runs hourly (Asia/Jakarta) and sends only when now matches. No new table.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, Inngest cron, Supabase config row.

**Branch:** `feat/analytics-digest-schedule-trigger` (stacks on `feat/analytics-digest-provider`; rebases to master as those merge).

---

## Design decisions

- **Send-now** uses the **saved** settings (server loads them); UI hints "save first". Allowed whenever a webhook is configured, regardless of `digest_enabled` (explicit action). Runs synchronously and returns `{ ok, status }` or a clear error (bad host, non-2xx, etc.).
- **Schedule** stored as `digest_day` (`mon`..`sun`) + `digest_hour` (0–23, Asia/Jakarta). Defaults `mon` / `8` (current behavior). The cron changes from `0 8 * * 1` to hourly `0 * * * *` (TZ=Asia/Jakarta); the function computes the current Jakarta weekday+hour and no-ops unless it matches. Schedule gating lives in the cron function, not the shared helper (so send-now bypasses it).

---

## File map

| Path | Role |
|---|---|
| `packages/infra/src/supabase/analytics-settings.ts` | Add `digest_day` + `digest_hour` (+ normalize/validate) |
| `packages/infra/src/analytics/digest-runner.ts` (new) | `runAnalyticsDigest(db, settings)` — load data, build text, POST webhook |
| `packages/infra/src/index.ts` | Re-export the runner |
| `packages/jobs/src/weekly-digest.ts` | Hourly cron; Jakarta day/hour gate; delegate to runner |
| `apps/web/app/api/settings/analytics/send-digest/route.ts` (new) | POST manual send (CSRF + settings auth) |
| `apps/web/components/settings/tabs/analytics-tab.tsx` | Schedule day/hour inputs + "Send digest now" button |
| Tests | `analytics-settings.test.ts`, a digest-runner test (mocked fetch), schedule-match unit |

---

### Task 1: Infra — schedule settings + shared runner

- [ ] Add `digest_day: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'` and `digest_hour: number` (0–23) to `AnalyticsSettings` + defaults (`mon`/`8`); normalize (coerce invalid → default) and parse-validate.
- [ ] Create `digest-runner.ts`: `runAnalyticsDigest(db, settings, { dashboardUrl? })` → loads rows/config, builds text via `buildAnalyticsDigest` (linkStyle per provider), POSTs `{ text }` to `digest_webhook_url`, returns `{ status }`; throws on non-2xx or missing webhook. Export a pure `digestScheduleMatches(settings, nowIso)` helper (Jakarta weekday+hour).
- [ ] Tests: schedule-match true/false around the boundary; runner posts and throws on non-2xx (mock `fetch`).
- [ ] Commit `feat(infra): digest schedule settings + shared runner`

### Task 2: Jobs — hourly cron with schedule gate

- [ ] Change `weekly-digest.ts` cron to `TZ=Asia/Jakarta 0 * * * *`; skip unless `digest_enabled`, webhook present, and `digestScheduleMatches`. Delegate build+post to `runAnalyticsDigest`.
- [ ] Commit `feat(jobs): configurable digest day/hour via hourly gated cron`

### Task 3: Web — send-now API

- [ ] `POST /api/settings/analytics/send-digest`: `assertCsrf` + `requireAccessSettings`; load settings; 400 if no webhook; call `runAnalyticsDigest`; return `{ ok, status }` or `jsonFail` with the error. Write an audit entry (action `digest_test`).
- [ ] Commit `feat(web): manual send-digest API`

### Task 4: Settings UI

- [ ] In the Weekly digest card: add **Send day** (dropdown Mon–Sun) + **Send hour** (0–23) inputs, and a **"Send digest now"** button that POSTs to the send-now route and surfaces success ("Digest sent") or the error via `onAlert`; disabled while sending or when no webhook. Note that it uses saved settings.
- [ ] Commit `feat(web): digest schedule controls + send-now button`

### Task 5: Verify

- [ ] `pnpm --filter @momus/infra test && pnpm --filter @momus/domain test`; typecheck (domain/infra/jobs/web); `pnpm --filter web build`.
- [ ] Manual: click "Send digest now" with the Google Chat webhook → message posts, success shown; set day/hour and confirm `digestScheduleMatches` logic via unit tests. Bad webhook → error surfaced.

### Task 6: PR

- [ ] Push `feat/analytics-digest-schedule-trigger`; open PR (stacked on #38); test plan + screenshots.

---

## Execution

Infra-first (settings + runner + schedule-match, with tests), then cron gate, then API, then UI. Prefer inline execution in this session.
