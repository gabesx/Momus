'use client';

import { useEffect } from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/** Closable dialog for the full contents of a truncated "+N more" list. */
export function ListModal({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="bb-modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div
        className="bb-modal__panel"
        style={{ maxWidth: 640, margin: '4rem auto', flex: 'none', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bb-modal__head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="settings-card">{children}</div>
      </div>
    </div>
  );
}
