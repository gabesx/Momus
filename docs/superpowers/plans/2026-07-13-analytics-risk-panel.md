# Analytics Open Risk Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Open Risk panel to Defect Analytics showing Critical/Major and aging buckets for currently open issues.

**Architecture:** Pure risk aggregation in `packages/domain` via `computeAnalyticsSummary` (extended `summary.risk`); existing `GET /api/analytics` returns it unchanged; new `RiskPanel` UI between summary cards and the trend chart. No new routes or migrations.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, existing analytics CSS tokens.

**Spec:** `docs/superpowers/specs/2026-07-13-analytics-risk-panel-design.md`

---

## File map

| Path | Role |
|---|---|
| `packages/domain/src/analytics/types.ts` | `AnalyticsRiskResult`, thresholds, extend `AnalyticsSummaryResult` |
| `packages/domain/src/analytics/risk.ts` | `computeAnalyticsRisk(rows)` — open-only aging + severity |
| `packages/domain/src/analytics/summary.ts` | Attach `risk` + risk MoM to summary |
| `packages/domain/src/analytics/thresholds.ts` | Tone helpers for risk % KPIs |
| `packages/domain/src/analytics/risk.test.ts` | Unit tests for risk math |
| `packages/domain/src/analytics/thresholds.test.ts` | Tone helper tests (create if missing) |
| `packages/domain/src/analytics/contract.test.ts` | Assert `summary.risk` shape + new thresholds |
| `apps/web/components/analytics/risk-panel.tsx` | Risk panel UI |
| `apps/web/components/analytics/defect-analytics-dashboard.tsx` | Mount panel |
| `apps/web/app/globals.css` | Risk panel layout styles |

API route needs **no code change** if it already returns `computeAnalyticsSummary(...)` as `summary`.

---

### Task 1: Types + KPI thresholds

**Files:**
- Modify: `packages/domain/src/analytics/types.ts`
- Modify: `packages/domain/src/analytics/contract.test.ts`

- [ ] **Step 1: Write the failing contract assertions**

In `contract.test.ts`, extend the thresholds test and summary MoM test:

```ts
expect(ANALYTICS_KPI_THRESHOLDS.open_critical_major_pct_warning).toBe(25);
expect(ANALYTICS_KPI_THRESHOLDS.open_long_overdue_pct_warning).toBe(20);

const summary = computeAnalyticsSummary(rows, nowIso);
expect(summary.risk).toBeDefined();
expect(summary.risk.open_age_buckets).toEqual({
  fresh: expect.any(Number),
  aging: expect.any(Number),
  stale: expect.any(Number),
  long_overdue: expect.any(Number),
});
expect(summary.risk.mom).toHaveProperty('open_critical_major');
expect(summary.risk.mom).toHaveProperty('open_long_overdue');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @momus/domain exec vitest run src/analytics/contract.test.ts`

Expected: FAIL — missing threshold keys / `summary.risk` undefined.

- [ ] **Step 3: Add types and threshold constants**

In `types.ts`:

```ts
export type AnalyticsAgeBuckets = {
  fresh: number;
  aging: number;
  stale: number;
  long_overdue: number;
};

export type AnalyticsRiskResult = {
  open_critical: number;
  open_major: number;
  open_critical_major: number;
  open_critical_major_pct_of_open: number;
  open_long_overdue: number;
  open_long_overdue_pct_of_open: number;
  open_age_buckets: AnalyticsAgeBuckets;
  open_severity: Record<string, number>;
  mom: {
    open_critical_major: number | null;
    open_long_overdue: number | null;
  };
};

export type AnalyticsSummaryResult = AnalyticsSummaryMetrics & {
  mom: { /* existing */ };
  risk: AnalyticsRiskResult;
};

export const ANALYTICS_KPI_THRESHOLDS = {
  open_warning: 100,
  avg_age_warning_days: 30,
  resolution_rate_healthy_pct: 70,
  open_critical_major_pct_warning: 25,
  open_long_overdue_pct_warning: 20,
} as const;
```

