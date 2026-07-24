'use client';

import type { AnalyticsSummaryResult } from '@momus/domain';

type Props = {
  summary: AnalyticsSummaryResult | null;
  loading?: boolean;
};

/** Show the worst N squads (matrix rows are already ordered worst-first). */
const TOP_N = 10;

/** Red intensity scaled by cell/max; white text once the fill is dark enough. */
function cellStyle(count: number, max: number): React.CSSProperties {
  if (!count) return {};
  const t = max > 0 ? count / max : 0;
  const alpha = 0.12 + 0.68 * t;
  return {
    backgroundColor: `rgba(201, 76, 76, ${alpha.toFixed(3)})`,
    color: t > 0.6 ? '#fff' : 'inherit',
    fontWeight: 600,
  };
}

export function SquadHeatPanel({ summary, loading }: Props) {
  if (loading && !summary) {
    return (
      <div className="bb-analytics-risk">
        <div className="bb-skeleton" style={{ minHeight: 200 }} />
      </div>
    );
  }
  if (!summary) return null;

  const heat = summary.distribution.squad_heat;
  const hasData = !!heat && heat.squads.length > 0 && heat.severities.length > 0;

  return (
    <section className="bb-analytics-risk" aria-label="Squad severity heat map">
      <div className="bb-analytics-risk__header">
        <h2>Squad heat map</h2>
        <p>Open issues by squad and severity — darker means more open</p>
      </div>

      {!hasData ? (
        <p className="muted">No open issues in scope.</p>
      ) : (
        (() => {
          const rows = heat!.squads.slice(0, TOP_N);
          const rest = heat!.squads.length - rows.length;
          return (
            <div style={{ overflowX: 'auto' }}>
              <table className="bb-analytics-heat" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>
                      Squad
                    </th>
                    {heat!.severities.map((sev) => (
                      <th key={sev} scope="col" style={{ textAlign: 'center', padding: '0.4rem 0.6rem' }}>
                        {sev}
                      </th>
                    ))}
                    <th scope="col" style={{ textAlign: 'center', padding: '0.4rem 0.6rem' }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((squad) => (
                    <tr key={squad}>
                      <th scope="row" style={{ textAlign: 'left', padding: '0.4rem 0.6rem', fontWeight: 500 }}>
                        {squad}
                      </th>
                      {heat!.severities.map((sev) => {
                        const count = heat!.open[squad]?.[sev] ?? 0;
                        return (
                          <td
                            key={sev}
                            style={{
                              textAlign: 'center',
                              padding: '0.4rem 0.6rem',
                              ...cellStyle(count, heat!.max),
                            }}
                            title={`${squad} · ${sev}: ${count} open`}
                          >
                            {count || ''}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', padding: '0.4rem 0.6rem', fontWeight: 600 }}>
                        {heat!.row_totals[squad] ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>
                      Total (all squads)
                    </th>
                    {heat!.severities.map((sev) => (
                      <td key={sev} style={{ textAlign: 'center', padding: '0.4rem 0.6rem', fontWeight: 600 }}>
                        {heat!.col_totals[sev] ?? 0}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', padding: '0.4rem 0.6rem', fontWeight: 700 }}>
                      {Object.values(heat!.col_totals).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {rest > 0 ? <p className="muted bb-analytics-dist__more">+{rest} more squads</p> : null}
            </div>
          );
        })()
      )}
    </section>
  );
}
