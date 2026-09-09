import { describe, expect, it, vi } from 'vitest';

vi.mock('@momus/infra', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@momus/infra')>();
  return {
    ...actual,
    createServerClient: vi.fn(),
    loadAnalyticsSettings: vi.fn(),
  };
});

import { loadAnalyticsSettings } from '@momus/infra';
import { loadShowDefectAnalytics } from './defect-analytics-gate';

describe('loadShowDefectAnalytics', () => {
  it('returns false when settings say so', async () => {
    vi.mocked(loadAnalyticsSettings).mockResolvedValue({
      show_defect_analytics: false,
    } as never);
    expect(await loadShowDefectAnalytics({} as never)).toBe(false);
  });

  it('fail-opens to true when load throws', async () => {
    vi.mocked(loadAnalyticsSettings).mockRejectedValue(new Error('db down'));
    expect(await loadShowDefectAnalytics({} as never)).toBe(true);
  });
});
