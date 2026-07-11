'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  AnalyticsFilterParams,
  AnalyticsSummaryResult,
  AnalyticsTrendsResult,
} from '@momus/domain';
import { apiJson } from '@/lib/api-client';
import { analyticsParamsFromUrl } from '@/lib/analytics-params';
import { AnalyticsFilters } from './analytics-filters';
import { SummaryCards } from './summary-cards';
import { TrendChart } from './trend-chart';

type AnalyticsResponse = {
  success: boolean;
  message?: string;
  summary: AnalyticsSummaryResult;
  trends: AnalyticsTrendsResult;
  filter_options: { projects: string[]; years: number[] };
  meta: { last_updated: string | null; scope_hint: string };
};

function parseAnalyticsQuery(sp: URLSearchParams): AnalyticsFilterParams {
  return analyticsParamsFromUrl(new URL(`http://local?${sp.toString()}`));
}

function toQueryString(state: AnalyticsFilterParams): string {
  const sp = new URLSearchParams();
  if (state.year) sp.set('year', String(state.year));
  if (state.project) sp.set('project', state.project);
  if (state.issue_type) sp.set('issue_type', state.issue_type);
  if (state.status) sp.set('status', state.status);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function formatLastUpdated(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function DefectAnalyticsDashboard() {
  const [state, setState] = useState<AnalyticsFilterParams>({});
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ready = useRef(false);
  const lastFetchedQs = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const suppressPush = useRef(false);

  const fetchData = useCallback(async (next: AnalyticsFilterParams) => {
    const qs = toQueryString(next);
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

  useEffect(() => {
    const initial = parseAnalyticsQuery(new URLSearchParams(window.location.search));
    suppressPush.current = true;
    setState(initial);
    ready.current = true;
    void fetchData(initial);

    const onPop = () => {
      const parsed = parseAnalyticsQuery(new URLSearchParams(window.location.search));
      suppressPush.current = true;
      setState(parsed);
      void fetchData(parsed);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [fetchData]);

  useEffect(() => {
    if (!ready.current) return;

    if (suppressPush.current) {
      suppressPush.current = false;
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const qs = toQueryString(state);
      window.history.pushState(null, '', qs ? `/${qs}` : '/');
      if (qs !== lastFetchedQs.current) {
        void fetchData(state);
      }
    }, 100);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [state, fetchData]);

  const replaceState = (next: AnalyticsFilterParams) => {
    suppressPush.current = false;
    setState(next);
  };

  const onFilterChange = (patch: Partial<AnalyticsFilterParams>) => {
    replaceState({ ...state, ...patch });
  };

  const resetFilters = () => {
    replaceState({});
  };

  const onRefresh = () => {
    void fetchData(state);
  };

  const filterOptions = data?.filter_options ?? { projects: [], years: [] };
  const scopeHint = data?.meta.scope_hint;

  return (
    <main className="bb-analytics">
      <header className="bb-analytics-header">
        <div>
          <h1>Defect Analytics Dashboard</h1>
          <p>Monthly trends and summary metrics for bugs and defects</p>
        </div>
        <div className="bb-analytics-toolbar">
          <span className="bb-analytics-updated">
            Last Updated: {formatLastUpdated(data?.meta.last_updated ?? null)}
          </span>
          <Link className="btn btn-outline" href="/bug-budget">
            Bug Budget
          </Link>
          <Link className="btn btn-outline" href="/settings/atlassian#bug-budget">
            Settings
          </Link>
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
        year={state.year ? String(state.year) : ''}
        project={state.project ?? ''}
        issue_type={(state.issue_type as '' | 'bugs' | 'defects') ?? ''}
        status={(state.status as '' | 'open' | 'in-progress' | 'resolved' | 'closed') ?? ''}
        options={filterOptions}
        scope_hint={scopeHint}
        onChange={onFilterChange}
        onReset={resetFilters}
      />

      <SummaryCards summary={data?.summary ?? null} loading={loading} />

      <section className="bb-analytics-chart-card">
        <h2>Monthly Trends</h2>
        <TrendChart trends={data?.trends ?? null} loading={loading} />
      </section>
    </main>
  );
}
