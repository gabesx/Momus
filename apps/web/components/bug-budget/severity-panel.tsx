'use client';

import { useEffect, useState } from 'react';
import { SEVERITY_ORDER, type StatsResult } from '@momus/domain';

const DETAIL_KEY = 'momus.bugBudget.severityDetail';

type Props = {
  breakdown: StatsResult['severity_breakdown'] | null | undefined;
};

export function SeverityPanel({ breakdown }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(sessionStorage.getItem(DETAIL_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try {
        sessionStorage.setItem(DETAIL_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (!breakdown) return null;

  const rows = SEVERITY_ORDER.map((sev) => ({
    sev,
    data: breakdown[sev],
  })).filter((r) => r.data && r.data.total > 0);

  if (rows.length === 0) {
    return (
      <section className="settings-card bb-severity">
        <h3 style={{ marginTop: 0 }}>Severity breakdown</h3>
        <p className="muted">No severity data for the current filters.</p>
      </section>
    );
  }

  const max = Math.max(...rows.map((r) => r.data!.total));

  return (
    <section className="settings-card bb-severity">
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Severity breakdown</h3>
        <button type="button" className="btn btn-ghost" onClick={toggle}>
          {open ? 'Hide AC / priority detail' : 'Show AC / priority detail'}
        </button>
      </div>
      {rows.map(({ sev, data }) => (
        <div key={sev}>
          <div className="bb-severity__row">
            <span>{sev}</span>
            <div className="bb-severity__bar-track">
              <div
                className="bb-severity__bar"
                style={{ width: `${Math.round((data!.total / max) * 100)}%` }}
              />
            </div>
            <strong>{data!.total}</strong>
          </div>
          {open ? (
            <div className="bb-severity__detail">
              AC-related {data!.ac_related} · Non-AC {data!.non_ac_related} · High{' '}
              {data!.high_priority} · Med {data!.medium_priority} · Low {data!.low_priority}
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
