'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api-client';

export type MeUser = {
  id: number;
  email: string;
  name: string;
  permissions: string[];
};

/** Current signed-in user, or null while loading / when signed out. */
export function useMe(): MeUser | null {
  const [user, setUser] = useState<MeUser | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await apiJson<{ user?: MeUser }>('/api/me');
      if (!active) return;
      setUser(res.success && res.user ? res.user : null);
    })();
    return () => {
      active = false;
    };
  }, []);

  return user;
}

/** True only once the user is loaded and actually holds the permission. */
export function useHasPermission(permission: string): boolean {
  const user = useMe();
  return user?.permissions.includes(permission) ?? false;
}
