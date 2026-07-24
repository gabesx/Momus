import type { AnalyticsSummaryResult, AnalyticsTrendsResult } from './types';

function esc(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function line(...cells: unknown[]): string {
  return cells.map(esc).join(',');
}

export function analyticsCsvFilename(nowIso: string): string {
  return `defect-analytics-${nowIso.slice(0, 10)}.csv`;
}

/**
 * Full analytics export: KPI block, trend series, and distribution tables,
 * mirroring what the dashboard shows for the same filters.
 */
export function buildAnalyticsCsv(
  summary: AnalyticsSummaryResult,
  trends: AnalyticsTrendsResult,
  generatedAtIso: string,
): string {
  const lines: string[] = [];
  const { risk, resolution, response, distribution, escape } = summary;

  lines.push(line('Momus Defect Analytics'));
  lines.push(line('Generated', generatedAtIso));
  lines.push('');

  lines.push(line('KPI', 'Value'));
  lines.push(line('Total issues', summary.total));
  lines.push(line('Open issues', summary.open));
  lines.push(line('Resolved issues', summary.resolved));
  lines.push(line('Resolution rate (%)', summary.resolution_rate));
  lines.push(line('Avg age (days)', summary.avg_age));
  lines.push(line('Open Critical/Major', risk.open_critical_major));
  lines.push(line('Open long overdue', risk.open_long_overdue));
  lines.push(line('MTTR overall avg (hours)', resolution.overall.avg_hours));
  lines.push(line('MTTR overall median (hours)', resolution.overall.median_hours));
  lines.push(line('MTTR Critical/Major avg (hours)', resolution.critical_major.avg_hours));
  lines.push(line('Avg first response (days)', response.avg_days));
  lines.push(line('Untouched open issues', response.open_untouched));
  lines.push(
    line(
      `First response SLA (≤${response.sla_first_response.threshold_days}d) %`,
      response.sla_first_response.pct ?? 'n/a',
    ),
  );
  lines.push(
    line(
      `Critical resolution SLA (≤${response.sla_critical_resolution.threshold_days}d) %`,
      response.sla_critical_resolution.pct ?? 'n/a',
    ),
  );
  lines.push(
    line(
      `Major resolution SLA (≤${response.sla_major_resolution.threshold_days}d) %`,
      response.sla_major_resolution.pct ?? 'n/a',
    ),
  );
  lines.push(line('Test traceability (%)', distribution.traceability.pct));
  lines.push(line('Escape rate (%)', escape.pct));
  const totalCost = (trends.cost ?? []).reduce((a, b) => a + b, 0);
  lines.push(line('Bug cost (scope)', Math.round(totalCost * 10) / 10));
  lines.push('');

  const hasCost = trends.cost != null;
  const hasFlow = trends.created != null;
  lines.push(
    line(
      'Period',
      'Bugs',
      'Defects',
      'Total',
      'Resolution rate (%)',
      ...(hasCost ? ['Cost'] : []),
      ...(hasFlow ? ['Created', 'Resolved', 'Net', 'Backlog'] : []),
    ),
  );
  trends.labels.forEach((label, i) => {
    lines.push(
      line(
        label,
        trends.bugs[i] ?? 0,
        trends.defects[i] ?? 0,
        trends.total[i] ?? 0,
        trends.resolution_rate[i] ?? 0,
        ...(hasCost ? [trends.cost?.[i] ?? 0] : []),
        ...(hasFlow
          ? [
              trends.created?.[i] ?? 0,
              trends.resolved?.[i] ?? 0,
              trends.net?.[i] ?? 0,
              trends.backlog?.[i] ?? 0,
            ]
          : []),
      ),
    );
  });
  lines.push('');

  for (const [title, entries] of [
    ['Squad', distribution.by_squad],
    ['Service / feature', distribution.by_service],
    ['Engineer', distribution.by_engineer],
  ] as const) {
    lines.push(line(title, 'Total', 'Open', 'Open Critical/Major'));
    for (const e of entries) {
      lines.push(line(e.key, e.total, e.open, e.open_critical_major));
    }
    lines.push('');
  }

  return lines.join('\n');
}
