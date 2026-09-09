import { beforeEach, describe, expect, it } from 'vitest';
import {
  ANALYTICS_SETUP_OPEN_STORAGE_KEY,
  readAnalyticsSetupOpen,
  toggleAnalyticsSetupOpen,
  writeAnalyticsSetupOpen,
} from './analytics-settings-setup-open';

function installSessionStorage(): void {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

describe('analytics-settings-setup-open', () => {
  beforeEach(() => {
    installSessionStorage();
  });

  it('defaults to empty set when missing or invalid', () => {
    expect([...readAnalyticsSetupOpen()]).toEqual([]);
    sessionStorage.setItem(ANALYTICS_SETUP_OPEN_STORAGE_KEY, 'not-json');
    expect([...readAnalyticsSetupOpen()]).toEqual([]);
  });

  it('round-trips known section ids and ignores unknown', () => {
    writeAnalyticsSetupOpen(new Set(['kpi', 'escape', 'nope' as 'kpi']));
    expect([...readAnalyticsSetupOpen()].sort()).toEqual(['escape', 'kpi']);
  });

  it('toggleAnalyticsSetupOpen adds and removes then persists', () => {
    const opened = toggleAnalyticsSetupOpen('kpi', true);
    expect(opened.has('kpi')).toBe(true);
    expect(
      JSON.parse(sessionStorage.getItem(ANALYTICS_SETUP_OPEN_STORAGE_KEY)!),
    ).toContain('kpi');
    const closed = toggleAnalyticsSetupOpen('kpi', false);
    expect(closed.has('kpi')).toBe(false);
  });
});
