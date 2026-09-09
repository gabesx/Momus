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

export function useMe(): MeState {
  const [state, setState] = useState<MeState>(() =>
    snapshot
      ? { user: snapshot.user, flags: snapshot.flags, loaded: true }
      : { user: null, flags: DEFAULT_FLAGS, loaded: false },
  );

  useEffect(() => {
    if (state.loaded) return;
    let active = true;
    void loadMe().then((me) => {
      if (active) setState({ user: me.user, flags: me.flags, loaded: true });
    });
    return () => {
      active = false;
    };
  }, [state.loaded]);

  return state;
}
