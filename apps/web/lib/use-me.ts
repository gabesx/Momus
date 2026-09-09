'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api-client';

export type MeUser = {
  id: number;
  email: string;
  name: string;
  permissions: string[];
};

export type AppFlags = {
  show_defect_analytics: boolean;
};

export type MeState = {
  user: MeUser | null;
  flags: AppFlags;
  /**
   * False until the request settles. Callers must not treat a missing
   * permission as denied while this is false, or gated UI flashes in.
   */
  loaded: boolean;
};

/** Fail-open so the Defect Analytics nav does not flash-hide while /api/me loads. */
const DEFAULT_FLAGS: AppFlags = { show_defect_analytics: true };

type MeSnapshot = { user: MeUser | null; flags: AppFlags };

/** Shared across components so mounting several never refetches /api/me. */
let pending: Promise<MeSnapshot> | null = null;
let snapshot: MeSnapshot | null = null;
const listeners = new Set<(me: MeSnapshot) => void>();

function notify(me: MeSnapshot): void {
  for (const listener of listeners) {
    listener(me);
  }
}

function loadMe(): Promise<MeSnapshot> {
  pending ??= apiJson<{ user?: MeUser; flags?: Partial<AppFlags> }>('/api/me')
    .then((res) => {
      const user = res.success && res.user ? res.user : null;
      const flags: AppFlags = {
        show_defect_analytics: res.success
          ? res.flags?.show_defect_analytics !== false
          : DEFAULT_FLAGS.show_defect_analytics,
      };
      snapshot = { user, flags };
      return snapshot;
    })
    .catch(() => {
      // Leave the cache empty so the next mount retries.
      pending = null;
      return { user: null, flags: DEFAULT_FLAGS };
    });
  return pending;
}

/** Drop the cached session, e.g. after signing out. */
export function clearMeCache(): void {
  pending = null;
  snapshot = null;
}

/**
 * Clear cache, refetch /api/me, update the shared snapshot, and notify every
 * mounted useMe subscriber (e.g. after analytics settings save flips a flag).
 */
export async function reloadMe(): Promise<MeSnapshot> {
  clearMeCache();
  const me = await loadMe();
  notify(me);
  return me;
}

export function useMe(): MeState {
  const [state, setState] = useState<MeState>(() =>
    snapshot
      ? { user: snapshot.user, flags: snapshot.flags, loaded: true }
      : { user: null, flags: DEFAULT_FLAGS, loaded: false },
  );

  useEffect(() => {
    let active = true;
    const onUpdate = (me: MeSnapshot) => {
      if (active) setState({ user: me.user, flags: me.flags, loaded: true });
    };
    listeners.add(onUpdate);

    void loadMe().then(onUpdate);

    return () => {
      active = false;
      listeners.delete(onUpdate);
    };
  }, []);

  return state;
}
