'use client';
import type { QaSlipRow } from '@momus/domain';

export function QaSlipPanel({ rows, loading }: { rows: QaSlipRow[]; loading?: boolean }) {
  if (loading && !rows.length)
    return (
      <section className="bb-analytics-risk">
        <div className="bb-skeleton" style={{ minHeight: 220 }} />
      </section>
    );
  return (
    <section className="bb-analytics-risk" aria-label="QA bug slip by member">
      <div className="bb-analytics-risk__header">
        <h2>QA Bug Slip</h2>
        <p>
          Defects use reporter. Bugs use QA ownership or reporter; each matching bug is counted
          once.
        </p>
      </div>
      {!rows.length ? (
        <p className="muted">No QA roster members yet. Add them from Settings → Roster.</p>
      ) : (
        <div className="bb-table-wrap">
          <table className="bb-table bb-qa-slip-table">
            <thead>
              <tr>
                <th>QA member</th>
                <th className="bb-qa-slip-table__number">Bugs</th>
                <th className="bb-qa-slip-table__number">Defects</th>
                <th className="bb-qa-slip-table__number">Bug ratio</th>
                <th className="bb-qa-slip-table__number">Bug slip</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.member_id}>
                  <td>{row.name}</td>
                  <td className="bb-qa-slip-table__number">{row.bugs}</td>
                  <td className="bb-qa-slip-table__number">{row.defects}</td>
                  <td className="bb-qa-slip-table__number">{row.bug_ratio?.toFixed(2) ?? '—'}</td>
                  <td className="bb-qa-slip-table__number">{row.bug_slip_pct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
