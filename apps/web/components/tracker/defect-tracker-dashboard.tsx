'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TrackerEditableField,
  TrackerFilterParams,
  TrackerIssueRow,
  TrackerTab,
} from '@momus/domain';
import { apiJson } from '@/lib/api-client';
import { trackerParamsFromUrl, trackerParamsToQuery } from '@/lib/tracker-params';
import { TrackerFilters } from './tracker-filters';
import { TrackerTable } from './tracker-table';
import { TrackerTabs } from './tracker-tabs';

type TrackerResponse = {
  success: boolean;
  message?: string;
  rows: TrackerIssueRow[];
  total: number;
  page: number;
  page_size: number;
  tab_counts: Record<TrackerTab, number>;
  filter_options: { projects: string[]; years: number[] };
  jira_browse_base: string;
  meta: { scope_hint: string };
};

type PatchResponse = {
  success: boolean;
  message?: string;
  row: TrackerIssueRow;
};

const DEFAULT_STATE: TrackerFilterParams = {
  tab: 'all',
  page: 1,
  page_size: 50,
};

function parseTrackerQuery(sp: URLSearchParams): TrackerFilterParams {
  return trackerParamsFromUrl(new URL(`http://local?${sp.toString()}`));
}

export function DefectTrackerDashboard() {
  const [state, setState] = useState<TrackerFilterParams>(DEFAULT_STATE);
  const [rows, setRows] = useState<TrackerIssueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<TrackerTab, number>>({
    all: 0,
    missing_fields: 0,
    no_linked_test: 0,
  });
  const [filterOptions, setFilterOptions] = useState<{ projects: string[]; years: number[] }>({
    projects: [],
    years: [],
  });
  const [jiraBrowseBase, setJiraBrowseBase] = useState('');
  const [scopeHint, setScopeHint] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ready = useRef(false);
  const lastFetchedQs = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const suppressPush = useRef(false);

  const fetchData = useCallback(async (next: TrackerFilterParams) => {
    const qs = trackerParamsToQuery(next);
    lastFetchedQs.current = qs;
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<TrackerResponse>(`/api/tracker${qs}`);
      if (!res.success) {
        setError(res.message ?? 'Failed to load tracker data');
        return;
      }
      setRows(res.rows);
      setTotal(res.total);
      setTabCounts(res.tab_counts);
      setFilterOptions(res.filter_options);
      setJiraBrowseBase(res.jira_browse_base ?? '');
      setScopeHint(res.meta?.scope_hint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracker data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = parseTrackerQuery(new URLSearchParams(window.location.search));
    suppressPush.current = true;
    setState(initial);
    ready.current = true;
    void fetchData(initial);

    const onPop = () => {
      const parsed = parseTrackerQuery(new URLSearchParams(window.location.search));
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
      const qs = trackerParamsToQuery(state);
      window.history.pushState(null, '', `/tracker${qs}`);
      if (qs !== lastFetchedQs.current) {
        void fetchData(state);
      }
    }, 100);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [state, fetchData]);

  const replaceState = (next: TrackerFilterParams) => {
    suppressPush.current = false;
    setState(next);
  };

  const onFilterChange = (patch: Partial<TrackerFilterParams>) => {
    replaceState({ ...state, ...patch });
  };

  const onTabChange = (tab: TrackerTab) => {
    replaceState({ ...state, tab, page: 1 });
  };

  const resetFilters = () => {
    replaceState({ ...DEFAULT_STATE, page_size: state.page_size ?? 50 });
  };

  const onRefresh = () => {
    void fetchData(state);
  };

  const onPageChange = (page: number) => {
    replaceState({ ...state, page });
  };

  const onPageSizeChange = (page_size: number) => {
    replaceState({ ...state, page_size, page: 1 });
  };

  const onRowUpdated = (row: TrackerIssueRow) => {
    setRows((prev) => prev.map((r) => (r.jira_key === row.jira_key ? row : r)));
  };

  const patchField = async (
    jiraKey: string,
    field: TrackerEditableField,
    value: unknown,
  ): Promise<{ ok: true; row: TrackerIssueRow } | { ok: false; message: string }> => {
    const res = await apiJson<PatchResponse>(`/api/tracker/${encodeURIComponent(jiraKey)}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.success) {
      return { ok: false, message: res.message ?? 'Failed to update issue' };
    }
    onRowUpdated(res.row);
    return { ok: true, row: res.row };
  };

  const page = state.page ?? 1;
  const pageSize = state.page_size ?? 50;
  const activeTab = state.tab ?? 'all';

  return (
    <main className="bb-dash">
      <header className="bb-dash-header">
        <div>
          <h1>Defect Tracker</h1>
          <p>Review and edit Momus-owned tracker fields for bugs and defects</p>
        </div>
        <div className="bb-dash-toolbar">
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

      <TrackerFilters
        state={state}
        options={filterOptions}
        scope_hint={scopeHint}
        onChange={onFilterChange}
        onReset={resetFilters}
      />

      <TrackerTabs active={activeTab} counts={tabCounts} onChange={onTabChange} />

      <TrackerTable
        rows={rows}
        total={total}
        page={page}
        page_size={pageSize}
        loading={loading}
        jiraBrowseBase={jiraBrowseBase}
        showMissingBadges={activeTab === 'missing_fields'}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onPatchField={patchField}
      />
    </main>
  );
}
