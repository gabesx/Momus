'use client';

import { useEffect, useRef, useState } from 'react';
import { ANALYTICS_KPI_THRESHOLDS, BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '@momus/domain';
import type { MenuVisibility } from '@momus/infra';
import { apiJson } from '@/lib/api-client';
import {
  type AnalyticsSetupSectionId,
  readAnalyticsSetupOpen,
  toggleAnalyticsSetupOpen,
} from '@/lib/analytics-settings-setup-open';
import { reloadMe } from '@/lib/use-me';
import { SetupSection } from '../bug-budget/setup-section';

type EscapeMode = 'labels' | 'issue_type';
type DigestProvider = 'slack' | 'google_chat';
type DigestDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const DIGEST_DAY_OPTIONS: Array<{ value: DigestDay; label: string }> = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' },
];

const DIGEST_PROVIDERS: Array<{ value: DigestProvider; label: string; placeholder: string }> = [
  {
    value: 'slack',
    label: 'Slack',
    placeholder: 'https://hooks.slack.com/services/…',
  },
  {
    value: 'google_chat',
    label: 'Google Chat',
    placeholder: 'https://chat.googleapis.com/v1/spaces/…',
  },
];

const MENU_VISIBILITY_TOGGLES: Array<{
  key: keyof Omit<MenuVisibility, 'allowlist_user_ids'>;
  label: string;
}> = [
  { key: 'defect_analytics', label: 'Defect Analytics' },
  { key: 'defect_tracker', label: 'Defect Tracker' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'bug_budget', label: 'Bug Budget' },
];

/** Canonical Jira issue types (default sync scope) offered for issue-type escape mode. */
const ESCAPE_TYPE_OPTIONS: string[] = [...BUG_GROUP_TYPES, ...DEFECT_GROUP_TYPES];

type KpiThresholdKey =
  | 'open_warning'
  | 'avg_age_warning_days'
  | 'resolution_rate_healthy_pct'
  | 'open_critical_major_pct_warning'
  | 'open_long_overdue_pct_warning'
  | 'mttr_critical_major_warning_hours'
  | 'sla_compliance_healthy_pct'
  | 'escape_rate_warning_pct';

type AllowlistCandidate = {
  id: number;
  name: string | null;
  email: string;
};

type AnalyticsSettings = {
  menu_visibility: MenuVisibility;
  sla_first_response_days: number;
  sla_critical_resolution_days: number;
  sla_major_resolution_days: number;
  prod_labels: string[];
  escape_mode: EscapeMode;
  prod_issue_types: string[];
  digest_enabled: boolean;
  digest_provider: DigestProvider;
  digest_webhook_url: string;
  digest_day: DigestDay;
  digest_hour: number;
} & Record<KpiThresholdKey, number>;

function anyModuleHidden(menu: MenuVisibility): boolean {
  return (
    !menu.defect_analytics ||
    !menu.defect_tracker ||
    !menu.leaderboard ||
    !menu.bug_budget
  );
}
/** Mirrors infra KPI_THRESHOLD_BOUNDS; drives the inputs + client-side validation. */
const KPI_FIELDS: Array<{ key: KpiThresholdKey; label: string; min: number; max: number }> = [
  { key: 'open_warning', label: 'Open backlog warning (count)', min: 1, max: 100000 },
  { key: 'avg_age_warning_days', label: 'Avg age warning (days)', min: 1, max: 3650 },
  { key: 'resolution_rate_healthy_pct', label: 'Resolution rate healthy (%)', min: 0, max: 100 },
  { key: 'open_critical_major_pct_warning', label: 'Critical/Major % warning', min: 0, max: 100 },
  { key: 'open_long_overdue_pct_warning', label: 'Long-overdue % warning', min: 0, max: 100 },
  {
    key: 'mttr_critical_major_warning_hours',
    label: 'MTTR Critical/Major warning (hours)',
    min: 1,
    max: 100000,
  },
  { key: 'sla_compliance_healthy_pct', label: 'SLA compliance healthy (%)', min: 0, max: 100 },
  { key: 'escape_rate_warning_pct', label: 'Escape rate warning (%)', min: 0, max: 100 },
];

type Props = {
  onAlert: (type: 'success' | 'error' | 'info', text: string) => void;
};

