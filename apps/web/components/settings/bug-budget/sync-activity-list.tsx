'use client';

import { MESSAGES } from '@momus/shared';
import type { SyncActivity } from './types';

type Props = {
  activities: SyncActivity[];
  limit?: number;
};

export function SyncActivityList({ activities, limit = 5 }: Props) {
  const shown = activities.slice(0, limit);

  return (
    <section className="settings-card bb-activity-card">
      <header className="bb-activity-card__head">
        <div>
          <h2>Recent syncs</h2>
          <p className="muted">Last 7 days · showing {Math.min(limit, shown.length || limit)}</p>
        </div>
      </header>
      {shown.length === 0 ? (
        <p className="bb-activity-card__empty">{MESSAGES.M18}</p>
      ) : (
        <ul className="bb-activity-card__list">
          {shown.map((a) => {
            const result = a.result ?? {};
            const updated = Number(result.updated_issues ?? 0);
            const created = Number(result.new_issues ?? 0);
            const detail =
              created || updated
                ? `${a.processed} processed · ${created} new · ${updated} updated`
                : `${a.processed} processed`;
            return (
              <li key={a.id} className="bb-activity-card__item">
                <div className="bb-activity-card__main">
                  <strong>
                    {a.status === 'completed' ? 'Sync completed' : `Sync ${a.status}`}
                  </strong>
                  <span className="muted">{detail}</span>
                  <span className="muted bb-activity-card__time">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
                <span
                  className={`status-pill ${a.status === 'completed' ? 'ok' : a.status === 'failed' ? 'bad' : ''}`}
                >
                  {a.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
