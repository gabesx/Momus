'use client';

import { useEffect, useState } from 'react';
import {
  COLUMN_DEFS,
  type ColumnId,
  defaultVisibleColumns,
  saveVisibleColumns,
} from '@/lib/bug-budget-columns';

type Props = {
  open: boolean;
  initial: Record<ColumnId, boolean>;
  onClose: () => void;
  onApplied: (vis: Record<ColumnId, boolean>) => void;
};

export function ColumnVisibilityModal({ open, initial, onClose, onApplied }: Props) {
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="bb-modal" role="dialog" aria-modal="true" aria-label="Column visibility">
      <div className="bb-modal__panel" style={{ maxWidth: 520, margin: '4rem auto', flex: 'none' }}>
        <div className="bb-modal__head">
          <h2>Columns</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="settings-card">
          {COLUMN_DEFS.map((col) => (
            <label key={col.id} className="bb-switch" style={{ marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={Boolean(draft[col.id])}
                disabled={col.required}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [col.id]: e.target.checked, key: true }))
                }
              />
              {col.label}
              {col.optional ? <span className="muted"> (optional)</span> : null}
            </label>
          ))}
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setDraft(defaultVisibleColumns())}
            >
              Reset defaults
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const next = { ...draft, key: true as const };
                saveVisibleColumns(next);
                onApplied(next);
                onClose();
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
