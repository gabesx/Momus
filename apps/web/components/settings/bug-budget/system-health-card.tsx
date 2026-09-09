'use client';

type Props = {
  stats: { total: number; bugs: number; open: number } | null;
  onRefresh: () => void;
};

export function SystemHealthCard({ stats, onRefresh }: Props) {
  return (
    <section className="settings-card settings-card--side">
      <h3>System Health</h3>
      <div className="health-grid">
        <div>
          <span>Total Issues</span>
          <strong>{stats?.total ?? '—'}</strong>
        </div>
        <div>
          <span>Bugs</span>
          <strong>{stats?.bugs ?? '—'}</strong>
        </div>
        <div>
          <span>Open</span>
          <strong>{stats?.open ?? '—'}</strong>
        </div>
      </div>
      <button type="button" className="btn btn-outline" onClick={onRefresh}>
        Refresh
      </button>
    </section>
  );
}