Stub `risk` temporarily in `computeAnalyticsSummary` with zeros/`null` MoM so the contract compile/run can pass once Task 2 lands full logic — **or** leave summary broken until Task 2 (preferred TDD: Task 1 only adds types + thresholds; keep contract risk assertions in Task 2 if summary still lacks risk).

**Preferred split:** Task 1 only adds types + threshold constants + threshold expect lines. Move `summary.risk` expects into Task 2 after implementation.

Update contract Step 1 accordingly — only add the two threshold expects in Task 1.

- [ ] **Step 4: Run contract test**

Run: `pnpm --filter @momus/domain exec vitest run src/analytics/contract.test.ts`

Expected: PASS (threshold expects only).

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/analytics/types.ts packages/domain/src/analytics/contract.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): add analytics risk types and KPI thresholds

EOF
)"
```

---

### Task 2: Domain risk computation (TDD)

**Files:**
- Create: `packages/domain/src/analytics/risk.ts`
- Create: `packages/domain/src/analytics/risk.test.ts`
- Modify: `packages/domain/src/analytics/summary.ts`
- Modify: `packages/domain/src/analytics/contract.test.ts`
- Modify: `packages/domain/src/index.ts` (export risk if useful; optional — summary re-export may suffice)

- [ ] **Step 1: Write failing unit tests**

Create `risk.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeAnalyticsRisk } from './risk';
import type { AnalyticsIssueRow } from './types';

function row(partial: Partial<AnalyticsIssueRow> & Pick<AnalyticsIssueRow, 'project' | 'is_open'>): AnalyticsIssueRow {
  return {
    created_date: '2026-06-01T00:00:00+07:00',
    created_year: 2026,
    issue_type: 'Bug',
    ...partial,
  };
}

describe('computeAnalyticsRisk', () => {
  it('scopes to open issues only', () => {
    const risk = computeAnalyticsRisk([
      row({ is_open: true, severity_issue: 'Critical', defect_age_days: 3 }),
      row({ is_open: false, severity_issue: 'Critical', defect_age_days: 100 }),
    ]);
    expect(risk.open_critical).toBe(1);
    expect(risk.open_critical_major).toBe(1);
    expect(risk.open_long_overdue).toBe(0);
    expect(risk.open_age_buckets.fresh).toBe(1);
  });

  it('matches Critical/Major exactly like Bug Budget', () => {
    const risk = computeAnalyticsRisk([
      row({ is_open: true, severity_issue: 'Critical', defect_age_days: 1 }),
      row({ is_open: true, severity_issue: 'Major', defect_age_days: 1 }),
      row({ is_open: true, severity_issue: 'critical', defect_age_days: 1 }), // not exact
      row({ is_open: true, severity_issue: 'Minor', defect_age_days: 1 }),
    ]);
    expect(risk.open_critical).toBe(1);
    expect(risk.open_major).toBe(1);
    expect(risk.open_critical_major).toBe(2);
  });

  it('buckets ages at 5 / 20 / 80 boundaries', () => {
    const risk = computeAnalyticsRisk([
      row({ is_open: true, defect_age_days: 5 }),
      row({ is_open: true, defect_age_days: 6 }),
      row({ is_open: true, defect_age_days: 20 }),
      row({ is_open: true, defect_age_days: 21 }),
      row({ is_open: true, defect_age_days: 80 }),
      row({ is_open: true, defect_age_days: 81 }),
    ]);
    expect(risk.open_age_buckets).toEqual({
      fresh: 1,
      aging: 2,
      stale: 2,
      long_overdue: 1,
    });
    expect(risk.open_long_overdue).toBe(1);
  });

  it('excludes missing or non-positive age from buckets', () => {
    const risk = computeAnalyticsRisk([
      row({ is_open: true, defect_age_days: null }),
      row({ is_open: true, defect_age_days: 0 }),
      row({ is_open: true, defect_age_days: 10 }),
    ]);
    expect(risk.open_age_buckets).toEqual({
      fresh: 0,
      aging: 1,
      stale: 0,
      long_overdue: 0,
    });
  });

  it('returns zero pcts when no open issues', () => {
    const risk = computeAnalyticsRisk([
      row({ is_open: false, severity_issue: 'Critical', defect_age_days: 100 }),
    ]);
    expect(risk.open_critical_major_pct_of_open).toBe(0);
    expect(risk.open_long_overdue_pct_of_open).toBe(0);
    expect(risk.open_severity).toEqual({});
  });

  it('counts Unknown severity for null/empty', () => {
    const risk = computeAnalyticsRisk([
      row({ is_open: true, severity_issue: null, defect_age_days: 1 }),
      row({ is_open: true, severity_issue: '  ', defect_age_days: 1 }),
    ]);
    expect(risk.open_severity.Unknown).toBe(2);
    expect(risk.open_critical_major).toBe(0);
  });
});
```

Also add summary-level MoM test in `risk.test.ts` or `summary` tests:

```ts
import { computeAnalyticsSummary } from './summary';

