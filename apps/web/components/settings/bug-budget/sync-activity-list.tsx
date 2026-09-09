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
    <section className="settings-card">
      <h2>Sync Activity</h2>
      <p className="muted">History of synchronization events (last 7 days)</p>
      {shown.length === 0 ? (
        <p>{MESSAGES.M18}</p>
      ) : (
        <ul className="activity-list">
          {shown.map((a) => {
            const result = a.result ?? {};
            const updated = Number(result.updated_issues ?? 0);
            const created = Number(result.new_issues ?? 0);
            return (
              <li key={a.id}>
                <div>
                  <strong>
                    {a.status === 'completed' ? 'Jira Sync Completed' : `Sync ${a.status}`}
                  </strong>
                  <p className="muted">
                    Processed {a.processed} issues
                    {created || updated ? `: ${created} created, ${updated} updated` : ''}
                  </p>
                  <p className="muted">{new Date(a.created_at).toLocaleString()}</p>
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