export function AnalyticsTab({ onAlert }: Props) {
  const [settings, setSettings] = useState<AnalyticsSettings | null>(null);
  const [prodLabelsText, setProdLabelsText] = useState('');
  const [candidates, setCandidates] = useState<AllowlistCandidate[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [setupOpen, setSetupOpen] = useState<Set<AnalyticsSetupSectionId>>(() => new Set());

  useEffect(() => {
    setSetupOpen(readAnalyticsSetupOpen());
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await apiJson<{ settings?: AnalyticsSettings }>('/api/settings/analytics');
      if (res.success && res.settings) {
        setSettings(res.settings);
        setProdLabelsText(res.settings.prod_labels.join(', '));
      } else {
        onAlert('error', res.message ?? 'Failed to load analytics settings');
      }
    })();
  }, [onAlert]);

  useEffect(() => {
    if (!settings || !anyModuleHidden(settings.menu_visibility) || candidates !== null) return;
    void (async () => {
      const res = await apiJson<{ users?: AllowlistCandidate[] }>(
        '/api/settings/analytics/allowlist-candidates',
      );
      if (res.success && res.users) {
        setCandidates(res.users);
      } else {
        setCandidates([]);
        onAlert('error', res.message ?? 'Failed to load allowlist candidates');
      }
    })();
  }, [settings, candidates, onAlert]);

  if (!settings) {
    return <div className="bb-skeleton" style={{ minHeight: 200 }} />;
  }

  const setNum = (key: keyof AnalyticsSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings({ ...settings, [key]: Number(e.target.value) });

  const setMenuFlag =
    (key: keyof Omit<MenuVisibility, 'allowlist_user_ids'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setSettings({
        ...settings,
        menu_visibility: { ...settings.menu_visibility, [key]: e.target.checked },
      });

  const toggleAllowlistUser = (userId: number, checked: boolean) => {
    const ids = settings.menu_visibility.allowlist_user_ids;
    setSettings({
      ...settings,
      menu_visibility: {
        ...settings.menu_visibility,
        allowlist_user_ids: checked
          ? ids.includes(userId)
            ? ids
            : [...ids, userId]
          : ids.filter((id) => id !== userId),
      },
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...settings,
        prod_labels: prodLabelsText
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
      };
      const res = await apiJson<{ settings?: AnalyticsSettings }>('/api/settings/analytics', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success && res.settings) {
        setSettings(res.settings);
        setProdLabelsText(res.settings.prod_labels.join(', '));
        await reloadMe();
        onAlert('success', 'Analytics settings saved');
      } else {
        onAlert('error', res.message ?? 'Failed to save analytics settings');
      }
    } finally {
      setSaving(false);
    }
  };

  const sendDigestNow = async () => {
    // Synchronous in-flight lock: blocks a double-fire before React re-renders
    // the disabled button.
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await apiJson<{ status?: number }>('/api/settings/analytics/send-digest', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.success) {
        onAlert('success', 'Digest sent to the configured webhook.');
      } else {
        onAlert('error', res.message ?? 'Failed to send digest');
      }
    } catch (err) {
      onAlert('error', err instanceof Error ? err.message : 'Failed to send digest');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="bb-layout">
      <div className="bb-main bb-analytics-settings">
        <section className="settings-card">
          <h2>Menu visibility</h2>
          <p className="muted">
            When a module is off, it is removed from navigation and its pages/APIs return 403 for
            everyone except allowlisted users. Settings stays available so you can turn modules
            back on.
          </p>
          <div className="bb-menu-visibility__grid">
            {MENU_VISIBILITY_TOGGLES.map(({ key, label }) => (
              <label className="field" key={key}>
                <span>
                  <input
                    type="checkbox"
                    checked={settings.menu_visibility[key]}
                    onChange={setMenuFlag(key)}
                  />{' '}
                  {label}
                </span>
              </label>
            ))}
          </div>
          {anyModuleHidden(settings.menu_visibility) ? (
            <fieldset className="bb-menu-visibility__allowlist">
              <legend>Hide from everyone — still show to selected users</legend>
              <p className="muted">Selected approved users still see hidden modules.</p>
              {candidates === null ? (
                <span className="muted">Loading users…</span>
              ) : candidates.length === 0 ? (
                <span className="muted">No approved users available.</span>
              ) : (
                <div className="bb-menu-visibility__allowlist-list">
                  {candidates.map((u) => (
                    <label key={u.id} className="bb-menu-visibility__allowlist-row">
                      <input
                        type="checkbox"
                        checked={settings.menu_visibility.allowlist_user_ids.includes(u.id)}
                        onChange={(e) => toggleAllowlistUser(u.id, e.target.checked)}
                      />
                      {(u.name?.trim() || 'Unnamed') + ' — ' + u.email}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          ) : null}
        </section>

        <section className="settings-card">
          <h2>SLA thresholds</h2>
          <p className="muted">
            Drive the Triage &amp; SLA panel on Defect Analytics. Days are calendar days.
          </p>
          <div className="field-row">
            <label className="field">
              First response (days)
              <input
                type="number"
                min={1}
                max={365}
                value={settings.sla_first_response_days}
                onChange={setNum('sla_first_response_days')}
              />
            </label>
            <label className="field">
              Critical resolution (days)
              <input
                type="number"
                min={1}
                max={365}
                value={settings.sla_critical_resolution_days}
                onChange={setNum('sla_critical_resolution_days')}
              />
            </label>
            <label className="field">
              Major resolution (days)
              <input
                type="number"
                min={1}
                max={365}
                value={settings.sla_major_resolution_days}
                onChange={setNum('sla_major_resolution_days')}
              />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <h2>Weekly digest</h2>
          <p className="muted">
            Posts a weekly analytics summary (KPIs, deltas, top offenders) to a Slack or Google
            Chat incoming-webhook URL on the configured day and hour (Asia/Jakarta).
          </p>
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={settings.digest_enabled}
                onChange={(e) => setSettings({ ...settings, digest_enabled: e.target.checked })}
              />{' '}
              Enable weekly digest
            </span>
          </label>
          <label className="field">
            Provider
            <select
              value={settings.digest_provider}
              onChange={(e) =>
                setSettings({ ...settings, digest_provider: e.target.value as DigestProvider })
              }
            >
              {DIGEST_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Webhook URL
            <input
              type="url"
              value={settings.digest_webhook_url}
              placeholder={
                DIGEST_PROVIDERS.find((p) => p.value === settings.digest_provider)?.placeholder
              }
              onChange={(e) => setSettings({ ...settings, digest_webhook_url: e.target.value })}
            />
            <span className="muted" style={{ fontSize: '0.75rem' }}>
              Incoming-webhook URL for the selected provider.
            </span>
          </label>

          <div className="field-row">
            <label className="field">
              Send day
              <select
                value={settings.digest_day}
                onChange={(e) =>
                  setSettings({ ...settings, digest_day: e.target.value as DigestDay })
                }
              >
                {DIGEST_DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Send hour (0–23, Asia/Jakarta)
              <input
                type="number"
                min={0}
                max={23}
                value={settings.digest_hour}
                onChange={setNum('digest_hour')}
              />
            </label>
          </div>

          <div className="btn-row" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={sendDigestNow}
              disabled={sending || !settings.digest_webhook_url}
              title={
                settings.digest_webhook_url
                  ? 'Uses saved settings — save first if you changed the webhook'
                  : 'Configure and save a webhook URL first'
              }
            >
              {sending ? 'Sending…' : 'Send digest now'}
            </button>
          </div>
        </section>

        <div className="bb-setup-group">
          <h3 className="bb-setup-group__title">Setup</h3>

          <SetupSection
            id="analytics-setup-kpi"
            title="KPI thresholds"
            hint="When dashboard tiles turn warning/danger"
            open={setupOpen.has('kpi')}
            onOpenChange={(open) => setSetupOpen(toggleAnalyticsSetupOpen('kpi', open))}
          >
            <p className="muted">
              Tune when Defect Analytics KPI tiles turn warning/danger. Percentages are 0–100.
            </p>
            <div className="field-row" style={{ flexWrap: 'wrap' }}>
              {KPI_FIELDS.map(({ key, label, min, max }) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={settings[key]}
                    onChange={setNum(key)}
                  />
                </label>
              ))}
            </div>
            <div className="btn-row" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const resetKpis = Object.fromEntries(
                    KPI_FIELDS.map(({ key }) => [key, ANALYTICS_KPI_THRESHOLDS[key]]),
                  ) as Record<KpiThresholdKey, number>;
                  setSettings((s) => (s ? { ...s, ...resetKpis } : s));
                }}
              >
                Reset thresholds to defaults
              </button>
            </div>
          </SetupSection>

          <SetupSection
            id="analytics-setup-escape"
            title="Defect escape detection"
            hint="How production escapes are detected"
            open={setupOpen.has('escape')}
            onOpenChange={(open) => setSetupOpen(toggleAnalyticsSetupOpen('escape', open))}
          >
            <p className="muted">
              How an issue is judged found in production, driving the escape-rate metric.
            </p>
            <label className="field">
              Detect escapes by
              <select
                value={settings.escape_mode}
                onChange={(e) =>
                  setSettings({ ...settings, escape_mode: e.target.value as EscapeMode })
                }
              >
                <option value="labels">Jira labels</option>
                <option value="issue_type">Issue type</option>
              </select>
            </label>

            {settings.escape_mode === 'labels' ? (
              <label className="field">
                Production labels
                <input
                  type="text"
                  value={prodLabelsText}
                  placeholder="found-in-prod"
                  onChange={(e) => setProdLabelsText(e.target.value)}
                />
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  Comma-separated Jira labels.
                </span>
              </label>
            ) : (
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend>Escape issue types</legend>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem' }}>
                  {ESCAPE_TYPE_OPTIONS.map((t) => (
                    <label
                      key={t}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <input
                        type="checkbox"
                        checked={settings.prod_issue_types.includes(t)}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            prod_issue_types: e.target.checked
                              ? [...settings.prod_issue_types, t]
                              : settings.prod_issue_types.filter((x) => x !== t),
                          })
                        }
                      />
                      {t}
                    </label>
                  ))}
                </div>
                <span
                  className="muted"
                  style={{ display: 'block', fontSize: '0.75rem', marginTop: 4 }}
                >
                  Issues of the selected types count as escapes. Pick at least one.
                </span>
              </fieldset>
            )}
          </SetupSection>
        </div>

        <div className="bb-settings-sticky-save">
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save analytics settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
