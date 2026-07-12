'use client';

import { useEffect, useState } from 'react';
import type { TrackerMissingFieldKey } from '@momus/domain';
import { TRACKER_MISSING_FIELD_KEYS, TRACKER_MISSING_FIELD_LABELS } from '@momus/domain';
import { apiJson } from '@/lib/api-client';

type Props = {
  open: boolean;
  excludedFields: string[];
  onClose: () => void;
  onSaved: (excluded: string[]) => void;
};

type SaveResponse = {
  success: boolean;
  message?: string;
  excluded_fields?: string[];
};

export function TrackerFieldSettingsModal({ open, excludedFields, onClose, onSaved }: Props) {
  const [draftExcluded, setDraftExcluded] = useState<Set<string>>(new Set(excludedFields));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraftExcluded(new Set(excludedFields));
      setError(null);
    }
  }, [open, excludedFields]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (key: string) => {
    setDraftExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const excluded = TRACKER_MISSING_FIELD_KEYS.filter((k) => draftExcluded.has(k));
    const res = await apiJson<SaveResponse>('/api/tracker/field-settings', {
      method: 'POST',
      body: JSON.stringify({ excluded_fields: excluded }),
    });
    setSaving(false);
    if (!res.success) {
      setError(res.message ?? 'Failed to save field settings');
      return;
    }
    onSaved(res.excluded_fields ?? excluded);
    onClose();
  };

  return (
    <div
      className="bb-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Incomplete Field Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bb-modal__panel bb-tracker-field-settings">
        <div className="bb-modal__head">
          <div>
            <h2>Incomplete Field Settings</h2>
            <p className="muted" style={{ margin: '0.35rem 0 0' }}>
              Configure which fields should be tracked for incompleteness. Excluded fields will not
              appear in the Missing Fields column or filter options.
            </p>
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? (
          <div className="settings-alert settings-alert--error">
            <span>{error}</span>
          </div>
        ) : null}

        <ul className="bb-tracker-field-settings__list">
          {TRACKER_MISSING_FIELD_KEYS.map((key) => {
            const included = !draftExcluded.has(key);
            return (
              <li key={key}>
                <label className="bb-tracker-field-settings__item">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => toggle(key)}
                  />
                  <span>{TRACKER_MISSING_FIELD_LABELS[key as TrackerMissingFieldKey]}</span>
                  {!included ? (
                    <span className="bb-badge bb-badge--warning">Excluded</span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>

        <div className="bb-tracker-field-settings__actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setDraftExcluded(new Set())}
          >
            Include All
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setDraftExcluded(new Set(TRACKER_MISSING_FIELD_KEYS))}
          >
            Exclude All
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
