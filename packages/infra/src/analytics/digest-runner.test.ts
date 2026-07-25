import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { digestScheduleMatches, runAnalyticsDigest } from './digest-runner';
import { DEFAULT_ANALYTICS_SETTINGS } from '../supabase/analytics-settings';

describe('digestScheduleMatches', () => {
  const base = { ...DEFAULT_ANALYTICS_SETTINGS, digest_day: 'mon' as const, digest_hour: 8 };

  it('matches the configured Jakarta day + hour', () => {
    // 2026-07-27T01:00Z == Mon 08:00 Asia/Jakarta (UTC+7)
    expect(digestScheduleMatches(base, '2026-07-27T01:00:00Z')).toBe(true);
  });

  it('does not match a different hour or day', () => {
    expect(digestScheduleMatches(base, '2026-07-27T02:00:00Z')).toBe(false); // 09:00 Jakarta
    expect(digestScheduleMatches({ ...base, digest_day: 'tue' }, '2026-07-27T01:00:00Z')).toBe(
      false,
    );
  });
});

describe('runAnalyticsDigest', () => {
  it('throws before any DB work when no webhook is configured', async () => {
    const settings = { ...DEFAULT_ANALYTICS_SETTINGS, digest_webhook_url: '' };
    await expect(runAnalyticsDigest({} as SupabaseClient, settings)).rejects.toThrow(/webhook/i);
  });
});
