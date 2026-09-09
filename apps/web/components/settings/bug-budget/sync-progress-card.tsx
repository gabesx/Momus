'use client';

import type { SyncStatusData } from './types';

type Props = {
  syncRun: SyncStatusData;
  pollHint: string;
};

export function SyncProgressCard({ syncRun, pollHint }: Props) {
  return (
    <section className="settings-card">
      <h2>Sync Progress</h2>
      <p>
        <strong>{syncRun.status}</strong>
        {pollHint ? ` — ${pollHint}` : ''}
        {syncRun.status === 'running' ? ` — Batch ${syncRun.current_batch}` : ''}
      </p>
      <div className="progress">
        <div className="progress__bar" style={{ width: `${syncRun.percentage}%` }} />
      </div>
      <p className="muted">
        {syncRun.percentage}% · Processed {syncRun.processed}
        {syncRun.total_issues ? ` / ${syncRun.total_issues}` : ''}
      </p>
      {syncRun.result && (
        <pre className="result-box">{JSON.stringify(syncRun.result, null, 2)}</pre>
      )}
      {syncRun.error_message && <p className="error-text">{syncRun.error_message}</p>}
    </section>
  );
}
