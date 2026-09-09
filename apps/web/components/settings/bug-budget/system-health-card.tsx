'use client';

type Props = {
  stats: { total: number; bugs: number; open: number } | null;
  onRefresh: () => void;
};

export function SystemHealthCard({ stats, onRefresh }: Props) {
  return (
    <section className="settings-card settings-card--side bb-health-card">
      <header className="bb-health-card__head">
        <h3>System Health</h3>
        <button type="button" className="btn btn-ghost bb-health-card__refresh" onClick={onRefresh}>
          Refresh
        </button>
      </header>
      <div className="bb-health-card__grid">
        <div className="bb-health-card__stat">
          <span>Total issues</span>
          <strong>{stats?.total ?? '—'}</strong>
        </div>
        <div className="bb-health-card__stat">
          <span>Bugs</span>
          <strong>{stats?.bugs ?? '—'}</strong>
        </div>
        <div className="bb-health-card__stat bb-health-card__stat--wide">
          <span>Open</span>
          <strong>{stats?.open ?? '—'}</strong>
        </div>
      </div>
    </section>
  );
}
