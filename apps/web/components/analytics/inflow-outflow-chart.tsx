'use client';

import { useEffect, useRef } from 'react';
import type { AnalyticsTrendsResult } from '@momus/domain';
import Chart from 'chart.js/auto';

type Props = {
  trends: AnalyticsTrendsResult | null;
  loading?: boolean;
  onPeriodSelect?: (periodKey: string, label: string) => void;
};

function hasFlow(trends: AnalyticsTrendsResult | null): boolean {
  return !!trends?.labels.length && trends.created != null;
}

export function InflowOutflowChart({ trends, loading, onPeriodSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasFlow(trends)) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();

    chartRef.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: trends!.labels,
        datasets: [
          {
            type: 'bar',
            label: 'Created (inflow)',
            data: trends!.created ?? [],
            backgroundColor: 'rgba(13, 115, 119, 0.65)',
            borderColor: '#0d7377',
            borderWidth: 1,
            yAxisID: 'y',
            order: 3,
          },
          {
            type: 'bar',
            label: 'Resolved (outflow)',
            data: trends!.resolved ?? [],
            backgroundColor: 'rgba(201, 76, 76, 0.65)',
            borderColor: '#c94c4c',
            borderWidth: 1,
            yAxisID: 'y',
            order: 3,
          },
          {
            type: 'line',
            label: 'Net',
            data: trends!.net ?? [],
            borderColor: '#8a6d3b',
            backgroundColor: 'transparent',
            tension: 0.2,
            yAxisID: 'y',
            order: 1,
          },
          {
            type: 'line',
            label: 'Open backlog',
            data: trends!.backlog ?? [],
            borderColor: '#3d8ea5',
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            tension: 0.2,
            yAxisID: 'y1',
            order: 2,
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
          const key = trends!.period_keys?.[idx];
          const label = trends!.labels[idx];
          if (key && label) onPeriodSelect(key, label);
        },
        plugins: {
          legend: { position: 'bottom' },
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Issues per period' },
            beginAtZero: true,
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Open backlog' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [trends, onPeriodSelect]);

  if (loading && !hasFlow(trends)) {
    return (
      <div className="bb-analytics-chart">
        <div className="bb-skeleton" style={{ height: '100%', minHeight: 320 }} />
      </div>
    );
  }

  if (!hasFlow(trends)) {
    return <p className="muted">No inflow/outflow data for the current filters.</p>;
  }

  const downloadPng = () => {
    const src = canvasRef.current;
    if (!src) return;
    // Re-draw on a white background — the chart canvas is transparent.
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = `defect-inflow-outflow-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <div className="bb-analytics-chart">
      <div className="bb-analytics-chart__actions">
        <button type="button" className="btn btn-ghost" onClick={downloadPng}>
          Download PNG
        </button>
      </div>
      <canvas ref={canvasRef} />
      {onPeriodSelect ? (
        <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Bars show issues created vs resolved each period; the dashed line is the open backlog.
          Click a period to inspect its severity matrices.
        </p>
      ) : null}
    </div>
  );
}
