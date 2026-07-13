'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TrackerEditableField,
  TrackerFilterParams,
  TrackerIssueRow,
  TrackerTab,
} from '@momus/domain';
import { apiJson } from '@/lib/api-client';
import {
  trackerDefaultYear,
  trackerParamsFromUrl,
  trackerParamsToQuery,
} from '@/lib/tracker-params';
import {
  TrackerActiveChips,
  TrackerFilters,
  TrackerProjectNav,
} from './tracker-filters';
import { TrackerFieldSettingsModal } from './tracker-field-settings-modal';
import { TrackerTable } from './tracker-table';
import { TrackerTabs } from './tracker-tabs';

type ProjectCount = { project: string; count: number };
type FieldOption = { id: string; value: string };
type MissingFieldOption = { value: string; label: string };

type TrackerResponse = {
  success: boolean;
  message?: string;
  rows: TrackerIssueRow[];
  total: number;
  page: number;
  page_size: number;
  tab_counts: Record<TrackerTab, number>;
  project_counts?: ProjectCount[];
  filter_options: {
    projects: string[];
    years: number[];
    missing_fields?: MissingFieldOption[];
  };
  excluded_fields?: string[];
  jira_browse_base: string;
  meta: {
    scope_hint: string;
    last_updated?: string;
    last_updated_label?: string;
  };
};

type FieldOptionsResponse = {
  success: boolean;
  message?: string;
  options?: FieldOption[];
};

type PatchResponse = {
  success: boolean;
  message?: string;
  row: TrackerIssueRow;
};

const DEFAULT_STATE: TrackerFilterParams = {
  tab: 'missing_fields',
  year: String(trackerDefaultYear()),
  page: 1,
  page_size: 50,
};