it('attaches risk MoM using created-month cohorts (null when prior zero)', () => {
  const nowIso = '2026-07-11T12:00:00+07:00';
  const rows: AnalyticsIssueRow[] = [
    row({
      is_open: true,
      created_date: '2026-07-02T00:00:00+07:00',
      severity_issue: 'Critical',
      defect_age_days: 90,
    }),
    // previous month has open critical but we need prior open_critical_major > 0 for non-null MoM
    row({
      is_open: true,
      created_date: '2026-06-10T00:00:00+07:00',
      severity_issue: 'Major',
      defect_age_days: 2,
    }),
  ];
  const summary = computeAnalyticsSummary(rows, nowIso);
  expect(summary.risk.open_critical_major).toBe(2); // both still open in full set
  expect(summary.risk.mom.open_critical_major).not.toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @momus/domain exec vitest run src/analytics/risk.test.ts`

Expected: FAIL — `computeAnalyticsRisk` not found / summary missing `risk`.

- [ ] **Step 3: Implement `risk.ts`**

```ts
import { defectAgeBucket } from '../age/business-days';
import { round1 } from '../budget/status';
import type { AnalyticsAgeBuckets, AnalyticsIssueRow, AnalyticsRiskResult } from './types';

const EMPTY_BUCKETS: AnalyticsAgeBuckets = {
  fresh: 0,
  aging: 0,
  stale: 0,
  long_overdue: 0,
};

function severityKey(severity: string | null | undefined): string {
  const t = severity?.trim();
  return t ? t : 'Unknown';
}

/** Open-only risk metrics for the filtered analytics row set (no MoM). */
export function computeAnalyticsRisk(rows: AnalyticsIssueRow[]): Omit<AnalyticsRiskResult, 'mom'> {
  const open = rows.filter((r) => r.is_open);
  const openCount = open.length;

  const open_critical = open.filter((r) => r.severity_issue === 'Critical').length;
  const open_major = open.filter((r) => r.severity_issue === 'Major').length;
  const open_critical_major = open_critical + open_major;

  const open_age_buckets: AnalyticsAgeBuckets = { ...EMPTY_BUCKETS };
  for (const r of open) {
    const days = r.defect_age_days;
    if (days == null || days <= 0) continue;
    const bucket = defectAgeBucket(days);
    if (bucket === 'long overdue') open_age_buckets.long_overdue += 1;
    else open_age_buckets[bucket] += 1;
  }

  const open_long_overdue = open_age_buckets.long_overdue;
  const open_severity: Record<string, number> = {};
  for (const r of open) {
    const key = severityKey(r.severity_issue);
    open_severity[key] = (open_severity[key] ?? 0) + 1;
  }

  return {
    open_critical,
    open_major,
    open_critical_major,
    open_critical_major_pct_of_open:
      openCount === 0 ? 0 : round1((open_critical_major / openCount) * 100),
    open_long_overdue,
    open_long_overdue_pct_of_open:
      openCount === 0 ? 0 : round1((open_long_overdue / openCount) * 100),
    open_age_buckets,
    open_severity,
  };
}
```

- [ ] **Step 4: Wire into `summary.ts`**

```ts
import { computeAnalyticsRisk } from './risk';
// ... existing metrics / pctChange ...

export function computeAnalyticsSummary(
  rows: AnalyticsIssueRow[],
  nowIso: string,
): AnalyticsSummaryResult {
  const base = metrics(rows);
  // ... existing curKey / prevKey / curRows / prevRows ...
  const cur = metrics(curRows);
  const prev = metrics(prevRows);

  const riskBase = computeAnalyticsRisk(rows);
  const curRisk = computeAnalyticsRisk(curRows);
  const prevRisk = computeAnalyticsRisk(prevRows);

  return {
    ...base,
    mom: { /* existing */ },
    risk: {
      ...riskBase,
      mom: {
        open_critical_major: pctChange(
          curRisk.open_critical_major,
          prevRisk.open_critical_major,
        ),
        open_long_overdue: pctChange(curRisk.open_long_overdue, prevRisk.open_long_overdue),
      },
    },
  };
}
```

- [ ] **Step 5: Extend contract.test.ts** for `summary.risk` shape (as in Task 1 deferred expects).

- [ ] **Step 6: Run domain tests**

Run: `pnpm --filter @momus/domain test`

Expected: PASS (all analytics + existing suites).

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/analytics/risk.ts packages/domain/src/analytics/risk.test.ts \
  packages/domain/src/analytics/summary.ts packages/domain/src/analytics/contract.test.ts \
  packages/domain/src/index.ts
git commit -m "$(cat <<'EOF'
feat(domain): compute open risk aging and severity for analytics

EOF
)"
```

---

### Task 3: Threshold tone helpers

**Files:**
- Modify: `packages/domain/src/analytics/thresholds.ts`
- Create or modify: `packages/domain/src/analytics/thresholds.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { criticalMajorPctTone, longOverduePctTone } from './thresholds';

describe('risk KPI tones', () => {
  it('criticalMajorPctTone uses 25% danger / 70% of threshold warning', () => {
    expect(criticalMajorPctTone(25)).toBe('danger');
    expect(criticalMajorPctTone(17.5)).toBe('warning'); // 0.7 * 25
    expect(criticalMajorPctTone(10)).toBe('ok');
  });

  it('longOverduePctTone uses 20% danger', () => {
    expect(longOverduePctTone(20)).toBe('danger');
    expect(longOverduePctTone(14)).toBe('warning');
    expect(longOverduePctTone(5)).toBe('ok');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @momus/domain exec vitest run src/analytics/thresholds.test.ts`

- [ ] **Step 3: Implement**

```ts
export function criticalMajorPctTone(
  pct: number,
  threshold = ANALYTICS_KPI_THRESHOLDS.open_critical_major_pct_warning,
): KpiTone {
  if (pct >= threshold) return 'danger';
  if (pct >= threshold * 0.7) return 'warning';
  return 'ok';
}

export function longOverduePctTone(
  pct: number,
  threshold = ANALYTICS_KPI_THRESHOLDS.open_long_overdue_pct_warning,
): KpiTone {
  if (pct >= threshold) return 'danger';
  if (pct >= threshold * 0.7) return 'warning';
  return 'ok';
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/analytics/thresholds.ts packages/domain/src/analytics/thresholds.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): add risk KPI threshold tone helpers

EOF
)"
```

---

### Task 4: Risk panel UI + CSS

**Files:**
- Create: `apps/web/components/analytics/risk-panel.tsx`
- Modify: `apps/web/app/globals.css` (after `.bb-analytics-metrics` block ~1554)
- Modify: `apps/web/components/analytics/defect-analytics-dashboard.tsx`

- [ ] **Step 1: Add CSS**

Append near other analytics styles:

```css
.bb-analytics-risk {
  background: var(--bb-white);
  border: 1px solid var(--bb-border);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.bb-analytics-risk__header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.bb-analytics-risk__header p {
  margin: 0.25rem 0 1rem;
  font-size: 0.9rem;
  color: var(--bb-secondary);
}

.bb-analytics-risk__kpis {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.bb-analytics-risk__meta {
  font-size: 0.8rem;
  color: var(--bb-secondary);
}

.bb-analytics-risk__section-title {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.bb-analytics-risk__age-bar {
  display: flex;
  width: 100%;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bb-border);
  margin-bottom: 0.5rem;
}

.bb-analytics-risk__age-seg {
  height: 100%;
  min-width: 0;
}

.bb-analytics-risk__age-seg--fresh { background: var(--bb-success); }
.bb-analytics-risk__age-seg--aging { background: var(--bb-info); }
.bb-analytics-risk__age-seg--stale { background: var(--bb-warning, #f0ad4e); }
.bb-analytics-risk__age-seg--long_overdue { background: var(--bb-danger); }

.bb-analytics-risk__age-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  font-size: 0.8rem;
  margin-bottom: 1rem;
}

.bb-analytics-risk__sev-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.bb-analytics-risk__sev-row {
  display: grid;
  grid-template-columns: 7rem 1fr 2.5rem;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.85rem;
}

.bb-analytics-risk__sev-track {
  height: 8px;
  background: var(--bb-border);
  border-radius: 4px;
  overflow: hidden;
}

.bb-analytics-risk__sev-fill {
  height: 100%;
  background: var(--bb-primary);
}

@media (max-width: 800px) {
  .bb-analytics-risk__kpis {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Create `risk-panel.tsx`**

Reuse MoM formatting patterns from `summary-cards.tsx` (copy `momClass` / `formatMom` locally or extract shared helpers — prefer local copy to avoid drive-by refactor).

```tsx
'use client';

import {
  ANALYTICS_KPI_THRESHOLDS,
  criticalMajorPctTone,
  longOverduePctTone,
  type AnalyticsSummaryResult,
} from '@momus/domain';

type Props = {
  summary: AnalyticsSummaryResult | null;
  loading?: boolean;
};

const AGE_ORDER = [
  { key: 'fresh' as const, label: 'Fresh' },
  { key: 'aging' as const, label: 'Aging' },
  { key: 'stale' as const, label: 'Stale' },
  { key: 'long_overdue' as const, label: 'Long overdue' },
];

const SEV_ORDER = ['Critical', 'Major', 'Minor', 'Low', 'Unknown'];

function thresholdClass(tone: 'ok' | 'warning' | 'danger' | 'neutral'): string {
  if (tone === 'danger') return 'bb-analytics-metric-card--threshold-danger';
  if (tone === 'warning') return 'bb-analytics-metric-card--threshold-warning';
  if (tone === 'ok') return 'bb-analytics-metric-card--threshold-ok';
  return '';
}

// ... formatMom / momClass (higher-is-bad) same as summary-cards ...

export function RiskPanel({ summary, loading }: Props) {
  if (loading && !summary) {
    return <div className="bb-analytics-risk"><div className="bb-skeleton" style={{ minHeight: 180 }} /></div>;
  }
  if (!summary) return null;

  const { risk } = summary;
  const buckets = risk.open_age_buckets;
  const bucketTotal =
    buckets.fresh + buckets.aging + buckets.stale + buckets.long_overdue;
  const sevEntries = [
    ...SEV_ORDER.filter((k) => (risk.open_severity[k] ?? 0) > 0).map((k) => [k, risk.open_severity[k]] as const),
    ...Object.entries(risk.open_severity)
      .filter(([k, n]) => !SEV_ORDER.includes(k) && n > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  ];
  const sevMax = Math.max(0, ...sevEntries.map(([, n]) => n));

  return (
    <section className="bb-analytics-risk" aria-label="Open risk">
      <div className="bb-analytics-risk__header">
        <h2>Open risk</h2>
        <p>Aging and severity of currently open issues</p>
      </div>

      <div className="bb-analytics-risk__kpis">
        {/* Critical/Major tile + Long overdue tile using risk.* and tones */}
      </div>

      <h3 className="bb-analytics-risk__section-title">Aging (open)</h3>
      {summary.open === 0 || bucketTotal === 0 ? (
        <p className="muted">
          {summary.open === 0 ? 'No open issues in scope.' : 'No open issues with a positive age in scope.'}
        </p>
      ) : (
        <>
          <div className="bb-analytics-risk__age-bar" role="img" aria-label="Open issue age distribution">
            {AGE_ORDER.map(({ key }) => {
              const n = buckets[key];
              if (!n) return null;
              return (
                <div
                  key={key}
                  className={`bb-analytics-risk__age-seg bb-analytics-risk__age-seg--${key}`}
                  style={{ flexGrow: n, flexBasis: 0 }}
                  title={`${key}: ${n}`}
                />
              );
            })}
          </div>
          <div className="bb-analytics-risk__age-legend">
            {AGE_ORDER.map(({ key, label }) => (
              <span key={key}>{label}: {buckets[key]}</span>
            ))}
          </div>
        </>
      )}

      <h3 className="bb-analytics-risk__section-title">Severity (open)</h3>
      {sevEntries.length === 0 ? (
        <p className="muted">No open issues in scope.</p>
      ) : (
        <div className="bb-analytics-risk__sev-list">
          {sevEntries.map(([label, count]) => (
            <div key={label} className="bb-analytics-risk__sev-row">
              <span>{label}</span>
              <div className="bb-analytics-risk__sev-track">
                <div
                  className="bb-analytics-risk__sev-fill"
                  style={{ width: sevMax ? `${(count / sevMax) * 100}%` : '0%' }}
                />
              </div>
              <span>{count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

Fill the two KPI tiles completely (do not leave placeholders): mirror `SummaryCards` structure with `criticalMajorPctTone(risk.open_critical_major_pct_of_open)`, hints using `ANALYTICS_KPI_THRESHOLDS`, and MoM from `risk.mom`.

- [ ] **Step 3: Wire dashboard**

In `defect-analytics-dashboard.tsx`, import `RiskPanel` and render after `<SummaryCards ... />`:

```tsx
<SummaryCards summary={data?.summary ?? null} loading={loading} />
<RiskPanel summary={data?.summary ?? null} loading={loading} />
```

- [ ] **Step 4: Typecheck web**

Run: `pnpm --filter web typecheck` (or `pnpm --filter @momus/web exec tsc --noEmit` — use the package name from `apps/web/package.json`).

Expected: PASS.

- [ ] **Step 5: Manual check**

With `pnpm dev` running, open `http://localhost:3000/`:
- Risk panel appears between KPI cards and trends
- Filters change risk numbers
- Empty states when filtered to resolved-only / no open

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/analytics/risk-panel.tsx \
  apps/web/components/analytics/defect-analytics-dashboard.tsx \
  apps/web/app/globals.css
git commit -m "$(cat <<'EOF'
feat(web): add open risk panel to defect analytics

EOF
)"
```

---

### Task 5: Spec status + final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-analytics-risk-panel-design.md` (Status → Implemented; check success criteria)

- [ ] **Step 1:** Re-run `pnpm --filter @momus/domain test`
- [ ] **Step 2:** Spot-check UI on `/`
- [ ] **Step 3:** Mark success criteria checkboxes in the spec; set Status to Implemented
- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-13-analytics-risk-panel-design.md
git commit -m "$(cat <<'EOF'
docs(analytics): mark open risk panel design implemented

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| `summary.risk` contract | 1–2 |
| Open-only + exact Critical/Major | 2 |
| Age buckets via `defectAgeBucket`; exclude ≤0 age | 2 |
| Pct of open; zero-open → 0 | 2 |
| MoM created-month cohorts | 2 |
| Threshold defaults 25% / 20% + tones | 1, 3 |
| Risk panel UI between cards and chart | 4 |
| No new API route / no migration / no click-through | (explicit non-work) |
| Empty / loading states | 4 |

## Self-review notes

- No TBD placeholders in steps.
- `computeAnalyticsRisk` returns metrics without `mom`; summary attaches MoM — consistent across Task 2.
- API route unchanged; TypeScript will require `risk` on summary type for UI consumers.
- Severity casing test documents Bug Budget parity (`'critical'` lowercase does **not** count).
