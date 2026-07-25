'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnalyticsFilterParams,
  AnalyticsPeriodDetail,
  AnalyticsSummaryResult,
  AnalyticsTrendsResult,
  QaSlipRow,
} from '@momus/domain';
import { apiJson } from '@/lib/api-client';
import { analyticsParamsFromUrl, analyticsParamsToQuery } from '@/lib/analytics-params';
import { AnalyticsFilters } from './analytics-filters';
import { InflowOutflowChart } from './inflow-outflow-chart';
import { CostQualityPanel } from './cost-quality-panel';
import { DistributionPanel } from './distribution-panel';
import { SquadHeatPanel } from './squad-heat-panel';
import { MttrPanel } from './mttr-panel';
import { PeriodDetailPanel } from './period-detail-panel';
import { RiskPanel } from './risk-panel';
import { TriagePanel } from './triage-panel';
import { SummaryCards } from './summary-cards';
import { TrendChart } from './trend-chart';
import { QaSlipPanel } from './qa-slip-panel';

type AnalyticsResponse = {
  success: boolean;
  message?: string;
  summary: AnalyticsSummaryResult;
  trends: AnalyticsTrendsResult;
  qa_slip: QaSlipRow[];
  filter_options: { projects: string[]; years: number[] };
  meta: { last_updated: string | null; scope_hint: string; trend_grain?: string };
};

type PeriodDetailResponse = {
  success: boolean;
  message?: string;
  detail: AnalyticsPeriodDetail;
};

function parseAnalyticsQuery(sp: URLSearchParams): AnalyticsFilterParams {
  return analyticsParamsFromUrl(new URL(`http://local?${sp.toString()}`));
}

