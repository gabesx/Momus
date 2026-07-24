'use client';

import { useEffect, useState } from 'react';
import { ANALYTICS_KPI_THRESHOLDS, BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '@momus/domain';
import { apiJson } from '@/lib/api-client';

type EscapeMode = 'labels' | 'issue_type';

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

type AnalyticsSettings = {
  sla_first_response_days: number;
  sla_critical_resolution_days: number;
  sla_major_resolution_days: number;
  prod_labels: string[];
  escape_mode: EscapeMode;
  prod_issue_types: string[];
  digest_enabled: boolean;
  digest_webhook_url: string;
} & Record<KpiThresholdKey, number>;

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
  const [saving, setSaving] = useState(false);

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

  if (!settings) {
    return <div className="bb-skeleton" style={{ minHeight: 200 }} />;
  }

  const setNum = (key: keyof AnalyticsSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings({ ...settings, [key]: Number(e.target.value) });

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
        onAlert('success', 'Analytics settings saved');
      } else {
        onAlert('error', res.message ?? 'Failed to save analytics settings');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bb-layout">
      <div className="bb-main">
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
          <h2>KPI thresholds</h2>
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
        </section>

        <section className="settings-card">
          <h2>Defect escape detection</h2>
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
              <span className="muted" style={{ display: 'block', fontSize: '0.75rem', marginTop: 4 }}>
                Issues of the selected types count as escapes. Pick at least one.
              </span>
            </fieldset>
          )}
        </section>

        <section className="settings-card">
          <h2>Weekly digest</h2>
          <p className="muted">
            Posts a weekly analytics summary (KPIs, deltas, top offenders) to a
            Slack incoming-webhook URL every Monday morning.
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
            Slack webhook URL
            <input
              type="url"
              value={settings.digest_webhook_url}
              placeholder="https://hooks.slack.com/services/…"
              onChange={(e) => setSettings({ ...settings, digest_webhook_url: e.target.value })}
            />
          </label>
        </section>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save analytics settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
