'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api-client';

export type MeUser = {
  id: number;
  email: string;
  name: string;
  permissions: string[];
};

export type MeState = {
  user: MeUser | null;
  /**
   * False until the request settles. Callers must not treat a missing
   * permission as denied while this is false, or gated UI flashes in.
   */
  loaded: boolean;
};

/** Shared across components so mounting several never refetches /api/me. */
let pending: Promise<MeUser | null> | null = null;
let snapshot: { user: MeUser | null } | null = null;

function loadMe(): Promise<MeUser | null> {
  pending ??= apiJson<{ user?: MeUser }>('/api/me')
    .then((res) => {
      const user = res.success && res.user ? res.user : null;
      snapshot = { user };
      return user;
    })
    .catch(() => {
      // Leave the cache empty so the next mount retries.
      pending = null;
      return null;
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
    snapshot ? { user: snapshot.user, loaded: true } : { user: null, loaded: false },
  );

  useEffect(() => {
    if (state.loaded) return;
    let active = true;
    void loadMe().then((user) => {
      if (active) setState({ user, loaded: true });
    });
    return () => {
      active = false;
    };
  }, [state.loaded]);

  return state;
}
