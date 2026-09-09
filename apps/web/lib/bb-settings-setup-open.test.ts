import { beforeEach, describe, expect, it } from 'vitest';
import {
  SETUP_OPEN_STORAGE_KEY,
  readSetupOpen,
  toggleSetupOpen,
  writeSetupOpen,
} from './bb-settings-setup-open';

describe('bb-settings-setup-open', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('defaults to empty set when missing or invalid', () => {
    expect([...readSetupOpen()]).toEqual([]);
    sessionStorage.setItem(SETUP_OPEN_STORAGE_KEY, 'not-json');
    expect([...readSetupOpen()]).toEqual([]);
  });

  it('round-trips known section ids and ignores unknown', () => {
    writeSetupOpen(new Set(['projects', 'cron', 'nope' as 'projects']));
    expect([...readSetupOpen()].sort()).toEqual(['cron', 'projects']);
  });

  it('toggleSetupOpen adds and removes then persists', () => {
    const opened = toggleSetupOpen('multipliers', true);
    expect(opened.has('multipliers')).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(SETUP_OPEN_STORAGE_KEY)!)).toContain(
      'multipliers',
    );
    const closed = toggleSetupOpen('multipliers', false);
    expect(closed.has('multipliers')).toBe(false);
  });
});
