'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PRIORITY_MULTIPLIERS,
  DEFAULT_SEVERITY_MULTIPLIERS,
} from '@momus/domain';
import { MESSAGES } from '@momus/shared';
import { apiJson } from '@/lib/api-client';
import {
  readSetupOpen,
  toggleSetupOpen,
  type SetupSectionId,
} from '@/lib/bb-settings-setup-open';
import { SetupSection } from '../bug-budget/setup-section';
import { SyncActivityList } from '../bug-budget/sync-activity-list';
import { SyncOpsCard } from '../bug-budget/sync-ops-card';
import { SyncProgressCard } from '../bug-budget/sync-progress-card';
import { SystemHealthCard } from '../bug-budget/system-health-card';
import type { SyncActivity, SyncStatusData } from '../bug-budget/types';
import type { ConnectionState } from '../atlassian-settings';

type Props = {
  connection: ConnectionState | null;
  onAlert: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenConnection?: () => void;
};

type SettingsConfig = {
  priority_multipliers: Record<string, number>;
  severity_multipliers: Record<string, number>;
  project_budgets: Record<string, number>;
  project_mappings: Record<string, string>;
  sync_query?: {
    jql: string;
    sync_type: string;
    batch_size: number;
    max_total_issues: number;
    year: number;
    quarter: number;
    month: number;
  };
};

const PRIORITY_KEYS = ['highest', 'high', 'medium', 'low', 'lowest'] as const;
const SEVERITY_KEYS = ['critical', 'major', 'moderate', 'minor', 'low'] as const;

const JQL_EXAMPLES = [
  {
    label: 'Bugs created in last 30 days',
    jql: 'issuetype IN (Bug, Defect, "Defect Sub-task", "Defect Task") AND created >= -30d',
  },
  {
    label: 'Open bugs (Not Done)',
    jql: 'issuetype = Bug AND statusCategory != Done',
  },
  {
    label: 'High priority bugs/defects',
    jql: 'issuetype IN (Bug, Defect) AND priority IN (Highest, High)',
  },
  {
    label: 'Resolved last week',
    jql: 'issuetype IN (Bug, Defect) AND resolved >= -7d',
  },
];

function applySyncQuery(sq: NonNullable<SettingsConfig['sync_query']>, setters: {
  setJql: (v: string) => void;
  setSyncType: (v: string) => void;
  setBatchSize: (v: number) => void;
  setMaxIssues: (v: number) => void;
  setYear: (v: number) => void;
  setQuarter: (v: number) => void;
  setMonth: (v: number) => void;
}) {
  setters.setJql(sq.jql ?? '');
  setters.setSyncType(sq.sync_type ?? 'custom');
  setters.setBatchSize(Number(sq.batch_size) || 50);
  setters.setMaxIssues(Number(sq.max_total_issues) || 10000);
  setters.setYear(Number(sq.year) || new Date().getFullYear());
  setters.setQuarter(Number(sq.quarter) || 1);
  setters.setMonth(Number(sq.month) || 1);
}

