'use client';

import type { SyncStatusData } from './types';

type Props = {
  syncRun: SyncStatusData;
  pollHint: string;
};

export function SyncProgressCard({ syncRun, pollHint }: Props) {
  const running = syncRun.status === 'running' || syncRun.status === 'queued';

  return (
    <section className={`settings-card bb-progress-card${running ? ' is-live' : ''}`}>
      <header className="bb-progress-card__head">
        <h2>Sync progress</h2>
        <span className={`status-pill ${syncRun.status === 'completed' ? 'ok' : syncRun.status === 'failed' ? 'bad' : ''}`}>
          {syncRun.status}
        </span>
      </header>
      <p className="muted bb-progress-card__meta">
        {pollHint || (syncRun.status === 'running' ? `Batch ${syncRun.current_batch}` : '—')}
      </p>
      <div className="progress">
        <div className="progress__bar" style={{ width: `${syncRun.percentage}%` }} />
      </div>
      <p className="bb-progress-card__counts">
        <strong>{syncRun.percentage}%</strong>
        <span className="muted">
          · {syncRun.processed}
          {syncRun.total_issues ? ` / ${syncRun.total_issues}` : ''} processed
        </span>
      </p>
      {syncRun.result && (
        <pre className="result-box">{JSON.stringify(syncRun.result, null, 2)}</pre>
      )}
      {syncRun.error_message && <p className="error-text">{syncRun.error_message}</p>}
    </section>
  );
}
