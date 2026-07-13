'use client';

import {
  firstResponseTone,
  slaComplianceTone,
  type AnalyticsSlaCompliance,
  type AnalyticsSummaryResult,
} from '@momus/domain';

type Props = {
  summary: AnalyticsSummaryResult | null;
  loading?: boolean;
};

function thresholdClass(tone: 'ok' | 'warning' | 'danger' | 'neutral'): string {
  if (tone === 'danger') return 'bb-analytics-metric-card--threshold-danger';
  if (tone === 'warning') return 'bb-analytics-metric-card--threshold-warning';
  if (tone === 'ok') return 'bb-analytics-metric-card--threshold-ok';
  return '';
}

function SlaCard({ label, sla }: { label: string; sla: AnalyticsSlaCompliance }) {
  return (
    <div
      className={`bb-analytics-metric-card ${thresholdClass(slaComplianceTone(sla.pct))}`.trim()}
    >
      <div className="bb-analytics-metric-card__label">{label}</div>
      <div className="bb-analytics-metric-card__value">
        {sla.pct !== null ? `${sla.pct}%` : '—'}
      </div>
      <div className="bb-analytics-risk__meta">
        {sla.pct !== null ? `${sla.within}/${sla.eligible} within SLA` : 'no eligible issues'}
      </div>
    </div>
  );
}

export function TriagePanel({ summary, loading }: Props) {
  if (loading && !summary) {
    return (
      <div className="bb-analytics-risk">
        <div className="bb-skeleton" style={{ minHeight: 140 }} />
      </div>
    );
  }
  if (!summary) return null;

  const { response } = summary;
  const hasResponses = response.responded_count > 0;

  return (
    <section className="bb-analytics-risk" aria-label="Triage and SLA">
      <div className="bb-analytics-risk__header">
        <h2>Triage &amp; SLA</h2>
        <p>How fast issues get a first response, and SLA compliance of resolutions</p>
      </div>

      <div className="bb-analytics-risk__kpis bb-analytics-risk__kpis--wide">
        <div
          className={`bb-analytics-metric-card ${
            hasResponses ? thresholdClass(firstResponseTone(response.avg_days)) : ''
          }`.trim()}
        >
          <div className="bb-analytics-metric-card__label">Avg first response</div>
          <div className="bb-analytics-metric-card__value">
            {hasResponses ? `${response.avg_days}d` : '—'}
          </div>
          <div className="bb-analytics-risk__meta">
            {hasResponses
              ? `median ${response.median_days}d · ${response.responded_count} responded`
              : 'no first-response data in scope'}
          </div>
        </div>

        <div
          className={`bb-analytics-metric-card ${
            response.open_untouched > 0 ? 'bb-analytics-metric-card--threshold-warning' : ''
          }`.trim()}
        >
          <div className="bb-analytics-metric-card__label">Untouched (open)</div>
          <div className="bb-analytics-metric-card__value">{response.open_untouched}</div>
          <div className="bb-analytics-risk__meta">open issues with no first response</div>
        </div>

        <SlaCard
          label={`First response ≤ ${response.sla_first_response.threshold_days}d`}
          sla={response.sla_first_response}
        />
        <SlaCard
          label={`Critical resolved ≤ ${response.sla_critical_resolution.threshold_days}d`}
          sla={response.sla_critical_resolution}
        />
        <SlaCard
          label={`Major resolved ≤ ${response.sla_major_resolution.threshold_days}d`}
          sla={response.sla_major_resolution}
        />
      </div>
    </section>
  );
}
