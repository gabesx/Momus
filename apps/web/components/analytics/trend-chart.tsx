'use client';

import { useEffect, useRef } from 'react';
import type { AnalyticsTrendsResult } from '@momus/domain';
import Chart from 'chart.js/auto';

type Props = {
  trends: AnalyticsTrendsResult | null;
  loading?: boolean;
  onPeriodSelect?: (periodKey: string, label: string) => void;
};

export function TrendChart({ trends, loading, onPeriodSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !trends?.labels.length) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: trends.labels,
        datasets: [
          {
            label: 'Bugs',
            data: trends.bugs,
            borderColor: '#0d6efd',
            backgroundColor: 'transparent',
            tension: 0.2,
            yAxisID: 'y',
          },
          {
            label: 'Defects',
            data: trends.defects,
            borderColor: '#dc3545',
            backgroundColor: 'transparent',
            tension: 0.2,
            yAxisID: 'y',
          },
          {
            label: 'Total Issues',
            data: trends.total,
            borderColor: '#20c997',
            backgroundColor: 'transparent',
            tension: 0.2,
            yAxisID: 'y',
          },
          {
            label: 'Resolution Rate (%)',
            data: trends.resolution_rate,
            borderColor: '#6f42c1',
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            tension: 0.2,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        onClick: (_evt, elements) => {
          if (!onPeriodSelect || !elements.length) return;
          const idx = elements[0].index;
          const key = trends.period_keys?.[idx];
          const label = trends.labels[idx];
          if (key && label) onPeriodSelect(key, label);
        },
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Number of Issues' },
            beginAtZero: true,
          },
          y1: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Resolution Rate (%)' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [trends, onPeriodSelect]);

  if (loading && !trends?.labels.length) {
    return (
      <div className="bb-analytics-chart">
        <div className="bb-skeleton" style={{ height: '100%', minHeight: 320 }} />
      </div>
    );
  }

  if (!trends?.labels.length) {
    return <p className="muted">No trend data for the current filters.</p>;
  }

  return (
    <div className="bb-analytics-chart">
      <canvas ref={canvasRef} />
      {onPeriodSelect ? (
        <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Click a point to inspect severity matrices for that period.
        </p>
      ) : null}
    </div>
  );
}
