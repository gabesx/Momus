'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LeaderboardDrillContext,
  LeaderboardFilterParams,
  LeaderboardPeriodType,
  LeaderboardResult,
  ReporterRank,
} from '@momus/domain';
import { apiJson } from '@/lib/api-client';
import { leaderboardParamsFromUrl, leaderboardParamsToQuery } from '@/lib/leaderboard-params';

type LeaderboardResponse = LeaderboardResult & {
  success: boolean;
  message?: string;
  filter_options: {
    years: number[];
    period_types: { value: string; label: string }[];
  };
};

type DrillIssue = {
  jira_key?: string | null;
  summary?: string | null;
  status?: string | null;
  project?: string | null;
  issue_type?: string | null;
  severity_issue?: string | null;
  created_date?: string | null;
  jira_url?: string | null;
};

function RankTable({
  title,
  ranks,
  onSelect,
}: {
  title: string;
  ranks: ReporterRank[];
  onSelect: (reporter: string) => void;
}) {
  return (
    <section className="settings-card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {!ranks.length ? (
        <p className="muted">No reporters in this view.</p>
      ) : (
        <div className="bb-table-wrap">
          <table className="bb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Reporter</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map((r, i) => (
                <tr key={r.reporter} onClick={() => onSelect(r.reporter)}>
                  <td>{i + 1}</td>
                  <td>{r.reporter}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function LeaderboardDashboard() {
  const [state, setState] = useState<LeaderboardFilterParams>({
    period_type: 'quarterly',
  });
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drillReporter, setDrillReporter] = useState<string | null>(null);
  const [drillContext, setDrillContext] = useState<LeaderboardDrillContext>('global');
  const [drillGroup, setDrillGroup] = useState<string | null>(null);
  const [drillIssues, setDrillIssues] = useState<DrillIssue[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const ready = useRef(false);
  const lastFetchedQs = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const suppressPush = useRef(false);

  const fetchData = useCallback(async (next: LeaderboardFilterParams) => {
    const qs = leaderboardParamsToQuery(next);
    lastFetchedQs.current = qs;
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<LeaderboardResponse>(`/api/leaderboard${qs}`);
      if (!res.success) {
        setError(res.message ?? 'Failed to load leaderboard');
        return;
      }
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const openDrill = async (
    reporter: string,
    context: LeaderboardDrillContext = 'global',
    group: string | null = null,
  ) => {
    setDrillReporter(reporter);
    setDrillContext(context);
    setDrillGroup(group);
    setDrillLoading(true);
    try {
      const qs = new URLSearchParams(leaderboardParamsToQuery(state).replace(/^\?/, ''));
      qs.set('reporter', reporter);
      qs.set('context', context);
      if (group) qs.set('group', group);
      const res = await apiJson<{ success: boolean; issues?: DrillIssue[]; message?: string }>(
        `/api/leaderboard/reporter-issues?${qs.toString()}`,
      );
      if (!res.success) {
        setError(res.message ?? 'Failed to load reporter issues');
        setDrillIssues([]);
        return;
      }
      setDrillIssues(res.issues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reporter issues');
      setDrillIssues([]);
    } finally {
      setDrillLoading(false);
    }
  };

  useEffect(() => {
    const initial = leaderboardParamsFromUrl(
      new URL(`http://local${window.location.search}`),
    );
    if (!initial.period_type) initial.period_type = 'quarterly';
    suppressPush.current = true;
    setState(initial);
    ready.current = true;
    void fetchData(initial);

    const onPop = () => {
      const parsed = leaderboardParamsFromUrl(
        new URL(`http://local${window.location.search}`),
      );
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
      const qs = leaderboardParamsToQuery(state);
      window.history.pushState(null, '', qs ? `/leaderboard${qs}` : '/leaderboard');
      if (qs !== lastFetchedQs.current) void fetchData(state);
    }, 100);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [state, fetchData]);

  const periodType = (state.period_type ?? 'quarterly') as LeaderboardPeriodType;
  const years = data?.filter_options.years ?? [];
  const year = state.year ? String(state.year) : years[0] ? String(years[0]) : '';

  return (
    <main className="bb-analytics">
      <header className="bb-analytics-header">
        <div>
          <h1>Leaderboard</h1>
          <p>Reporter rankings for bugs and defects by period</p>
        </div>
        <div className="bb-analytics-toolbar">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void fetchData(state)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="settings-alert settings-alert--error">
          <span>{error}</span>
          <button type="button" className="settings-alert__close" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      ) : null}

      <section className="settings-card bb-analytics-filters">
        <div className="bb-analytics-filter-grid">
          <label className="field">
            Period type
            <select
              value={periodType}
              onChange={(e) =>
                setState({
                  ...state,
                  period_type: e.target.value as LeaderboardPeriodType,
                  period: undefined,
                })
              }
            >
              {(data?.filter_options.period_types ?? []).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {periodType !== 'all' ? (
            <label className="field">
              Year
              <select
                value={year}
                onChange={(e) => setState({ ...state, year: e.target.value || undefined })}
              >
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {periodType === 'quarterly' ? (
            <label className="field">
              Quarter
              <select
                value={state.period ?? data?.meta.period ?? 'Q2'}
                onChange={(e) => setState({ ...state, period: e.target.value })}
              >
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </label>
          ) : null}
          {periodType === 'semester' ? (
            <label className="field">
              Semester
              <select
                value={state.period ?? data?.meta.period ?? 'H1'}
                onChange={(e) => setState({ ...state, period: e.target.value })}
              >
                <option value="H1">H1 (Jan–Jun)</option>
                <option value="H2">H2 (Jul–Dec)</option>
              </select>
            </label>
          ) : null}
        </div>
        {data?.meta ? (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            {data.meta.period_type}
            {data.meta.start ? ` · ${data.meta.start} → ${data.meta.end}` : ' · all time'}
          </p>
        ) : null}
      </section>

      {loading && !data ? (
        <div className="bb-analytics-metrics">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bb-skeleton" style={{ minHeight: 88 }} />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="bb-analytics-metrics" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <div className="bb-analytics-metric-card bb-analytics-metric-card--primary">
              <div className="bb-analytics-metric-card__label">Total Issues</div>
              <div className="bb-analytics-metric-card__value">{data.summary.total_issues}</div>
            </div>
            <div className="bb-analytics-metric-card bb-analytics-metric-card--info">
              <div className="bb-analytics-metric-card__label">Reporters</div>
              <div className="bb-analytics-metric-card__value">{data.summary.unique_reporters}</div>
            </div>
            <div className="bb-analytics-metric-card bb-analytics-metric-card--success">
              <div className="bb-analytics-metric-card__label">Accepted</div>
              <div className="bb-analytics-metric-card__value">{data.summary.accepted_count}</div>
            </div>
            <div className="bb-analytics-metric-card bb-analytics-metric-card--danger">
              <div className="bb-analytics-metric-card__label">Rejected</div>
              <div className="bb-analytics-metric-card__value">{data.summary.rejected_count}</div>
            </div>
          </div>

          <div className="bb-analytics-period-detail__grids" style={{ marginBottom: '1rem' }}>
            <RankTable
              title="Global"
              ranks={data.global}
              onSelect={(r) => void openDrill(r, 'global')}
            />
            <RankTable
              title="Accepted"
              ranks={data.accepted}
              onSelect={(r) => void openDrill(r, 'accepted')}
            />
            <RankTable
              title="Rejected"
              ranks={data.rejected}
              onSelect={(r) => void openDrill(r, 'rejected')}
            />
            <RankTable
              title="Bugs"
              ranks={data.by_issue_type.Bug ?? []}
              onSelect={(r) => void openDrill(r, 'issue_type', 'Bug')}
            />
            <RankTable
              title="Defects"
              ranks={data.by_issue_type.Defect ?? []}
              onSelect={(r) => void openDrill(r, 'issue_type', 'Defect')}
            />
          </div>

          <section className="settings-card">
            <h3 style={{ marginTop: 0 }}>By project</h3>
            {!data.by_project.length ? (
              <p className="muted">No project data.</p>
            ) : (
              <div className="bb-table-wrap">
                <table className="bb-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Total</th>
                      <th>Top reporter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_project.slice(0, 20).map((p) => (
                      <tr key={p.project}>
                        <td>{p.project}</td>
                        <td>{p.total}</td>
                        <td>
                          {p.reporters[0] ? (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => void openDrill(p.reporters[0]!.reporter, 'project', p.project)}
                            >
                              {p.reporters[0].reporter} ({p.reporters[0].count})
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {drillReporter ? (
        <section className="bb-analytics-chart-card" style={{ marginTop: '1rem' }}>
          <div className="bb-analytics-period-detail__header">
            <h2>
              {drillReporter}
              {drillContext !== 'global' ? ` · ${drillContext}` : ''}
              {drillGroup ? ` · ${drillGroup}` : ''}
            </h2>
            <button type="button" className="btn btn-outline" onClick={() => setDrillReporter(null)}>
              Close
            </button>
          </div>
          {drillLoading ? <div className="bb-skeleton" style={{ minHeight: 120 }} /> : null}
          {!drillLoading && !drillIssues.length ? <p className="muted">No issues.</p> : null}
          {!drillLoading && drillIssues.length ? (
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Summary</th>
                    <th>Status</th>
                    <th>Project</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {drillIssues.map((i) => (
                    <tr key={i.jira_key ?? `${i.summary}-${i.created_date}`}>
                      <td>
                        {i.jira_url ? (
                          <a href={i.jira_url} target="_blank" rel="noopener noreferrer">
                            {i.jira_key}
                          </a>
                        ) : (
                          i.jira_key
                        )}
                      </td>
                      <td>{i.summary}</td>
                      <td>{i.status}</td>
                      <td>{i.project}</td>
                      <td>{i.created_date?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
