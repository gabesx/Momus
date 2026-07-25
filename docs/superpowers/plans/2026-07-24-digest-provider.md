# Weekly Digest — Google Chat Provider Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins send the weekly analytics digest to **Google Chat** as well as Slack, chosen via an explicit provider selector in the analytics settings tab.

**Architecture:** The digest sender already posts `{ text }` to a webhook — a shape both Slack and Google Chat incoming webhooks accept. Add a `digest_provider` setting, adjust the one Slack-specific link so it renders in Google Chat, relabel the settings UI, and validate the webhook host per provider.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, Inngest cron job, Supabase config row (no migration — `analytics_settings` JSON).

**Branch:** `feat/analytics-digest-provider` (stacks on `feat/analytics-configurable-thresholds`; rebase onto master once PR #37 merges).

---

## Key facts

- Transport is provider-agnostic already: `fetch(webhook_url, { body: JSON.stringify({ text }) })` in `weekly-digest.ts`. Google Chat webhooks accept `{"text": "..."}`; URLs are `https://chat.googleapis.com/...` (pass existing https validation).
- `*bold*` and `•` bullets render in both.
- **Only incompatibility:** the dashboard link uses Slack syntax `<url|label>` ([digest.ts:96]), which Google Chat prints literally. Needs a per-provider link style.

---

## File map

| Path | Role |
|---|---|
| `packages/infra/src/supabase/analytics-settings.ts` | Add `digest_provider: 'slack' \| 'google_chat'` (default 'slack') + normalize/validate |
| `packages/infra/src/supabase/analytics-settings.test.ts` | Provider default/validation cases |
| `packages/domain/src/analytics/digest.ts` | Provider-aware dashboard link rendering |
| `packages/domain/src/analytics/digest.test.ts` | Link-format cases per provider |
| `packages/jobs/src/weekly-digest.ts` | Pass provider into the digest builder |
| `apps/web/components/settings/tabs/analytics-tab.tsx` | Provider selector + relabel webhook field |

---

### Task 1: Infra — digest_provider setting

- [ ] Add `digest_provider: 'slack' | 'google_chat'` to `AnalyticsSettings` + `DEFAULT_ANALYTICS_SETTINGS` ('slack'); normalize (coerce unknown → 'slack').
- [ ] In `parseAnalyticsSettings`: validate the enum; when the digest is enabled, validate the webhook host matches the provider (`hooks.slack.com` for slack, `chat.googleapis.com` for google_chat) with a clear error. Keep the existing `https://` + digest-enabled-requires-webhook rules.
- [ ] Tests for default, enum coercion, host mismatch throw.
- [ ] Commit `feat(infra): weekly digest provider (slack | google_chat)`

### Task 2: Domain — provider-aware link

- [ ] Extend `AnalyticsDigestOptions` with `linkStyle?: 'slack' | 'plain'` (or `provider`). Render the dashboard line as `<url|label>` for Slack, and `Open the dashboard: <url>` (bare URL) for Google Chat/plain.
- [ ] Tests: Slack style emits `<url|Open the dashboard>`; plain style emits a bare URL with no angle-bracket link.
- [ ] Commit `feat(domain): provider-aware digest dashboard link`

### Task 3: Job — thread provider

- [ ] In `weekly-digest.ts`, pass the provider (map to `linkStyle`) into `buildAnalyticsDigest`. Transport unchanged (`{ text }`).
- [ ] Commit `feat(jobs): send weekly digest per configured provider`

### Task 4: Settings UI

- [ ] In `analytics-tab.tsx` "Weekly digest" card: add a "Provider" selector (Slack / Google Chat). Relabel the URL field to "Webhook URL" with a per-provider placeholder (`https://hooks.slack.com/services/…` vs `https://chat.googleapis.com/v1/spaces/…`) and help text. Save via the existing `POST /api/settings/analytics`.
- [ ] Commit `feat(web): weekly digest provider selector`

### Task 5: Verify

- [ ] `pnpm --filter @momus/infra test && pnpm --filter @momus/domain test`
- [ ] typecheck (domain/infra/jobs/web) + `pnpm --filter web build`
- [ ] Manual: select Google Chat + a `chat.googleapis.com` URL, save (host validation passes); select Slack + a Slack URL, save; mismatched host → clear error. (Optionally trigger the digest against a real Google Chat webhook to confirm rendering.)

### Task 6: PR

- [ ] Push `feat/analytics-digest-provider`; open PR with test plan; note it stacks on #37.

---

## Execution

Infra-first, then domain link, job, settings UI. Prefer inline execution in this session.
