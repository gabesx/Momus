'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyStatCardPatch,
  type DashboardQueryState,
  type StatCardId,
} from '@momus/domain';
import { MESSAGES } from '@momus/shared';
import { apiJson } from '@/lib/api-client';
import {
  defaultVisibleColumns,
  loadVisibleColumns,
  type ColumnId,
} from '@/lib/bug-budget-columns';
import type { BugBudgetListResponse } from '@/lib/bug-budget-types';
import {
  countActiveFilters,
  parseDashboardQuery,
  toQueryString,
} from '@/lib/bug-budget-url';
import { ColumnVisibilityModal } from './column-visibility-modal';
import { DashboardHeader } from './dashboard-header';
import { FilterPanel } from './filter-panel';
import { IssuesTable } from './issues-table';
import { ScopeBanner } from './scope-banner';
import { SeverityPanel } from './severity-panel';
import { StatCards } from './stat-cards';
import { SummaryModal } from './summary-modal';

function tableStateKeys(state: DashboardQueryState): DashboardQueryState {
  const next: DashboardQueryState = {};
  if (state.per_page) next.per_page = state.per_page;
  if (state.sort) next.sort = state.sort;
  if (state.direction) next.direction = state.direction;
  return next;
}

export function BugBudgetDashboard() {
  const [state, setState] = useState<DashboardQueryState>({});
  const [data, setData] = useState<BugBudgetListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visible, setVisible] = useState<Record<ColumnId, boolean>>(defaultVisibleColumns);
  const [toast, setToast] = useState<string | null>(null);
  const [bugSummaryOpen, setBugSummaryOpen] = useState(false);
  const [defectSummaryOpen, setDefectSummaryOpen] = useState(false);

  const ready = useRef(false);
  const lastFetchedQs = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const suppressPush = useRef(false);

  const fetchData = useCallback(async (next: DashboardQueryState) => {
    const qs = toQueryString(next);
    lastFetchedQs.current = qs;
    setLoading(true);
    setError(null);
    const res = await apiJson<BugBudgetListResponse>(`/api/bug-budget${qs}`);
    setLoading(false);
    if (!res.success) {
      setError(res.message ?? 'Failed to load bug budget data');
      return;
    }
    setData(res);
  }, []);

  useEffect(() => {
    const initial = parseDashboardQuery(new URLSearchParams(window.location.search));
    setVisible(loadVisibleColumns());
    suppressPush.current = true;
    setState(initial);
    ready.current = true;
    void fetchData(initial);

    const onPop = () => {
      const parsed = parseDashboardQuery(new URLSearchParams(window.location.search));
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
      window.history.pushState(null, '', `/bug-budget${qs}`);
      if (qs !== lastFetchedQs.current) {
        void fetchData(state);
      }
    }, 100);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [state, fetchData]);

  const replaceState = (next: DashboardQueryState) => {
    suppressPush.current = false;
    setState(next);
  };

  const resetFilters = () => {
    replaceState(tableStateKeys(state));
  };

  const onStat = (id: StatCardId) => {
    replaceState(applyStatCardPatch(state, id, new Date().toISOString()));
  };

  const exportHref = `/api/bug-budget/export/csv${toQueryString(state)}`;
  const activeCount = data?.active_filter_count ?? countActiveFilters(state);

  return (
    <main className="bb-dash">
      <DashboardHeader
        onOpenBug={() => setBugSummaryOpen(true)}
        onOpenDefect={() => setDefectSummaryOpen(true)}
        onColumns={() => setColumnsOpen(true)}
        exportHref={exportHref}
      />

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

      <ScopeBanner
        activeFilterCount={activeCount}
        filteredTotal={data?.pagination.total ?? 0}
        databaseTotal={data?.database_total ?? 0}
        onViewAll={resetFilters}
      />

      <StatCards stats={data?.stats ?? null} loading={loading} onSelect={onStat} />
      <SeverityPanel breakdown={data?.stats.severity_breakdown} />

      <FilterPanel
        state={state}
        options={data?.filter_options ?? null}
        activeCount={activeCount}
        open={filtersOpen}
        onToggle={() => setFiltersOpen((v) => !v)}
        onChange={replaceState}
        onReset={resetFilters}
      />

      <IssuesTable
        issues={data?.issues ?? []}
        pagination={data?.pagination ?? null}
        jiraBrowseBase={data?.jira_browse_base ?? ''}
        visible={visible}
        state={state}
        loading={loading}
        notice={data?.notice}
        onChange={replaceState}
        onClearFilters={resetFilters}
        exportHref={exportHref}
      />

      <ColumnVisibilityModal
        open={columnsOpen}
        initial={visible}
        onClose={() => setColumnsOpen(false)}
        onApplied={(vis) => {
          setVisible(vis);
          setToast(MESSAGES.M04);
          window.setTimeout(() => setToast(null), 4000);
        }}
      />

      <SummaryModal
        kind="bug"
        open={bugSummaryOpen}
        onClose={() => setBugSummaryOpen(false)}
        initialYear={state.year ?? String(new Date().getFullYear())}
        jiraBrowseBase={data?.jira_browse_base ?? ''}
      />
      <SummaryModal
        kind="defect"
        open={defectSummaryOpen}
        onClose={() => setDefectSummaryOpen(false)}
        initialYear={state.year ?? String(new Date().getFullYear())}
        jiraBrowseBase={data?.jira_browse_base ?? ''}
      />

      {toast ? <div className="bb-toast">{toast}</div> : null}
    </main>
  );
}
