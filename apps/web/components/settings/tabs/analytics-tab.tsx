'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api-client';

type AnalyticsSettings = {
  sla_first_response_days: number;
  sla_critical_resolution_days: number;
  sla_major_resolution_days: number;
  prod_labels: string[];
  digest_enabled: boolean;
  digest_webhook_url: string;
};

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
          <h2>Defect escape labels</h2>
          <p className="muted">
            Jira labels marking an issue as found in production. Comma-separated;
            drives the escape-rate metric.
          </p>
          <label className="field">
            Production labels
            <input
              type="text"
              value={prodLabelsText}
              placeholder="found-in-prod"
              onChange={(e) => setProdLabelsText(e.target.value)}
            />
          </label>
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
