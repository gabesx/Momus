'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AcLabelMatrixRow,
  IncompleteFieldBlock,
  IncompleteReporterRank,
  LeaderboardDrillContext,
  LeaderboardFilterParams,
  LeaderboardPeriodType,
  LeaderboardResult,
  ProjectLeaderboardBlock,
  ReporterRank,
} from '@momus/domain';
import { apiJson } from '@/lib/api-client';
import { leaderboardParamsFromUrl, leaderboardParamsToQuery } from '@/lib/leaderboard-params';
import type { LeaderboardPayload } from '@/lib/load-leaderboard';

type LeaderboardTab =
  | 'global'
  | 'issue_type'
  | 'ac_label'
  | 'project'
  | 'accepted'
  | 'rejected'
  | 'incomplete';

type LeaderboardResponse = LeaderboardResult & {
  success?: boolean;
  message?: string;
  filter_options: {
    years: number[];
    period_types: { value: string; label: string }[];
  };
};

type LeaderboardDashboardProps = {
  initialData?: LeaderboardPayload | LeaderboardResponse | null;
  initialParams?: LeaderboardFilterParams;
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
  missing_fields?: string[];
  missing_field_labels?: string[];
};

const TABS: { id: LeaderboardTab; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'issue_type', label: 'By Issue Type' },
  { id: 'ac_label', label: 'AC vs Non-AC' },
  { id: 'project', label: 'By Project' },
  { id: 'accepted', label: 'Most Accepted' },
  { id: 'rejected', label: 'Most Rejected' },
  { id: 'incomplete', label: 'Incomplete Fields' },
];

const QUARTER_LABELS: Record<string, string> = {
  Q1: 'Q1 (Jan–Mar)',
  Q2: 'Q2 (Apr–Jun)',
  Q3: 'Q3 (Jul–Sep)',
  Q4: 'Q4 (Oct–Dec)',
};

function periodBannerTitle(meta: LeaderboardResult['meta'] | undefined): string {
  if (!meta) return '—';
  if (meta.period_type === 'all') return 'All Time';
  if (meta.period_type === 'yearly') return String(meta.year);
  if (meta.period_type === 'semester') {
    return `${meta.period} ${meta.year}`;
  }
  return `${meta.period} ${meta.year}`;
}

function periodBannerSubtitle(meta: LeaderboardResult['meta'] | undefined): string {
  if (!meta) return 'Bugs & Defects reported by all users';
  if (meta.period_type === 'all') return 'Bugs & Defects reported by all users';
  if (meta.period_type === 'quarterly') {
    const range = QUARTER_LABELS[meta.period]?.replace(/^Q\d\s*/, '') ?? '';
    return range
      ? `${meta.period} ${meta.year} ${range} · Bugs & Defects`
      : 'Bugs & Defects reported by all users';
  }
  return 'Bugs & Defects reported by all users';
}

const TOP_N = 10;

type DrillModalTab = 'matched' | 'incomplete' | 'all';

function drillMatchedLabel(context: LeaderboardDrillContext, group: string | null): string {
  switch (context) {
    case 'issue_type':
      if (group === 'Defect') return 'Defects';
      if (group === 'Bug') return 'Bugs';
      return 'By Issue Type';
    case 'ac_label':
      return group ? group.replace('|', ' · ') : 'AC vs Non-AC';
    case 'project':
      return group ? `Project: ${group}` : 'By Project';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'incomplete':
      return 'Incomplete';
    case 'incomplete_field':
      return group ? `Missing ${group}` : 'Incomplete';
    case 'global':
    default:
      return 'All Reported';
  }
}

function drillContextSubtitle(context: LeaderboardDrillContext, group: string | null): string {
  switch (context) {
    case 'issue_type':
      return group ? ` · ${group} issues only` : '';
    case 'ac_label':
      return group ? ` · ${group.replace('|', ' ').toLowerCase()} only` : '';
    case 'project':
      return group ? ` · project ${group}` : '';
    case 'accepted':
      return ' · accepted only';
    case 'rejected':
      return ' · rejected only';
    case 'incomplete':
      return ' · incomplete only';
    case 'incomplete_field':
      return group ? ` · missing ${group}` : ' · incomplete only';
    default:
      return '';
  }
}

