import type { AnalyticsSummaryResult, AnalyticsTrendsResult } from './types';

function mom(delta: number | null): string {
  if (delta === null || delta === 0) return '';
  return ` (${delta > 0 ? '+' : ''}${delta}% MoM)`;
}

function topN<T>(entries: T[], n: number): T[] {
  return entries.slice(0, n);
}

export type AnalyticsDigestOptions = {
  dateLabel: string;
  dashboardUrl?: string;
};

/**
 * Weekly digest text (Slack mrkdwn-compatible): KPIs with deltas, risk,
 * speed/SLA, and top offenders for the default analytics window.
 */
export function buildAnalyticsDigest(
  summary: AnalyticsSummaryResult,
  trends: AnalyticsTrendsResult,
  options: AnalyticsDigestOptions,
): string {
  const { risk, resolution, response, distribution, escape } = summary;
  const lines: string[] = [];

  lines.push(`*Momus weekly defect digest — ${options.dateLabel}*`);
  lines.push(
    `• Issues: ${summary.total} total${mom(summary.mom.total)}, ` +
      `${summary.open} open${mom(summary.mom.open)}, ` +
      `resolution rate ${summary.resolution_rate}%${mom(summary.mom.resolution_rate)}`,
  );
  lines.push(
    `• Open risk: ${risk.open_critical_major} Critical/Major ` +
      `(${risk.open_critical_major_pct_of_open}% of open), ` +
      `${risk.open_long_overdue} long overdue`,
  );
  lines.push(
    `• MTTR: avg ${resolution.overall.avg_hours}h${mom(resolution.mom.avg_hours)} ` +
      `(median ${resolution.overall.median_hours}h); ` +
      `Critical/Major avg ${resolution.critical_major.avg_hours}h`,
  );
  lines.push(
    `• Triage: first response avg ${response.avg_days}d, ` +
      `${response.open_untouched} open untouched`,
  );
  const slaPart = (label: string, pct: number | null, days: number) =>
    `${label} ≤${days}d ${pct === null ? 'n/a' : `${pct}%`}`;
  lines.push(
    '• SLA: ' +
      [
        slaPart(
          'first response',
          response.sla_first_response.pct,
          response.sla_first_response.threshold_days,
        ),
        slaPart(
          'Critical',
          response.sla_critical_resolution.pct,
          response.sla_critical_resolution.threshold_days,
        ),
        slaPart(
          'Major',
          response.sla_major_resolution.pct,
          response.sla_major_resolution.threshold_days,
        ),
      ].join(', '),
  );
  lines.push(
    `• Quality: escape rate ${escape.pct}%, test traceability ${distribution.traceability.pct}%`,
  );

  const squads = topN(distribution.by_squad, 3)
    .map((e) => `${e.key} (${e.total})`)
    .join(', ');
  if (squads) lines.push(`• Top squads: ${squads}`);

  const engineers = topN(
    distribution.by_engineer.filter((e) => e.open > 0),
    3,
  )
    .map((e) => `${e.key} (${e.open} open)`)
    .join(', ');
  if (engineers) lines.push(`• Top open workload: ${engineers}`);

  const lastIdx = trends.labels.length - 1;
  if (lastIdx >= 0) {
    lines.push(
      `• Latest period ${trends.labels[lastIdx]}: ${trends.total[lastIdx]} created` +
        (trends.cost ? `, cost ${trends.cost[lastIdx]}` : ''),
    );
  }

  if (options.dashboardUrl) lines.push(`<${options.dashboardUrl}|Open the dashboard>`);

  return lines.join('\n');
}
