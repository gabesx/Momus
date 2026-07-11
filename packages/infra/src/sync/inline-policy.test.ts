import { describe, expect, it } from 'vitest';
import { shouldRunInlineSync } from './inline-policy';

describe('shouldRunInlineSync (BB-SYNC-07)', () => {
  it('defaults to inline in non-prod without Inngest key', () => {
    expect(shouldRunInlineSync({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('does not inline in production without force flag', () => {
    expect(shouldRunInlineSync({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('respects SYNC_INLINE_AFTER_RESPONSE override', () => {
    expect(
      shouldRunInlineSync({
        NODE_ENV: 'production',
        SYNC_INLINE_AFTER_RESPONSE: 'true',
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      shouldRunInlineSync({
        NODE_ENV: 'development',
        SYNC_INLINE_AFTER_RESPONSE: 'false',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('prefers Inngest when event key is set (unless forced)', () => {
    expect(
      shouldRunInlineSync({
        NODE_ENV: 'development',
        INNGEST_EVENT_KEY: 'abc',
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });
});
