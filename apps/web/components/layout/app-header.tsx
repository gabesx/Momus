'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson } from '@/lib/api-client';

type MeUser = {
  id: number;
  email: string;
  name: string;
  permissions: string[];
};

const NAV = [
  { href: '/', label: 'Defect Analytics', match: (p: string) => p === '/' },
  {
    href: '/tracker',
    label: 'Defect Tracker',
    match: (p: string) => p.startsWith('/tracker'),
  },
  {
    href: '/leaderboard',
    label: 'Leaderboard',
    match: (p: string) => p.startsWith('/leaderboard'),
  },
  {
    href: '/bug-budget',
    label: 'Bug Budget',
    match: (p: string) => p.startsWith('/bug-budget'),
  },
  {
    href: '/settings/users',
    label: 'Users',
    match: (p: string) => p.startsWith('/settings/users'),
    requires: 'manage_users' as const,
  },
  {
    href: '/settings/atlassian',
    label: 'Settings',
    match: (p: string) =>
      p.startsWith('/settings') && !p.startsWith('/settings/users'),
    requires: 'access_settings' as const,
  },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<MeUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadMe = useCallback(async () => {
    const res = await apiJson<{ user?: MeUser }>('/api/me');
    if (res.success && res.user) setUser(res.user);
    else setUser(null);
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const signOut = async () => {
    setSigningOut(true);
    const res = await apiJson('/api/auth/sign-out', { method: 'POST' });
    if (!res.success) {
      console.error('Sign out failed:', res.message ?? 'Unknown error');
      setSigningOut(false);
      return;
    }
    setSigningOut(false);
    setMenuOpen(false);
    router.push('/sign-in');
    router.refresh();
  };

  if (pathname === '/sign-in') return null;

  const links = NAV.filter(
    (item) => !item.requires || user?.permissions.includes(item.requires),
  );

  return (
    <header className="bb-app-header">
      <div className="bb-app-header__inner">
        <Link href="/" className="bb-app-brand">
          Momus
        </Link>

        <nav className="bb-app-nav" aria-label="Primary">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`bb-app-nav__link${item.match(pathname) ? ' is-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="bb-app-header__actions">
          {user ? (
            <span className="bb-app-user muted" title={user.email}>
              {user.name}
            </span>
          ) : null}

          <div className="bb-app-menu" ref={menuRef}>
            <button
              type="button"
              className="btn btn-outline bb-app-menu__toggle"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen((v) => !v)}
            >
              Menu
            </button>
            {menuOpen ? (
              <div className="bb-app-menu__panel" role="menu">
                {links.map((item) => (
                  <Link
                    key={`m-${item.href}`}
                    href={item.href}
                    role="menuitem"
                    className="bb-app-menu__item"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  className="bb-app-menu__item bb-app-menu__item--danger"
                  disabled={signingOut}
                  onClick={() => void signOut()}
                >
                  {signingOut ? 'Signing off…' : 'Sign Off'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
