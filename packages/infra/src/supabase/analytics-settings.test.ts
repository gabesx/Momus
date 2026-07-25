import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ANALYTICS_SETTINGS,
  KPI_THRESHOLD_BOUNDS,
  effectiveThresholds,
  normalizeAnalyticsSettings,
  parseAnalyticsSettings,
} from '../supabase/analytics-settings';

const validSla = {
  sla_first_response_days: 2,
  sla_critical_resolution_days: 3,
  sla_major_resolution_days: 7,
};

describe('normalizeAnalyticsSettings — KPI thresholds', () => {
  it('fills KPI defaults when the raw value omits them', () => {
    const s = normalizeAnalyticsSettings({});
    expect(s.open_warning).toBe(DEFAULT_ANALYTICS_SETTINGS.open_warning);
    expect(s.resolution_rate_healthy_pct).toBe(
      DEFAULT_ANALYTICS_SETTINGS.resolution_rate_healthy_pct,
    );
    expect(s.escape_rate_warning_pct).toBe(DEFAULT_ANALYTICS_SETTINGS.escape_rate_warning_pct);
  });

  it('keeps in-range values and falls back on out-of-range ones', () => {
    const s = normalizeAnalyticsSettings({
      open_warning: 250,
      resolution_rate_healthy_pct: 150, // out of 0..100 → fallback
      mttr_critical_major_warning_hours: 48,
    });
    expect(s.open_warning).toBe(250);
    expect(s.mttr_critical_major_warning_hours).toBe(48);
    expect(s.resolution_rate_healthy_pct).toBe(
      DEFAULT_ANALYTICS_SETTINGS.resolution_rate_healthy_pct,
    );
  });
});

describe('parseAnalyticsSettings — KPI thresholds', () => {
  it('accepts a payload without KPI fields (older forms) and defaults them', () => {
    const s = parseAnalyticsSettings({ ...validSla });
    expect(s.open_warning).toBe(DEFAULT_ANALYTICS_SETTINGS.open_warning);
  });

  it('round-trips valid KPI overrides', () => {
    const s = parseAnalyticsSettings({
      ...validSla,
      open_warning: 80,
      avg_age_warning_days: 21,
      escape_rate_warning_pct: 5,
    });
    expect(s.open_warning).toBe(80);
    expect(s.avg_age_warning_days).toBe(21);
    expect(s.escape_rate_warning_pct).toBe(5);
  });

  it('throws when a present KPI threshold is out of range', () => {
    expect(() =>
      parseAnalyticsSettings({ ...validSla, escape_rate_warning_pct: 500 }),
    ).toThrow(/escape_rate_warning_pct must be a number between 0 and 100/);
    expect(() => parseAnalyticsSettings({ ...validSla, open_warning: 0 })).toThrow(
      /open_warning must be a number between 1 and 100000/,
    );
  });

  it('bounds spec covers all eight configurable KPI thresholds', () => {
    expect(Object.keys(KPI_THRESHOLD_BOUNDS)).toHaveLength(8);
  });
});

describe('escape detection settings', () => {
  it('defaults to labels mode with no issue types', () => {
    const s = normalizeAnalyticsSettings({});
    expect(s.escape_mode).toBe('labels');
    expect(s.prod_issue_types).toEqual([]);
  });

  it('normalizes issue-type mode and dedupes/trims the type list', () => {
    const s = normalizeAnalyticsSettings({
      escape_mode: 'issue_type',
      prod_issue_types: ['Bug', ' Bug ', 'Defect Task'],
    });
    expect(s.escape_mode).toBe('issue_type');
    expect(s.prod_issue_types).toEqual(['Bug', 'Defect Task']);
  });

  it('coerces an unknown escape_mode back to labels', () => {
    expect(normalizeAnalyticsSettings({ escape_mode: 'nonsense' }).escape_mode).toBe('labels');
  });

  it('parse rejects issue_type mode with no types selected', () => {
    expect(() =>
      parseAnalyticsSettings({ ...validSla, escape_mode: 'issue_type', prod_issue_types: [] }),
    ).toThrow(/at least one issue type/i);
  });

  it('parse accepts issue_type mode with types', () => {
    const s = parseAnalyticsSettings({
      ...validSla,
      escape_mode: 'issue_type',
      prod_issue_types: ['Bug'],
    });
    expect(s.escape_mode).toBe('issue_type');
    expect(s.prod_issue_types).toEqual(['Bug']);
  });
});

describe('effectiveThresholds', () => {
  it('extracts the 8 KPI thresholds plus first-response SLA from settings', () => {
    const t = effectiveThresholds(DEFAULT_ANALYTICS_SETTINGS);
    expect(Object.keys(t).sort()).toEqual(
      [...Object.keys(KPI_THRESHOLD_BOUNDS), 'sla_first_response_days'].sort(),
    );
    expect(t.open_warning).toBe(DEFAULT_ANALYTICS_SETTINGS.open_warning);
    expect(t.sla_first_response_days).toBe(DEFAULT_ANALYTICS_SETTINGS.sla_first_response_days);
  });

  it('reflects overridden values', () => {
    const t = effectiveThresholds({
      ...DEFAULT_ANALYTICS_SETTINGS,
      open_warning: 42,
      escape_rate_warning_pct: 3,
    });
    expect(t.open_warning).toBe(42);
    expect(t.escape_rate_warning_pct).toBe(3);
  });
});