export function BugBudgetTab({ connection, onAlert, onOpenConnection }: Props) {
  const [jql, setJql] = useState('');
  const [syncType, setSyncType] = useState('custom');
  const [batchSize, setBatchSize] = useState(50);
  const [maxIssues, setMaxIssues] = useState(10000);
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState(1);
  const [month, setMonth] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncRun, setSyncRun] = useState<SyncStatusData | null>(null);
  const [pollHint, setPollHint] = useState('');
  const [stats, setStats] = useState<{ total: number; bugs: number; open: number } | null>(null);
  const [activities, setActivities] = useState<SyncActivity[]>([]);
  const [priority, setPriority] = useState<Record<string, number>>({ ...DEFAULT_PRIORITY_MULTIPLIERS });
  const [severity, setSeverity] = useState<Record<string, number>>({ ...DEFAULT_SEVERITY_MULTIPLIERS });
  const [budgets, setBudgets] = useState<{ name: string; amount: number }[]>([]);
  const [mappings, setMappings] = useState<{ jira: string; display: string }[]>([]);
  const [fetchedProjects, setFetchedProjects] = useState<{ key: string; name: string }[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [projectFilter, setProjectFilter] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [setupOpen, setSetupOpen] = useState<Set<SetupSectionId>>(() => new Set());
  const [setupError, setSetupError] = useState<Partial<Record<SetupSectionId, string>>>({});
  const setupLoadedRef = useRef<Set<SetupSectionId>>(new Set());
  const configSetupInFlight = useRef<Promise<void> | null>(null);
  const cronSetupInFlight = useRef<Promise<void> | null>(null);
  const [cron, setCron] = useState({
    is_active: false,
    schedule_type: 'daily',
    interval_days: 1,
    time: '00:00',
    day_of_week: 'monday',
    day_of_month: 1,
    jql: '',
    batch_size: 50,
    max_total_issues: 0,
    next_run_at: null as string | null,
    last_run_at: null as string | null,
  });

  const applyConfigProjects = useCallback((config: SettingsConfig) => {
    setPriority({ ...DEFAULT_PRIORITY_MULTIPLIERS, ...config.priority_multipliers });
    setSeverity({ ...DEFAULT_SEVERITY_MULTIPLIERS, ...config.severity_multipliers });
    setBudgets(
      Object.entries(config.project_budgets).map(([name, amount]) => ({
        name,
        amount: Number(amount),
      })),
    );
    setMappings(
      Object.entries(config.project_mappings).map(([jira, display]) => ({
        jira,
        display: String(display),
      })),
    );
  }, []);

  const applyCronSchedule = useCallback((s: Record<string, unknown>) => {
    const params = (s.command_params ?? {}) as Record<string, unknown>;
    setCron((c) => ({
      ...c,
      is_active: Boolean(s.is_active),
      schedule_type: String(s.schedule_type ?? 'daily'),
      interval_days: Number(s.interval_days ?? 1),
      time: String(s.time ?? '00:00'),
      day_of_week: String(s.day_of_week ?? 'monday'),
      day_of_month: Number(s.day_of_month ?? 1),
      jql: params.jql != null ? String(params.jql) : '',
      batch_size: Number(params.batch_size ?? 50),
      max_total_issues: Number(params.max_total_issues ?? 0),
      next_run_at: (s.next_run_at as string | null) ?? null,
      last_run_at: (s.last_run_at as string | null) ?? null,
    }));
  }, []);

  const loadOpsMeta = useCallback(async () => {
    const [cfg, act, dash] = await Promise.all([
      apiJson<{ config?: SettingsConfig }>('/api/settings/bug-budget/config'),
      apiJson<{ activities?: SyncActivity[] }>('/api/settings/bug-budget/sync-activity'),
      apiJson<{ stats?: { total: number; bugs: number; open: number } }>(
        '/api/bug-budget?per_page=25',
      ),
    ]);

    if (cfg.success && cfg.config?.sync_query) {
      applySyncQuery(cfg.config.sync_query, {
        setJql,
        setSyncType,
        setBatchSize,
        setMaxIssues,
        setYear,
        setQuarter,
        setMonth,
      });
    }
    if (act.success && act.activities) setActivities(act.activities);
    if (dash.success && dash.stats) {
      setStats({ total: dash.stats.total, bugs: dash.stats.bugs, open: dash.stats.open });
    }
  }, []);

  const loadSetupSection = useCallback(
    async (id: SetupSectionId) => {
      if (setupLoadedRef.current.has(id)) return;

      if (id === 'projects' || id === 'multipliers') {
        if (
          setupLoadedRef.current.has('projects') ||
          setupLoadedRef.current.has('multipliers')
        ) {
          setupLoadedRef.current.add(id);
          return;
        }
        if (configSetupInFlight.current) {
          await configSetupInFlight.current;
          setupLoadedRef.current.add(id);
          return;
        }
        const run = (async () => {
          const cfg = await apiJson<{ config?: SettingsConfig; message?: string }>(
            '/api/settings/bug-budget/config',
          );
          if (!cfg.success || !cfg.config) {
            const message = cfg.message ?? 'Failed to load setup config';
            onAlert('error', message);
            setSetupError((e) => ({ ...e, projects: message, multipliers: message }));
            return;
          }
          applyConfigProjects(cfg.config);
          setupLoadedRef.current.add('projects');
          setupLoadedRef.current.add('multipliers');
          setSetupError((e) => {
            const next = { ...e };
            delete next.projects;
            delete next.multipliers;
            return next;
          });
        })();
        configSetupInFlight.current = run;
        try {
          await run;
        } finally {
          configSetupInFlight.current = null;
        }
        return;
      }

      if (id === 'cron') {
        if (cronSetupInFlight.current) {
          await cronSetupInFlight.current;
          return;
        }
        const run = (async () => {
          const schedule = await apiJson<{
            schedule?: Record<string, unknown>;
            message?: string;
          }>('/api/settings/bug-budget/cron-schedule');
          if (!schedule.success || !schedule.schedule) {
            const message = schedule.message ?? 'Failed to load schedule';
            onAlert('error', message);
            setSetupError((e) => ({ ...e, cron: message }));
            return;
          }
          applyCronSchedule(schedule.schedule);
          setupLoadedRef.current.add('cron');
          setSetupError((e) => {
            const next = { ...e };
            delete next.cron;
            return next;
          });
        })();
        cronSetupInFlight.current = run;
        try {
          await run;
        } finally {
          cronSetupInFlight.current = null;
        }
      }
    },
    [applyConfigProjects, applyCronSchedule, onAlert],
  );

  const retrySetupSection = (id: SetupSectionId) => {
    if (id === 'projects' || id === 'multipliers') {
      setupLoadedRef.current.delete('projects');
      setupLoadedRef.current.delete('multipliers');
    } else {
      setupLoadedRef.current.delete(id);
    }
    void loadSetupSection(id);
  };

  useEffect(() => {
    setSetupOpen(readSetupOpen());
    void loadOpsMeta();
  }, [loadOpsMeta]);

  useEffect(() => {
    for (const id of setupOpen) {
      void loadSetupSection(id);
    }
  }, [setupOpen, loadSetupSection]);

  useEffect(() => {
    if (!syncRun || syncRun.status === 'completed' || syncRun.status === 'failed') return;
    let fails = 0;
    let queuedPolls = 0;
    const id = window.setInterval(() => {
      void (async () => {
        const res = await apiJson<{ data?: SyncStatusData }>(
          `/api/settings/bug-budget/sync-status/${syncRun.sync_run_id}`,
        );
        if (!res.success || !res.data) {
          fails += 1;
          if (fails >= 5) {
            setPollHint(MESSAGES.M11);
            window.clearInterval(id);
          }
          return;
        }
        fails = 0;
        setSyncRun(res.data);
        if (res.data.status === 'queued') {
          queuedPolls += 1;
          if (queuedPolls > 3) setPollHint('Waiting for worker…');
        } else {
          queuedPolls = 0;
          setPollHint('');
        }
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          window.clearInterval(id);
          void loadOpsMeta();
          if (res.data.status === 'completed') onAlert('success', 'Sync completed');
          else onAlert('error', res.data.error_message ?? 'Sync failed');
        }
      })();
    }, 2000);
    return () => window.clearInterval(id);
  }, [syncRun, loadOpsMeta, onAlert]);

  const syncBody = () => ({
    jql: syncType === 'custom' ? jql : undefined,
    sync_type: syncType,
    batch_size: batchSize,
    max_total_issues: maxIssues,
    year,
    quarter,
    month,
  });

  const saveSyncQuery = async (opts?: { quiet?: boolean }) => {
    const res = await apiJson<{ sync_query?: unknown }>(
      '/api/settings/bug-budget/save-sync-query',
      {
        method: 'POST',
        body: JSON.stringify({
          jql,
          sync_type: syncType,
          batch_size: batchSize,
          max_total_issues: maxIssues,
          year,
          quarter,
          month,
        }),
      },
    );
    if (!res.success) {
      onAlert('error', res.message ?? 'Failed to save JQL configuration');
      return false;
    }
    if (!opts?.quiet) {
      onAlert('success', res.message ?? 'JQL query configuration saved successfully!');
    }
    return true;
  };

  const preview = async () => {
    if (syncType === 'custom' && !jql.trim()) {
      onAlert('error', 'Enter a JQL query before preview (copy it from Jira).');
      return;
    }
    setBusy('preview');
    try {
      await saveSyncQuery({ quiet: true });
      const res = await apiJson<{ data?: { total_found?: number } }>(
        '/api/settings/bug-budget/fetch-from-jira',
        { method: 'POST', body: JSON.stringify(syncBody()) },
      );
      if (!res.success) onAlert('error', res.message ?? 'Preview failed');
      else onAlert('success', res.message ?? `Preview: ${res.data?.total_found ?? 0} issues`);
    } finally {
      setBusy(null);
    }
  };

  const startSync = async () => {
    if (syncType === 'custom' && !jql.trim()) {
      onAlert('error', 'Enter a JQL query before syncing (copy it from Jira).');
      return;
    }
    setBusy('sync');
    setPollHint(MESSAGES.M12);
    try {
      await saveSyncQuery({ quiet: true });
      const res = await apiJson<{ sync_run_id?: number; inline?: boolean }>(
        '/api/settings/bug-budget/sync-with-progress',
        { method: 'POST', body: JSON.stringify(syncBody()) },
      );
      if (!res.success) {
        if ((res as { sync_run_id?: number }).sync_run_id) {
          onAlert(
            'info',
            `${res.message ?? 'Sync already running'} — watching #${(res as { sync_run_id: number }).sync_run_id}`,
          );
          setSyncRun({
            sync_run_id: (res as { sync_run_id: number }).sync_run_id,
            status: 'running',
            percentage: 0,
            processed: 0,
            total_issues: 0,
            current_batch: 0,
            result: null,
            error_message: null,
          });
        } else {
          onAlert('error', res.message ?? 'Failed to queue sync');
        }
        return;
      }
      setSyncRun({
        sync_run_id: res.sync_run_id!,
        status: 'queued',
        percentage: 0,
        processed: 0,
        total_issues: 0,
        current_batch: 0,
        result: null,
        error_message: null,
      });
      onAlert('success', res.message ?? 'Sync queued');
    } finally {
      setBusy(null);
    }
  };

  const saveMultipliers = async () => {
    setBusy('mult');
    try {
      const body: Record<string, number> = {};
      for (const k of PRIORITY_KEYS) body[`priority_${k}`] = priority[k] ?? 1;
      for (const k of SEVERITY_KEYS) body[`severity_${k}`] = severity[k] ?? 1;
      const res = await apiJson('/api/settings/bug-budget/save-multipliers', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.success) onAlert('error', res.message ?? 'Save failed');
      else onAlert('success', res.message ?? MESSAGES.M14);
    } finally {
      setBusy(null);
    }
  };

  const saveProjects = async () => {
    setBusy('proj');
    try {
      const res = await apiJson('/api/settings/bug-budget/save-project-settings', {
        method: 'POST',
        body: JSON.stringify({
          budget_data: {
            projects: budgets.map((b) => b.name),
            amounts: budgets.map((b) => b.amount),
          },
          mapping_data: {
            jira_projects: mappings.map((m) => m.jira),
            display_names: mappings.map((m) => m.display),
          },
        }),
      });
      if (!res.success) onAlert('error', res.message ?? 'Save failed');
      else onAlert('success', res.message ?? MESSAGES.M16);
    } finally {
      setBusy(null);
    }
  };

  const fetchProjects = async () => {
    setBusy('fetch-proj');
    try {
      const res = await apiJson<{
        projects?: { key: string; name: string }[];
        message?: string;
      }>('/api/settings/bug-budget/fetch-projects', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!res.success) {
        onAlert('error', res.message ?? 'Failed to fetch projects');
        return;
      }
      const list = res.projects ?? [];
      setFetchedProjects(list);
      setSelectedKeys(new Set());
      setShowProjectPicker(true);
      onAlert('success', res.message ?? `Fetched ${list.length} projects`);
    } finally {
      setBusy(null);
    }
  };

  const toggleProjectKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredFetched = fetchedProjects.filter((p) => {
    const q = projectFilter.trim().toLowerCase();
    if (!q) return true;
    return p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  const selectAllFiltered = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const p of filteredFetched) next.add(p.key);
      return next;
    });
  };

  const clearProjectSelection = () => setSelectedKeys(new Set());

  const addSelectedProjects = () => {
    if (selectedKeys.size === 0) {
      onAlert('info', 'Select at least one project to add');
      return;
    }
    const byKey = new Map(fetchedProjects.map((p) => [p.key, p]));
    const nextMappings = [...mappings];
    const nextBudgets = [...budgets];
    const mappedKeys = new Set(nextMappings.map((m) => m.jira.toUpperCase()));
    const budgetNames = new Set(nextBudgets.map((b) => b.name.toLowerCase()));

    let added = 0;
    for (const key of selectedKeys) {
      const p = byKey.get(key);
      if (!p) continue;
      if (!mappedKeys.has(p.key.toUpperCase())) {
        nextMappings.push({ jira: p.key, display: p.name });
        mappedKeys.add(p.key.toUpperCase());
      }
      const display = p.name;
      if (!budgetNames.has(display.toLowerCase())) {
        nextBudgets.push({ name: display, amount: 100 });
        budgetNames.add(display.toLowerCase());
      }
      added += 1;
    }

    setMappings(nextMappings);
    setBudgets(nextBudgets);
    setSelectedKeys(new Set());
    onAlert(
      'success',
      added
        ? `Added ${added} project${added === 1 ? '' : 's'} — click Save Changes to persist`
        : 'Selected projects were already present',
    );
  };

  const saveCron = async () => {
    setBusy('cron');
    try {
      const res = await apiJson('/api/settings/bug-budget/cron-schedule', {
        method: 'POST',
        body: JSON.stringify(cron),
      });
      if (!res.success) onAlert('error', res.message ?? 'Save failed');
      else {
        onAlert('success', res.message ?? MESSAGES.M17);
        setupLoadedRef.current.delete('cron');
        void loadSetupSection('cron');
      }
    } finally {
      setBusy(null);
    }
  };

  const onSetupOpenChange = (id: SetupSectionId, open: boolean) => {
    setSetupOpen(toggleSetupOpen(id, open));
  };

  return (
    <div className="bb-layout">
      <div className="bb-main">
        <p className={`bb-conn-banner ${connection?.configured && connection.enabled ? 'ok' : 'bad'}`}>
          Jira:{' '}
          {connection?.configured && connection.enabled
            ? `Connected (${connection.site_url || 'configured'})`
            : 'Not ready — set credentials under Atlassian'}
          {onOpenConnection ? (
            <>
              {' · '}
              <button type="button" className="linkish" onClick={onOpenConnection}>
                Manage Atlassian
              </button>
            </>
          ) : null}
        </p>

        <SyncOpsCard
          jql={jql}
          syncType={syncType}
          batchSize={batchSize}
          maxIssues={maxIssues}
          year={year}
          quarter={quarter}
          month={month}
          busy={busy}
          jqlExamples={JQL_EXAMPLES}
          onJqlChange={setJql}
          onSyncTypeChange={setSyncType}
          onBatchSizeChange={setBatchSize}
          onMaxIssuesChange={setMaxIssues}
          onYearChange={setYear}
          onQuarterChange={setQuarter}
          onMonthChange={setMonth}
          onApplyExample={(exampleJql) => {
            setSyncType('custom');
            setJql(exampleJql);
          }}
          onSave={() => {
            setBusy('save-jql');
            void saveSyncQuery().finally(() => setBusy(null));
          }}
          onSync={() => void startSync()}
          onPreview={() => void preview()}
          onClearJql={() => setJql('')}
        />

        {syncRun ? <SyncProgressCard syncRun={syncRun} pollHint={pollHint} /> : null}

        <SyncActivityList activities={activities} limit={5} />

        <div className="bb-setup-group">
          <h2 className="bb-setup-group__title">Setup</h2>

          <SetupSection
            id="bb-setup-projects"
            title="Project Budget & Mapping"
            open={setupOpen.has('projects')}
            onOpenChange={(open) => onSetupOpenChange('projects', open)}
          >
            {setupError.projects ? (
              <p className="error-text">
                {setupError.projects}{' '}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => retrySetupSection('projects')}
                >
                  Retry
                </button>
              </p>
            ) : (
              <>
                <div className="card-head">
                  <div>
                    <p className="muted">
                      Map Jira project keys to display names and set per-squad budgets.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={busy === 'fetch-proj'}
                    onClick={() => void fetchProjects()}
                  >
                    {busy === 'fetch-proj' ? 'Fetching…' : 'Fetch from Jira'}
                  </button>
                </div>

                {showProjectPicker && (
                  <div className="project-picker">
                    <div className="field-row">
                      <label className="field" style={{ flex: 1 }}>
                        <span>Filter projects</span>
                        <input
                          value={projectFilter}
                          onChange={(e) => setProjectFilter(e.target.value)}
                          placeholder="Search by key or name"
                        />
                      </label>
                    </div>
                    <div className="btn-row">
                      <button type="button" className="btn btn-ghost" onClick={selectAllFiltered}>
                        Select all shown
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={clearProjectSelection}
                      >
                        Clear selection
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={selectedKeys.size === 0}
                        onClick={addSelectedProjects}
                      >
                        Add selected ({selectedKeys.size})
                      </button>
                    </div>
                    {fetchedProjects.length === 0 ? (
                      <p className="muted">
                        No projects returned. Check Jira connection and permissions.
                      </p>
                    ) : (
                      <ul className="project-picker__list">
                        {filteredFetched.map((p) => (
                          <li key={p.key}>
                            <label className="project-picker__item">
                              <input
                                type="checkbox"
                                checked={selectedKeys.has(p.key)}
                                onChange={() => toggleProjectKey(p.key)}
                              />
                              <span className="project-picker__key">{p.key}</span>
                              <span className="project-picker__name">{p.name}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="two-col">
                  <div>
                    <h3>Project / Squad Budgets</h3>
                    {budgets.map((b, i) => (
                      <div key={`${b.name}-${i}`} className="inline-row">
                        <input
                          value={b.name}
                          onChange={(e) => {
                            const next = [...budgets];
                            next[i] = { ...b, name: e.target.value };
                            setBudgets(next);
                          }}
                        />
                        <input
                          type="number"
                          value={b.amount}
                          onChange={(e) => {
                            const next = [...budgets];
                            next[i] = { ...b, amount: Number(e.target.value) || 0 };
                            setBudgets(next);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setBudgets(budgets.filter((_, j) => j !== i))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setBudgets([...budgets, { name: 'New', amount: 100 }])}
                    >
                      + Add Budget
                    </button>
                  </div>
                  <div>
                    <h3>Project Name Mappings</h3>
                    {mappings.map((m, i) => (
                      <div key={`${m.jira}-${i}`} className="inline-row">
                        <input
                          value={m.jira}
                          onChange={(e) => {
                            const next = [...mappings];
                            next[i] = { ...m, jira: e.target.value };
                            setMappings(next);
                          }}
                          placeholder="Jira key"
                        />
                        <input
                          value={m.display}
                          onChange={(e) => {
                            const next = [...mappings];
                            next[i] = { ...m, display: e.target.value };
                            setMappings(next);
                          }}
                          placeholder="Display name"
                        />
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setMappings(mappings.filter((_, j) => j !== i))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setMappings([...mappings, { jira: '', display: '' }])}
                    >
                      + Add Mapping
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === 'proj'}
                  onClick={() => void saveProjects()}
                >
                  {busy === 'proj' ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            )}
          </SetupSection>

          <SetupSection
            id="bb-setup-multipliers"
            title="Bug Cost Multiplier Settings"
            open={setupOpen.has('multipliers')}
            onOpenChange={(open) => onSetupOpenChange('multipliers', open)}
          >
            {setupError.multipliers ? (
              <p className="error-text">
                {setupError.multipliers}{' '}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => retrySetupSection('multipliers')}
                >
                  Retry
                </button>
              </p>
            ) : (
              <>
                <p className="muted">Configure cost multipliers for bug budget calculations.</p>
                <div className="two-col">
                  <div>
                    <h3>Priority</h3>
                    {PRIORITY_KEYS.map((k) => (
                      <label key={k} className="field">
                        <span>{k[0]!.toUpperCase() + k.slice(1)}</span>
                        <input
                          type="number"
                          step={0.1}
                          min={0.1}
                          max={1000}
                          value={priority[k] ?? 1}
                          onChange={(e) =>
                            setPriority({ ...priority, [k]: Number(e.target.value) })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div>
                    <h3>Severity</h3>
                    {SEVERITY_KEYS.map((k) => (
                      <label key={k} className="field">
                        <span>{k[0]!.toUpperCase() + k.slice(1)}</span>
                        <input
                          type="number"
                          step={0.1}
                          min={0.1}
                          max={1000}
                          value={severity[k] ?? 1}
                          onChange={(e) =>
                            setSeverity({ ...severity, [k]: Number(e.target.value) })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setPriority({ ...DEFAULT_PRIORITY_MULTIPLIERS });
                      setSeverity({ ...DEFAULT_SEVERITY_MULTIPLIERS });
                    }}
                  >
                    Reset to Defaults
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy === 'mult'}
                    onClick={() => void saveMultipliers()}
                  >
                    {busy === 'mult' ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </>
            )}
          </SetupSection>

          <SetupSection
            id="bb-setup-cron"
            title="Automated Sync Schedule"
            open={setupOpen.has('cron')}
            onOpenChange={(open) => onSetupOpenChange('cron', open)}
          >
            {setupError.cron ? (
              <p className="error-text">
                {setupError.cron}{' '}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => retrySetupSection('cron')}
                >
                  Retry
                </button>
              </p>
            ) : (
              <>
                <label className="toggle-row">
                  <span>Enable Automated Sync</span>
                  <input
                    type="checkbox"
                    checked={cron.is_active}
                    onChange={(e) => setCron({ ...cron, is_active: e.target.checked })}
                  />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>Schedule Type</span>
                    <select
                      value={cron.schedule_type}
                      onChange={(e) => setCron({ ...cron, schedule_type: e.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Time (HH:MM)</span>
                    <input
                      value={cron.time}
                      onChange={(e) => setCron({ ...cron, time: e.target.value })}
                    />
                  </label>
                  {cron.schedule_type === 'custom' && (
                    <label className="field">
                      <span>Interval Days</span>
                      <input
                        type="number"
                        min={1}
                        value={cron.interval_days}
                        onChange={(e) =>
                          setCron({ ...cron, interval_days: Number(e.target.value) || 1 })
                        }
                      />
                    </label>
                  )}
                </div>
                <label className="field">
                  <span>JQL Override (optional)</span>
                  <textarea
                    rows={3}
                    value={cron.jql}
                    onChange={(e) => setCron({ ...cron, jql: e.target.value })}
                  />
                </label>
                <p className="muted">
                  Next run:{' '}
                  {cron.next_run_at ? new Date(cron.next_run_at).toLocaleString() : '—'} · Last
                  run: {cron.last_run_at ? new Date(cron.last_run_at).toLocaleString() : 'Never'}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === 'cron'}
                  onClick={() => void saveCron()}
                >
                  {busy === 'cron' ? 'Saving…' : 'Save Schedule'}
                </button>
              </>
            )}
          </SetupSection>
        </div>
      </div>

      <aside className="bb-side">
        <SystemHealthCard stats={stats} onRefresh={() => void loadOpsMeta()} />
      </aside>
    </div>
  );
}