function formatLastUpdated(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function grainTitle(grain: string | undefined): string {
  if (grain === 'quarter') return 'Quarterly Trends';
  if (grain === 'year') return 'Yearly Trends';
  return 'Monthly Trends';
}

export function DefectAnalyticsDashboard() {
  const [state, setState] = useState<AnalyticsFilterParams>({ trend_grain: 'month' });
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [periodDetail, setPeriodDetail] = useState<AnalyticsPeriodDetail | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

  const ready = useRef(false);
  const lastFetchedQs = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const suppressPush = useRef(false);

  const clearPeriod = useCallback(() => {
    setPeriodLabel(null);
    setPeriodDetail(null);
    setPeriodError(null);
    setPeriodLoading(false);
  }, []);

  const fetchData = useCallback(async (next: AnalyticsFilterParams) => {
    const qs = analyticsParamsToQuery(next);
    lastFetchedQs.current = qs;
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<AnalyticsResponse>(`/api/analytics${qs}`);
      if (!res.success) {
        setError(res.message ?? 'Failed to load analytics data');
        return;
      }
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPeriodDetail = useCallback(
    async (periodKey: string, label: string, filters: AnalyticsFilterParams) => {
      setPeriodLabel(label);
      setPeriodLoading(true);
      setPeriodError(null);
      try {
        const base = analyticsParamsToQuery(filters);
        const sp = new URLSearchParams(base.startsWith('?') ? base.slice(1) : base);
        sp.set('period', periodKey);
        sp.set('grain', filters.trend_grain ?? 'month');
        const res = await apiJson<PeriodDetailResponse>(
          `/api/analytics/period-detail?${sp.toString()}`,
        );
        if (!res.success) {
          setPeriodError(res.message ?? 'Failed to load period detail');
          setPeriodDetail(null);
          return;
        }
        setPeriodDetail(res.detail);
      } catch (err) {
        setPeriodError(err instanceof Error ? err.message : 'Failed to load period detail');
        setPeriodDetail(null);
      } finally {
        setPeriodLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const initial = parseAnalyticsQuery(new URLSearchParams(window.location.search));
    if (!initial.trend_grain) initial.trend_grain = 'month';
    suppressPush.current = true;
    setState(initial);
    ready.current = true;
    void fetchData(initial);

    const onPop = () => {
      const parsed = parseAnalyticsQuery(new URLSearchParams(window.location.search));
      if (!parsed.trend_grain) parsed.trend_grain = 'month';
      suppressPush.current = true;
      setState(parsed);
      clearPeriod();
      void fetchData(parsed);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [fetchData, clearPeriod]);

  useEffect(() => {
    if (!ready.current) return;

    if (suppressPush.current) {
      suppressPush.current = false;
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const qs = analyticsParamsToQuery(state);
      window.history.pushState(null, '', qs ? `/${qs}` : '/');
      if (qs !== lastFetchedQs.current) {
        clearPeriod();
        void fetchData(state);
      }
    }, 100);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [state, fetchData, clearPeriod]);

  const replaceState = (next: AnalyticsFilterParams) => {
    suppressPush.current = false;
    setState(next);
  };

  const onFilterChange = (patch: Partial<AnalyticsFilterParams>) => {
    replaceState({ ...state, ...patch });
  };

  const resetFilters = () => {
    replaceState({ trend_grain: 'month' });
  };

  const onRefresh = () => {
    clearPeriod();
    void fetchData(state);
  };

  const onPeriodSelect = (periodKey: string, label: string) => {
    void fetchPeriodDetail(periodKey, label, state);
  };

  const filterOptions = data?.filter_options ?? { projects: [], years: [] };
  const scopeHint = data?.meta.scope_hint;
  const grain = state.trend_grain ?? data?.meta.trend_grain ?? 'month';

  return (
    <main className="bb-analytics">
      <header className="bb-analytics-header">
        <div>
          <h1>Defect Analytics Dashboard</h1>
          <p>Trends and summary metrics for bugs and defects</p>
        </div>
        <div className="bb-analytics-toolbar">
          <span className="bb-analytics-updated">
            Last Updated: {formatLastUpdated(data?.meta.last_updated ?? null)}
          </span>
          <a
            className="btn btn-outline"
            href={`/api/analytics/export/csv${analyticsParamsToQuery(state)}`}
            download
          >
            Export CSV
          </a>
          <button type="button" className="btn btn-outline" onClick={onRefresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="settings-alert settings-alert--error">
          <span>{error}</span>
          <button
            type="button"
            className="settings-alert__close"
            aria-label="Dismiss"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      <AnalyticsFilters
        state={state}
        options={filterOptions}
        scope_hint={scopeHint}
        onChange={onFilterChange}
        onReset={resetFilters}
      />

      <section className="bb-analytics-chart-card">
        <h2>{grainTitle(grain)}</h2>
        <TrendChart
          trends={data?.trends ?? null}
          loading={loading}
          onPeriodSelect={onPeriodSelect}
        />
      </section>

      <section className="bb-analytics-chart-card">
        <h2>Inflow vs Outflow</h2>
        <InflowOutflowChart
          trends={data?.trends ?? null}
          loading={loading}
          onPeriodSelect={onPeriodSelect}
        />
      </section>

      <PeriodDetailPanel
        detail={periodDetail}
        label={periodLabel}
        loading={periodLoading}
        error={periodError}
        onClose={clearPeriod}
      />

      <SummaryCards summary={data?.summary ?? null} loading={loading} />
      <RiskPanel summary={data?.summary ?? null} loading={loading} />
      <MttrPanel summary={data?.summary ?? null} loading={loading} />
      <TriagePanel summary={data?.summary ?? null} loading={loading} />
      <DistributionPanel
        summary={data?.summary ?? null}
        loading={loading}
        year={state.year ? String(state.year) : 'all'}
      />
      <SquadHeatPanel summary={data?.summary ?? null} loading={loading} />
      <QaSlipPanel rows={data?.qa_slip ?? []} loading={loading} />

      <CostQualityPanel
        summary={data?.summary ?? null}
        trends={data?.trends ?? null}
        loading={loading}
      />
    </main>
  );
}
