'use client';

import type { AnalyticsPeriodDetail } from '@momus/domain';

type Props = {
  detail: AnalyticsPeriodDetail | null;
  label: string | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

function MatrixTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: Array<{ key: string; cells: number[] }>;
}) {
  if (!rows.length) {
    return (
      <div>
        <h4>{title}</h4>
        <p className="muted">No data in this period.</p>
      </div>
    );
  }

  return (
    <div className="bb-analytics-matrix">
      <h4>{title}</h4>
      <div className="bb-table-wrap">
        <table className="bb-table">
          <thead>
            <tr>
              <th>Severity</th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                {row.cells.map((n, i) => (
                  <td key={`${row.key}-${i}`}>{n}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PeriodDetailPanel({ detail, label, loading, error, onClose }: Props) {
  if (!label && !detail && !loading && !error) return null;

  const priorityCols = detail
    ? Array.from(
        new Set(
          Object.values(detail.severity_by_priority).flatMap((m) => Object.keys(m)),
        ),
      ).sort()
    : [];

  const priorityRows = detail
    ? Object.keys(detail.severity_by_priority)
        .sort()
        .map((sev) => ({
          key: sev,
          cells: priorityCols.map((p) => detail.severity_by_priority[sev]?.[p] ?? 0),
        }))
    : [];

  const acRows = detail
    ? Object.keys(detail.severity_by_ac)
        .sort()
        .map((sev) => ({
          key: sev,
          cells: [
            detail.severity_by_ac[sev]?.ac ?? 0,
            detail.severity_by_ac[sev]?.non_ac ?? 0,
          ],
        }))
    : [];

  return (
    <section className="bb-analytics-chart-card bb-analytics-period-detail">
      <div className="bb-analytics-period-detail__header">
        <h2>Period detail{label ? `: ${label}` : ''}</h2>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>

      {error ? <p className="settings-alert settings-alert--error">{error}</p> : null}
      {loading && !detail ? <div className="bb-skeleton" style={{ minHeight: 120 }} /> : null}

      {detail ? (
        <>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            {detail.total} issues ({detail.bugs} bugs, {detail.defects} defects) · key{' '}
            <code>{detail.period_key}</code> · {detail.grain}
          </p>
          <div className="bb-analytics-period-detail__grids">
            <MatrixTable title="Severity × Priority" columns={priorityCols} rows={priorityRows} />
            <MatrixTable title="Severity × AC-related" columns={['AC', 'Non-AC']} rows={acRows} />
          </div>
        </>
      ) : null}
    </section>
  );
}