function RankExpandFooter({
  total,
  showAll,
  onToggle,
}: {
  total: number;
  showAll: boolean;
  onToggle: () => void;
}) {
  if (total <= TOP_N) return null;
  return (
    <div className="bb-lb-rank-card__footer">
      <button type="button" className="btn btn-outline" onClick={onToggle}>
        {showAll ? `Show top ${TOP_N}` : `Show all (${total})`}
      </button>
      <span className="muted">
        {showAll ? `Showing ranks 1–${total}` : `Showing ranks 1–${TOP_N} of ${total}`}
      </span>
    </div>
  );
}

function RankTable({
  title,
  subtitle,
  ranks,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  ranks: ReporterRank[];
  onSelect: (reporter: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? ranks : ranks.slice(0, TOP_N);

  return (
    <section className="bb-lb-rank-card">
      <div className="bb-lb-rank-card__head">
        <h3>{title}</h3>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {!ranks.length ? (
        <p className="muted">No reporters in this view.</p>
      ) : (
        <>
          <div className="bb-table-wrap">
            <table className="bb-table bb-lb-rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Reporter</th>
                  <th className="bb-lb-rank-table__count">Issues</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.reporter}>
                    <td>#{i + 1}</td>
                    <td>
                      <button
                        type="button"
                        className="bb-lb-reporter-link"
                        onClick={() => onSelect(r.reporter)}
                      >
                        {r.reporter}
                      </button>
                    </td>
                    <td className="bb-lb-rank-table__count">
                      <button
                        type="button"
                        className="bb-lb-count-btn"
                        onClick={() => onSelect(r.reporter)}
                        title={`View ${r.count} issues for ${r.reporter}`}
                      >
                        {r.count}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RankExpandFooter
            total={ranks.length}
            showAll={showAll}
            onToggle={() => setShowAll((v) => !v)}
          />
        </>
      )}
    </section>
  );
}

function IncompleteRankTable({
  title,
  subtitle,
  ranks,
  onSelectIncomplete,
  onSelectTotal,
}: {
  title: string;
  subtitle?: string;
  ranks: IncompleteReporterRank[];
  onSelectIncomplete: (reporter: string) => void;
  onSelectTotal: (reporter: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? ranks : ranks.slice(0, TOP_N);

  return (
    <section className="bb-lb-rank-card">
      <div className="bb-lb-rank-card__head">
        <h3>{title}</h3>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {!ranks.length ? (
        <p className="muted">No incomplete reporters in this view.</p>
      ) : (
        <>
          <div className="bb-table-wrap">
            <table className="bb-table bb-lb-rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Reporter</th>
                  <th className="bb-lb-rank-table__count">Incomplete</th>
                  <th className="bb-lb-rank-table__count">Total</th>
                  <th className="bb-lb-rank-table__count">%</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.reporter}>
                    <td>#{i + 1}</td>
                    <td>
                      <button
                        type="button"
                        className="bb-lb-reporter-link"
                        onClick={() => onSelectIncomplete(r.reporter)}
                      >
                        {r.reporter}
                      </button>
                    </td>
                    <td className="bb-lb-rank-table__count">
                      <button
                        type="button"
                        className="bb-lb-count-btn"
                        onClick={() => onSelectIncomplete(r.reporter)}
                        title={`View ${r.incomplete_count} incomplete issues for ${r.reporter}`}
                      >
                        {r.incomplete_count}
                      </button>
                    </td>
                    <td className="bb-lb-rank-table__count">
                      <button
                        type="button"
                        className="bb-lb-count-btn"
                        onClick={() => onSelectTotal(r.reporter)}
                        title={`View all ${r.total_count} issues reported by ${r.reporter}`}
                      >
                        {r.total_count}
                      </button>
                    </td>
                    <td className="bb-lb-rank-table__count">
                      <span className="bb-lb-pct">{r.pct.toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RankExpandFooter
            total={ranks.length}
            showAll={showAll}
            onToggle={() => setShowAll((v) => !v)}
          />
        </>
      )}
    </section>
  );
}

function IncompleteByFieldGrid({
  blocks,
  onSelectIncomplete,
  onSelectTotal,
}: {
  blocks: IncompleteFieldBlock[];
  onSelectIncomplete: (reporter: string, field: string) => void;
  onSelectTotal: (reporter: string) => void;
}) {
  if (!blocks.length) {
    return <p className="muted">No missing-field categories in this period.</p>;
  }
  return (
    <div className="bb-lb-project-grid">
      {blocks.map((block) => (
        <IncompleteRankTable
          key={block.field}
          title={block.label}
          subtitle={`${block.total_incomplete} incomplete · % = incomplete ÷ reporter’s total`}
          ranks={block.reporters}
          onSelectIncomplete={(reporter) => onSelectIncomplete(reporter, block.field)}
          onSelectTotal={onSelectTotal}
        />
      ))}
    </div>
  );
}

function AcMatrixTable({
  rows,
  onSelect,
}: {
  rows: AcLabelMatrixRow[];
  onSelect: (reporter: string, group: string) => void;
}) {
  if (!rows.length) {
    return <p className="muted">No AC label data in this period.</p>;
  }
  const showDefectBoth = rows.some((r) => r.defect_both > 0);
  const showBugBoth = rows.some((r) => r.bug_both > 0);
  const showUnlabeled = rows.some((r) => r.unlabeled > 0);
  const defectCols = 2 + (showDefectBoth ? 1 : 0);
  const bugCols = 2 + (showBugBoth ? 1 : 0);

  const cell = (reporter: string, count: number, group: string) =>
    count > 0 ? (
      <td className="bb-lb-rank-table__count">
        <button
          type="button"
          className="linkish"
          onClick={() => onSelect(reporter, group)}
          title={`View ${group.replace('|', ' · ')} issues`}
        >
          {count}
        </button>
      </td>
    ) : (
      <td className="bb-lb-rank-table__count muted">0</td>
    );

  return (
    <section className="bb-lb-rank-card">
      <div className="bb-lb-section-head">
        <h3>AC vs Non-AC</h3>
        <p className="muted">
          Issues per reporter, split by Defect Group / Bug and AC label
          {showDefectBoth || showBugBoth
            ? ' — “Both” means tagged ac-related AND non-ac-related (needs label cleanup)'
            : ''}
        </p>
      </div>
      <div className="bb-table-wrap">
        <table className="bb-table bb-lb-rank-table">
          <thead>
            <tr>
              <th rowSpan={2}>User</th>
              <th colSpan={defectCols}>Defect Group</th>
              <th colSpan={bugCols}>Bug</th>
              {showUnlabeled ? <th rowSpan={2}>Unlabeled</th> : null}
              <th rowSpan={2} className="bb-lb-rank-table__count">
                Total
              </th>
            </tr>
            <tr>
              <th>AC Related</th>
              <th>Non-ac-related</th>
              {showDefectBoth ? <th>Both</th> : null}
              <th>AC Related</th>
              <th>Non-ac-related</th>
              {showBugBoth ? <th>Both</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.reporter}>
                <td>{r.reporter}</td>
                {cell(r.reporter, r.defect_ac, 'Defect|AC-related')}
                {cell(r.reporter, r.defect_non_ac, 'Defect|Non-AC-related')}
                {showDefectBoth ? cell(r.reporter, r.defect_both, 'Defect|Both labels') : null}
                {cell(r.reporter, r.bug_ac, 'Bug|AC-related')}
                {cell(r.reporter, r.bug_non_ac, 'Bug|Non-AC-related')}
                {showBugBoth ? cell(r.reporter, r.bug_both, 'Bug|Both labels') : null}
                {showUnlabeled ? cell(r.reporter, r.unlabeled, 'Unlabeled') : null}
                <td className="bb-lb-rank-table__count">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProjectBlocks({
  blocks,
  onSelect,
}: {
  blocks: ProjectLeaderboardBlock[];
  onSelect: (reporter: string, project: string) => void;
}) {
  if (!blocks.length) {
    return <p className="muted">No project data.</p>;
  }
  return (
    <div className="bb-lb-project-grid">
      {blocks.slice(0, 12).map((p) => (
        <RankTable
          key={p.project}
          title={p.project}
          subtitle={`${p.total} issue${p.total === 1 ? '' : 's'} · top reporters`}
          ranks={p.reporters}
          onSelect={(reporter) => onSelect(reporter, p.project)}
        />
      ))}
    </div>
  );
}

export function LeaderboardDashboard({
  initialData = null,
  initialParams,
}: LeaderboardDashboardProps) {
  const seedParams: LeaderboardFilterParams = initialParams ?? { period_type: 'quarterly' };
  const [draft, setDraft] = useState<LeaderboardFilterParams>(seedParams);
  const [state, setState] = useState<LeaderboardFilterParams>(seedParams);
  const [tab, setTab] = useState<LeaderboardTab>('global');
  const [data, setData] = useState<LeaderboardResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const [drillReporter, setDrillReporter] = useState<string | null>(null);
  const [drillContext, setDrillContext] = useState<LeaderboardDrillContext>('global');
  const [drillGroup, setDrillGroup] = useState<string | null>(null);
  const [drillModalTab, setDrillModalTab] = useState<DrillModalTab>('all');
  const [drillMatchedIssues, setDrillMatchedIssues] = useState<DrillIssue[]>([]);
  const [drillIncompleteIssues, setDrillIncompleteIssues] = useState<DrillIssue[]>([]);
  const [drillAllIssues, setDrillAllIssues] = useState<DrillIssue[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);

  const closeDrill = useCallback(() => {
    setDrillReporter(null);
    setDrillMatchedIssues([]);
    setDrillIncompleteIssues([]);
    setDrillAllIssues([]);
    setDrillError(null);
    setDrillModalTab('all');
  }, []);

  const ready = useRef(false);
  const lastFetchedQs = useRef<string | null>(
    initialData ? leaderboardParamsToQuery(seedParams) : null,
  );
  const suppressPush = useRef(Boolean(initialData));

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

  const fetchReporterIssues = async (
    reporter: string,
    context: LeaderboardDrillContext,
    group: string | null = null,
  ): Promise<DrillIssue[]> => {
    const qs = new URLSearchParams(leaderboardParamsToQuery(state).replace(/^\?/, ''));
    qs.set('reporter', reporter);
    qs.set('context', context);
    if (group) qs.set('group', group);
    const res = await apiJson<{ success: boolean; issues?: DrillIssue[]; message?: string }>(
      `/api/leaderboard/reporter-issues?${qs.toString()}`,
    );
    if (!res.success) {
      throw new Error(res.message ?? 'Failed to load reporter issues');
    }
    return res.issues ?? [];
  };

  const openDrill = async (
    reporter: string,
    context: LeaderboardDrillContext = 'global',
    group: string | null = null,
  ) => {
    setDrillReporter(reporter);
    setDrillContext(context);
    setDrillGroup(group);
    setDrillModalTab(context === 'global' ? 'all' : 'matched');
    setDrillMatchedIssues([]);
    setDrillIncompleteIssues([]);
    setDrillAllIssues([]);
    setDrillError(null);
    setDrillLoading(true);
    try {
      const matchedPromise = fetchReporterIssues(reporter, context, group);
      const allPromise =
        context === 'global' ? matchedPromise : fetchReporterIssues(reporter, 'global');
      const incompletePromise =
        context === 'incomplete'
          ? matchedPromise
          : fetchReporterIssues(reporter, 'incomplete');
      const [matched, all, incomplete] = await Promise.all([
        matchedPromise,
        allPromise,
        incompletePromise,
      ]);
      setDrillMatchedIssues(matched);
      setDrillAllIssues(all);
      setDrillIncompleteIssues(incomplete);
    } catch (err) {
      setDrillError(err instanceof Error ? err.message : 'Failed to load reporter issues');
      setDrillMatchedIssues([]);
      setDrillIncompleteIssues([]);
      setDrillAllIssues([]);
    } finally {
      setDrillLoading(false);
    }
  };

  useEffect(() => {
    if (!drillReporter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrill();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drillReporter, closeDrill]);

  useEffect(() => {
    if (initialData) {
      ready.current = true;
      lastFetchedQs.current = leaderboardParamsToQuery(seedParams);
      suppressPush.current = true;
    } else {
      const initial = leaderboardParamsFromUrl(
        new URL(`http://local${window.location.search}`),
      );
      if (!initial.period_type) initial.period_type = 'quarterly';
      suppressPush.current = true;
      setDraft(initial);
      setState(initial);
      ready.current = true;
      void fetchData(initial);
    }

    const onPop = () => {
      const parsed = leaderboardParamsFromUrl(
        new URL(`http://local${window.location.search}`),
      );
      suppressPush.current = true;
      setDraft(parsed);
      setState(parsed);
      void fetchData(parsed);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // Seed once on mount; fetchData is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only init
  }, [fetchData]);

  useEffect(() => {
    if (!ready.current) return;
    if (suppressPush.current) {
      suppressPush.current = false;
      return;
    }
    const qs = leaderboardParamsToQuery(state);
    window.history.pushState(null, '', qs ? `/leaderboard${qs}` : '/leaderboard');
    if (qs !== lastFetchedQs.current) void fetchData(state);
  }, [state, fetchData]);

  const applyFilters = () => {
    setState({
      ...draft,
      year: draft.year ?? (year || undefined),
      period:
        draft.period ??
        (periodType === 'quarterly' || periodType === 'semester'
          ? data?.meta.period
          : draft.period),
    });
  };

  const periodType = (draft.period_type ?? 'quarterly') as LeaderboardPeriodType;
  const years = data?.filter_options.years ?? [];
  const year = draft.year ? String(draft.year) : years[0] ? String(years[0]) : '';

  const renderTabPanel = () => {
    if (!data) return null;
    switch (tab) {
      case 'global':
        return (
          <RankTable
            title="Global Rankings"
            subtitle="Top reporters by total bugs/defects"
            ranks={data.global}
            onSelect={(r) => void openDrill(r, 'global')}
          />
        );
      case 'issue_type':
        return (
          <div className="bb-lb-split">
            <RankTable
              title="Bugs"
              subtitle="Top reporters by Bug issues"
              ranks={data.by_issue_type.Bug ?? []}
              onSelect={(r) => void openDrill(r, 'issue_type', 'Bug')}
            />
            <RankTable
              title="Defects"
              subtitle="Top reporters by Defect issues"
              ranks={data.by_issue_type.Defect ?? []}
              onSelect={(r) => void openDrill(r, 'issue_type', 'Defect')}
            />
          </div>
        );
      case 'ac_label':
        return (
          <AcMatrixTable
            rows={data.ac_label_matrix ?? []}
            onSelect={(reporter, group) => void openDrill(reporter, 'ac_label', group)}
          />
        );
      case 'project':
        return (
          <div>
            <div className="bb-lb-section-head">
              <h3>By Project</h3>
              <p className="muted">Top reporters within each project</p>
            </div>
            <ProjectBlocks
              blocks={data.by_project}
              onSelect={(reporter, project) => void openDrill(reporter, 'project', project)}
            />
          </div>
        );
      case 'accepted':
        return (
          <RankTable
            title="Most Accepted"
            subtitle="Top reporters by accepted bugs/defects"
            ranks={data.accepted}
            onSelect={(r) => void openDrill(r, 'accepted')}
          />
        );
      case 'rejected':
        return (
          <RankTable
            title="Most Rejected"
            subtitle="Top reporters by rejected bugs/defects"
            ranks={data.rejected}
            onSelect={(r) => void openDrill(r, 'rejected')}
          />
        );
      case 'incomplete':
        return (
          <div className="bb-lb-incomplete">
            <IncompleteRankTable
              title="Incomplete Reporters"
              subtitle="% = incomplete ÷ that reporter’s total issues in this period"
              ranks={data.incomplete_reporters ?? []}
              onSelectIncomplete={(r) => void openDrill(r, 'incomplete')}
              onSelectTotal={(r) => void openDrill(r, 'global')}
            />
            <div className="bb-lb-section-head" style={{ marginTop: '1.25rem' }}>
              <h3>By Missing Field</h3>
              <p className="muted">
                Grouped by missing field — click Incomplete for that field, Total for all their
                issues
              </p>
            </div>
            <IncompleteByFieldGrid
              blocks={data.incomplete_by_field ?? []}
              onSelectIncomplete={(reporter, field) =>
                void openDrill(reporter, 'incomplete_field', field)
              }
              onSelectTotal={(reporter) => void openDrill(reporter, 'global')}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="bb-lb">
      <header className="bb-lb-header">
        <div className="bb-lb-header__text">
          <h1>Leaderboard</h1>
          <p>See how reporters rank on bugs/defects.</p>
        </div>
        <div className="bb-lb-filters">
          <label className="field">
            Period Type
            <select
              value={periodType}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  period_type: e.target.value as LeaderboardPeriodType,
                  period: undefined,
                })
              }
            >
              {(data?.filter_options.period_types ?? [
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'semester', label: 'Semester' },
                { value: 'yearly', label: 'Yearly' },
                { value: 'all', label: 'All Time' },
              ]).map((p) => (
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
                onChange={(e) => setDraft({ ...draft, year: e.target.value || undefined })}
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
              Specific Period
              <select
                value={draft.period ?? data?.meta.period ?? 'Q2'}
                onChange={(e) => setDraft({ ...draft, period: e.target.value })}
              >
                <option value="Q1">Q1 {year} (Jan–Mar)</option>
                <option value="Q2">Q2 {year} (Apr–Jun)</option>
                <option value="Q3">Q3 {year} (Jul–Sep)</option>
                <option value="Q4">Q4 {year} (Oct–Dec)</option>
              </select>
            </label>
          ) : null}
          {periodType === 'semester' ? (
            <label className="field">
              Specific Period
              <select
                value={draft.period ?? data?.meta.period ?? 'H1'}
                onChange={(e) => setDraft({ ...draft, period: e.target.value })}
              >
                <option value="H1">H1 {year} (Jan–Jun)</option>
                <option value="H2">H2 {year} (Jul–Dec)</option>
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="btn btn-primary bb-lb-apply"
            onClick={applyFilters}
            disabled={loading}
          >
            Apply
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

      {loading && !data ? <div className="bb-skeleton" style={{ minHeight: 120 }} /> : null}

      {data ? (
        <>
          <section className="bb-lb-banner" aria-label="Current period summary">
            <div className="bb-lb-banner__main">
              <div className="bb-lb-banner__icon" aria-hidden>
                ★
              </div>
              <div>
                <div className="bb-lb-banner__eyebrow">Current Period</div>
                <div className="bb-lb-banner__title">{periodBannerTitle(data.meta)}</div>
                <div className="bb-lb-banner__sub">{periodBannerSubtitle(data.meta)}</div>
              </div>
            </div>
            <div className="bb-lb-banner__stats">
              <div>
                <div className="bb-lb-banner__stat-label">Total Issues</div>
                <div className="bb-lb-banner__stat-value">{data.summary.total_issues}</div>
              </div>
              <div>
                <div className="bb-lb-banner__stat-label">Unique Reporters</div>
                <div className="bb-lb-banner__stat-value">{data.summary.unique_reporters}</div>
              </div>
              <div>
                <div className="bb-lb-banner__stat-label">Accepted</div>
                <div className="bb-lb-banner__stat-value bb-lb-banner__stat-value--ok">
                  {data.summary.accepted_count}
                </div>
              </div>
              <div>
                <div className="bb-lb-banner__stat-label">Rejected</div>
                <div className="bb-lb-banner__stat-value bb-lb-banner__stat-value--bad">
                  {data.summary.rejected_count}
                </div>
              </div>
              <div>
                <div className="bb-lb-banner__stat-label">Incomplete</div>
                <div className="bb-lb-banner__stat-value">
                  {data.summary.incomplete_count ?? 0}
                </div>
              </div>
            </div>
          </section>

          <nav className="bb-lb-tabs" aria-label="Leaderboard views">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`bb-lb-tab${tab === t.id ? ' is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="bb-lb-panel">{renderTabPanel()}</div>
        </>
      ) : null}

      {drillReporter ? (
        <div
          className="bb-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Issues for ${drillReporter}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDrill();
          }}
        >
          <div className="bb-modal__panel">
            <div className="bb-modal__head">
              <div>
                <h2>{drillReporter}</h2>
                <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                  Issues in the selected period
                  {drillContextSubtitle(drillContext, drillGroup)}
                </p>
              </div>
              <button type="button" className="btn btn-outline" onClick={closeDrill}>
                Close
              </button>
            </div>

            <nav className="bb-lb-tabs bb-lb-drill-tabs" aria-label="Reporter issue views">
              {drillContext !== 'global' ? (
                <button
                  type="button"
                  className={`bb-lb-tab${drillModalTab === 'matched' ? ' is-active' : ''}`}
                  onClick={() => setDrillModalTab('matched')}
                >
                  {drillMatchedLabel(drillContext, drillGroup)}
                  <span className="bb-lb-tab__count">{drillMatchedIssues.length}</span>
                </button>
              ) : null}
              {drillContext !== 'incomplete' ? (
                <button
                  type="button"
                  className={`bb-lb-tab${drillModalTab === 'incomplete' ? ' is-active' : ''}`}
                  onClick={() => setDrillModalTab('incomplete')}
                >
                  Incomplete
                  <span className="bb-lb-tab__count">{drillIncompleteIssues.length}</span>
                </button>
              ) : null}
              <button
                type="button"
                className={`bb-lb-tab${drillModalTab === 'all' ? ' is-active' : ''}`}
                onClick={() => setDrillModalTab('all')}
              >
                All Reported
                <span className="bb-lb-tab__count">{drillAllIssues.length}</span>
              </button>
            </nav>

            {drillError ? (
              <div className="settings-alert settings-alert--error">
                <span>{drillError}</span>
              </div>
            ) : null}

            {drillLoading ? <div className="bb-skeleton" style={{ minHeight: 160 }} /> : null}

            {!drillLoading && !drillError
              ? (() => {
                  const activeIssues =
                    drillModalTab === 'matched'
                      ? drillMatchedIssues
                      : drillModalTab === 'incomplete'
                        ? drillIncompleteIssues
                        : drillAllIssues;
                  if (!activeIssues.length) {
                    const emptyMsg =
                      drillModalTab === 'matched'
                        ? `No matching issues for this reporter in the selected period (${drillMatchedLabel(drillContext, drillGroup)}).`
                        : drillModalTab === 'incomplete'
                          ? 'No incomplete issues for this reporter in the selected period.'
                          : 'No reported issues for this reporter in the selected period.';
                    return <p className="muted">{emptyMsg}</p>;
                  }
                  return (
                    <div className="bb-table-wrap">
                      <table className="bb-table">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Summary</th>
                            <th>Missing Fields</th>
                            <th>Status</th>
                            <th>Type</th>
                            <th>Project</th>
                            <th>Severity</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeIssues.map((i) => (
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
                              <td>
                                {(i.missing_field_labels?.length ?? 0) > 0 ? (
                                  <div className="bb-lb-missing">
                                    {i.missing_field_labels!.map((label) => (
                                      <span key={label} className="bb-lb-missing-badge">
                                        {label}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                              <td>{i.status}</td>
                              <td>{i.issue_type}</td>
                              <td>{i.project}</td>
                              <td>{i.severity_issue}</td>
                              <td>{i.created_date?.slice(0, 10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
