# Configurable KPI Thresholds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins tune the analytics KPI warning/healthy thresholds (open backlog, avg age, resolution rate, Critical/Major %, long-overdue %, MTTR, SLA compliance %, escape rate) from Settings, instead of the hardcoded `ANALYTICS_KPI_THRESHOLDS`. The SLA *day* thresholds are already configurable — this extends the same mechanism to the rest.

**Architecture:** Extend the existing `analytics_settings` config (`bug_budget_config`) that already stores SLA days + prod labels. The domain tone helpers already accept an optional threshold arg, so no domain signature changes are needed — the API surfaces the effective thresholds and the dashboard passes them in. Settings UI reuses the analytics-tab + CSRF + audit pipeline.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, Supabase config row (no migration — `analytics_settings` is a JSON config value).

**Spec:** Realizes "Configurable thresholds in Settings" listed as out-of-scope in `docs/superpowers/specs/2026-07-13-analytics-risk-panel-design.md`.

**Branch:** `feat/analytics-configurable-thresholds`

---

## Thresholds to make configurable

Already configurable: `sla_first_response_days`, `sla_critical_resolution_days`, `sla_major_resolution_days`.

Add (defaults from `ANALYTICS_KPI_THRESHOLDS`):

| Field | Default | Drives (thresholds.ts) |
|---|---|---|
| `open_warning` | 100 | `openIssuesTone` |
| `avg_age_warning_days` | 30 | `avgAgeTone` |
| `resolution_rate_healthy_pct` | 70 | `resolutionRateTone` |
| `open_critical_major_pct_warning` | 25 | `criticalMajorPctTone` |
| `open_long_overdue_pct_warning` | 20 | `longOverduePctTone` |
| `mttr_critical_major_warning_hours` | 72 | `mttrCriticalMajorTone` |
| `sla_compliance_healthy_pct` | 90 | `slaComplianceTone` |
| `escape_rate_warning_pct` | 10 | `escapeRateTone` |

---

## File map

| Path | Role |
|---|---|
| `packages/infra/src/supabase/analytics-settings.ts` | Extend `AnalyticsSettings` + defaults + normalize + parse/validate |
| `packages/infra/src/supabase/settings.test.ts` (or analytics-settings tests) | Validation/normalization cases |
| `apps/web/app/api/analytics/route.ts` | Include effective KPI thresholds in the response `meta` |
| `apps/web/components/analytics/defect-analytics-dashboard.tsx` | Thread thresholds into panels |
| `apps/web/components/analytics/{summary-cards,risk-panel,mttr-panel,triage-panel,cost-quality-panel}.tsx` | Pass configured threshold into each tone helper |
| `apps/web/components/settings/tabs/analytics-tab.tsx` | Threshold inputs in the settings form |

---

### Task 1: Infra — extend analytics_settings

- [ ] Add the 8 threshold fields to `AnalyticsSettings` and `DEFAULT_ANALYTICS_SETTINGS` (seeded from `ANALYTICS_KPI_THRESHOLDS`).
- [ ] Extend `normalizeAnalyticsSettings` (clamp to sensible bounds — counts/hours > 0; percentages 0–100) and `parseAnalyticsSettings` (validation with clear messages).
- [ ] Tests: invalid/missing fields fall back to defaults on normalize; parse throws on out-of-range; round-trips valid input.
- [ ] Commit `feat(infra): configurable analytics KPI thresholds in analytics_settings`

### Task 2: API — surface effective thresholds

- [ ] In `/api/analytics`, include the KPI thresholds (from the already-loaded `settings`) in the response — e.g. `meta.thresholds` — so the client tones use configured values. No new query params.
- [ ] Extend the dashboard's `AnalyticsResponse` type + a contract/route test asserting `meta.thresholds` is present with all 8 keys.
- [ ] Commit `feat(web): analytics API returns effective KPI thresholds`

### Task 3: UI — apply thresholds in panels

- [ ] Thread `meta.thresholds` from the dashboard into `SummaryCards`, `RiskPanel`, `MttrPanel`, `TriagePanel`, `CostQualityPanel`, passing each value into the matching tone helper (`openIssuesTone(open, thresholds.open_warning)`, etc.). Fall back to defaults when absent.
- [ ] Commit `feat(web): apply configured KPI thresholds to dashboard tones`

### Task 4: Settings UI

- [ ] Add a "KPI thresholds" group to `analytics-tab.tsx` with numeric inputs for the 8 fields, saving via the existing `POST /api/settings/analytics` (CSRF + audit already wired). Inline validation mirroring the server bounds; a "Reset to defaults" affordance.
- [ ] Commit `feat(web): KPI threshold controls in analytics settings`

### Task 5: Verify

- [ ] `pnpm --filter @momus/infra test && pnpm --filter @momus/domain test`
- [ ] `pnpm --filter web typecheck` (+ infra/domain typecheck)
- [ ] `pnpm --filter web build` (coordinate with any running dev server — shared `.next`)
- [ ] Manual: change a threshold in Settings, reload dashboard, confirm the corresponding KPI tile changes tone; confirm the audit log records the change.

### Task 6: PR

- [ ] Push `feat/analytics-configurable-thresholds`; open PR with screenshots + test plan; reference this plan and the risk-panel spec's out-of-scope note.

---

## Execution

Infra-first (types + validation + tests), then API, then dashboard wiring, then settings form. Prefer inline execution in this session.