function parseTrackerQuery(sp: URLSearchParams): TrackerFilterParams {
  const parsed = trackerParamsFromUrl(new URL(`http://local?${sp.toString()}`));
  if (!parsed.tab) parsed.tab = 'missing_fields';
  return parsed;
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
  const [projectCounts, setProjectCounts] = useState<ProjectCount[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    projects: string[];
    years: number[];
    missing_fields?: MissingFieldOption[];
  }>({
    projects: [],
    years: [],
    missing_fields: [],
  });
  const [excludedFields, setExcludedFields] = useState<string[]>([]);
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false);
  const [jiraBrowseBase, setJiraBrowseBase] = useState('');
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string | undefined>();
  const [severityOptions, setSeverityOptions] = useState<FieldOption[]>([]);
  const [serviceFeatureOptions, setServiceFeatureOptions] = useState<FieldOption[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<TrackerFilterParams>(DEFAULT_STATE);
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
      setProjectCounts(res.project_counts ?? []);
      setFilterOptions(res.filter_options);
      setExcludedFields(res.excluded_fields ?? []);
      setJiraBrowseBase(res.jira_browse_base ?? '');
      setLastUpdatedLabel(res.meta?.last_updated_label);
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
    setFilterDraft(initial);
    ready.current = true;
    void fetchData(initial);

    void (async () => {
      const [severityRes, serviceRes] = await Promise.all([
        apiJson<FieldOptionsResponse>('/api/tracker/field-options?field=severity_issue'),
        apiJson<FieldOptionsResponse>('/api/tracker/field-options?field=service_feature'),
      ]);
      if (severityRes.success) setSeverityOptions(severityRes.options ?? []);
      if (serviceRes.success) setServiceFeatureOptions(serviceRes.options ?? []);
    })();

    const onPop = () => {
      const parsed = parseTrackerQuery(new URLSearchParams(window.location.search));
      suppressPush.current = true;
      setState(parsed);
      setFilterDraft(parsed);
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
    setFilterDraft(next);
  };

  const onFilterChange = (patch: Partial<TrackerFilterParams>) => {
    replaceState({ ...state, ...patch });
  };

  const openFilters = () => {
    setFilterDraft(state);
    setFiltersOpen((v) => !v);
  };

  const onDraftChange = (patch: Partial<TrackerFilterParams>) => {
    setFilterDraft((prev) => ({ ...prev, ...patch }));
  };

  const applyFilters = () => {
    // Always refetch on Apply — even if URL params are unchanged.
    lastFetchedQs.current = null;
    replaceState({
      ...state,
      ...filterDraft,
      tab: state.tab,
      page: 1,
      page_size: state.page_size ?? 50,
    });
  };

  const onTabChange = (tab: TrackerTab) => {
    replaceState({ ...state, tab, page: 1 });
  };

  const resetFilters = () => {
    const next = {
      ...DEFAULT_STATE,
      tab: state.tab ?? 'missing_fields',
      page_size: state.page_size ?? 50,
      exclude_projects: undefined,
      project: undefined,
    };
    setFilterDraft(next);
    replaceState(next);
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

  const removeChip = (
    key:
      | 'year'
      | 'issue_type'
      | 'missing_field'
      | 'q'
      | 'project'
      | 'exclude_projects'
      | 'squad'
      | 'service'
      | 'engineer',
  ) => {
    if (key === 'year') {
      onFilterChange({ year: 'all', page: 1 });
      return;
    }
    if (key === 'exclude_projects') {
      onFilterChange({ exclude_projects: undefined, page: 1 });
      return;
    }
    onFilterChange({ [key]: undefined, page: 1 });
  };

  const onFieldSettingsSaved = (excluded: string[]) => {
    setExcludedFields(excluded);
    // Clear missing_field filter if it was excluded
    if (state.missing_field && excluded.includes(state.missing_field)) {
      replaceState({ ...state, missing_field: undefined, page: 1 });
    } else {
      void fetchData(state);
    }
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
    void fetchData(state);
    return { ok: true, row: res.row };
  };

  const page = state.page ?? 1;
  const pageSize = state.page_size ?? 50;
  const activeTab = state.tab ?? 'missing_fields';
  const incompleteCount = tabCounts.missing_fields ?? 0;
  const projectNavTotal = projectCounts.reduce((sum, p) => sum + p.count, 0);

  const defaultYear = String(trackerDefaultYear());
  const hasActiveFilters = Boolean(
    (state.year && state.year !== defaultYear) ||
      state.issue_type ||
      state.missing_field ||
      state.q ||
      state.project ||
      state.squad ||
      state.service ||
      state.engineer ||
      (state.exclude_projects && state.exclude_projects.length > 0),
  );

  return (
    <main className="bb-tracker">
      <header className="bb-tracker-header">
        <div className="bb-tracker-header__text">
          <h1>Bug Defect Tracker</h1>
          <p>Incomplete fields, descriptions, and test execution links</p>
        </div>
        <div className="bb-tracker-header__stats">
          <div className="bb-tracker-stat">
            <span className="bb-tracker-stat__number">{incompleteCount}</span>
            <span className="bb-tracker-stat__label">Incomplete Issues</span>
          </div>
          {lastUpdatedLabel ? (
            <div className="bb-tracker-freshness">
              <span className="muted">Last Updated:</span> {lastUpdatedLabel}
            </div>
          ) : null}
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

      <section className="bb-tracker-toolbar-card">
        <div className="bb-tracker-toolbar">
          <div className="bb-tracker-toolbar__left">
            <TrackerTabs active={activeTab} counts={tabCounts} onChange={onTabChange} />
            <TrackerActiveChips state={state} onRemove={removeChip} />
          </div>
          <div className="bb-tracker-toolbar__right">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setFieldSettingsOpen(true)}
            >
              Field Settings
            </button>
            <button
              type="button"
              className={`btn btn-outline${hasActiveFilters ? ' is-active-filter' : ''}`}
              onClick={openFilters}
            >
              Filters
            </button>
          </div>
        </div>

        <TrackerFilters
          draft={filterDraft}
          options={filterOptions}
          open={filtersOpen}
          onDraftChange={onDraftChange}
          onApply={applyFilters}
          onReset={resetFilters}
        />
      </section>

      <TrackerProjectNav
        projects={projectCounts}
        active={state.project}
        total={projectNavTotal || total}
        onSelect={(project) => onFilterChange({ project, page: 1 })}
      />

      <TrackerTable
        rows={rows}
        total={total}
        page={page}
        page_size={pageSize}
        loading={loading}
        jiraBrowseBase={jiraBrowseBase}
        view={activeTab}
        excludedFields={excludedFields}
        severityOptions={severityOptions}
        serviceFeatureOptions={serviceFeatureOptions}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onPatchField={patchField}
      />

      <TrackerFieldSettingsModal
        open={fieldSettingsOpen}
        excludedFields={excludedFields}
        onClose={() => setFieldSettingsOpen(false)}
        onSaved={onFieldSettingsSaved}
      />
    </main>
  );
}
