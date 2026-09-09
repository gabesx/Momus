'use client';

import type { JqlExample } from './types';

type Props = {
  jql: string;
  syncType: string;
  batchSize: number;
  maxIssues: number;
  year: number;
  quarter: number;
  month: number;
  busy: string | null;
  jqlExamples: JqlExample[];
  onJqlChange: (value: string) => void;
  onSyncTypeChange: (value: string) => void;
  onBatchSizeChange: (value: number) => void;
  onMaxIssuesChange: (value: number) => void;
  onYearChange: (value: number) => void;
  onQuarterChange: (value: number) => void;
  onMonthChange: (value: number) => void;
  onApplyExample: (jql: string) => void;
  onSave: () => void;
  onSync: () => void;
  onPreview: () => void;
  onClearJql: () => void;
};

export function SyncOpsCard({
  jql,
  syncType,
  batchSize,
  maxIssues,
  year,
  quarter,
  month,
  busy,
  jqlExamples,
  onJqlChange,
  onSyncTypeChange,
  onBatchSizeChange,
  onMaxIssuesChange,
  onYearChange,
  onQuarterChange,
  onMonthChange,
  onApplyExample,
  onSave,
  onSync,
  onPreview,
  onClearJql,
}: Props) {
  return (
    <section className="settings-card bb-ops-card">
      <h2>JQL Query Configuration</h2>
      <p className="muted">Configure which Jira issues sync into Bug Budget.</p>
      <label className="field">
        <span>JQL Query</span>
        <textarea
          rows={5}
          value={jql}
          disabled={syncType !== 'custom'}
          onChange={(e) => onJqlChange(e.target.value)}
          placeholder='e.g. issuetype = Bug AND project = "YOURKEY"'
        />
        <small className="hint">Enter your own JQL from Jira. Nothing is pre-filled.</small>
      </label>
      <details className="jql-examples">
        <summary>JQL examples</summary>
        <ul className="example-list">
          {jqlExamples.map((ex) => (
            <li key={ex.label}>
              <button type="button" onClick={() => onApplyExample(ex.jql)}>
                {ex.label} →
              </button>
            </li>
          ))}
        </ul>
      </details>
      <div className="field-row">
        <label className="field">
          <span>Sync Type</span>
          <select value={syncType} onChange={(e) => onSyncTypeChange(e.target.value)}>
            <option value="custom">Custom JQL Query</option>
            <option value="quarterly">Quarterly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
        <label className="field">
          <span>Batch Size</span>
          <select
            value={batchSize}
            onChange={(e) => onBatchSizeChange(Number(e.target.value))}
          >
            {[25, 50, 100, 200, 500, 1000].map((n) => (
              <option key={n} value={n}>
                {n} issues per batch
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Max Total Issues</span>
          <input
            type="number"
            min={0}
            max={50000}
            value={maxIssues}
            onChange={(e) => onMaxIssuesChange(Number(e.target.value) || 0)}
          />
        </label>
      </div>
      {syncType !== 'custom' && (
        <div className="field-row">
          <label className="field">
            <span>Year</span>
            <input
              type="number"
              value={year}
              onChange={(e) => onYearChange(Number(e.target.value))}
            />
          </label>
          {syncType === 'quarterly' && (
            <label className="field">
              <span>Quarter</span>
              <select
                value={quarter}
                onChange={(e) => onQuarterChange(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </select>
            </label>
          )}
          {syncType === 'monthly' && (
            <label className="field">
              <span>Month</span>
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => onMonthChange(Number(e.target.value))}
              />
            </label>
          )}
        </div>
      )}
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!!busy}
          onClick={onSync}
        >
          {busy === 'sync' ? 'Queuing…' : 'Sync with Database'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={!!busy}
          onClick={onPreview}
        >
          {busy === 'preview' ? 'Fetching…' : 'Test Fetch (Preview Only)'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={!!busy}
          onClick={onSave}
        >
          {busy === 'save-jql' ? 'Saving…' : 'Save Configuration'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClearJql}>
          Clear JQL
        </button>
      </div>
    </section>
  );
}
