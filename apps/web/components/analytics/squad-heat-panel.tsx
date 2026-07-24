'use client';

import { useState } from 'react';
import type { AnalyticsSquadHeat, AnalyticsSummaryResult } from '@momus/domain';
import { ListModal } from './list-modal';

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

/** Render the heat table for a given subset of squads (footer totals are always all-squads). */
function HeatTable({ heat, squads }: { heat: AnalyticsSquadHeat; squads: string[] }) {
  const cell = { textAlign: 'center', padding: '0.4rem 0.6rem' } as const;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="bb-analytics-heat" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>
              Squad
            </th>
            {heat.severities.map((sev) => (
              <th key={sev} scope="col" style={cell}>
                {sev}
              </th>
            ))}
            <th scope="col" style={cell}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {squads.map((squad) => (
            <tr key={squad}>
              <th scope="row" style={{ textAlign: 'left', padding: '0.4rem 0.6rem', fontWeight: 500 }}>
                {squad}
              </th>
              {heat.severities.map((sev) => {
                const count = heat.open[squad]?.[sev] ?? 0;
                return (
                  <td
                    key={sev}
                    style={{ ...cell, ...cellStyle(count, heat.max) }}
                    title={`${squad} · ${sev}: ${count} open`}
                  >
                    {count || ''}
                  </td>
                );
              })}
              <td style={{ ...cell, fontWeight: 600 }}>{heat.row_totals[squad] ?? 0}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>
              Total (all squads)
            </th>
            {heat.severities.map((sev) => (
              <td key={sev} style={{ ...cell, fontWeight: 600 }}>
                {heat.col_totals[sev] ?? 0}
              </td>
            ))}
            <td style={{ ...cell, fontWeight: 700 }}>
              {Object.values(heat.col_totals).reduce((a, b) => a + b, 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function SquadHeatPanel({ summary, loading }: Props) {
  const [open, setOpen] = useState(false);

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
        <>
          <HeatTable heat={heat!} squads={heat!.squads.slice(0, TOP_N)} />
          {heat!.squads.length > TOP_N ? (
            <button
              type="button"
              className="btn btn-ghost bb-analytics-dist__more"
              style={{ marginTop: '0.5rem' }}
              onClick={() => setOpen(true)}
            >
              +{heat!.squads.length - TOP_N} more squads
            </button>
          ) : null}
          <ListModal open={open} title="Squad heat map — all squads" onClose={() => setOpen(false)}>
            <HeatTable heat={heat!} squads={heat!.squads} />
          </ListModal>
        </>
      )}
    </section>
  );
}
