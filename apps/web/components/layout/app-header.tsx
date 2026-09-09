'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiJson } from '@/lib/api-client';
import { APP_ROUTES } from '@/lib/routes';
import { clearMeCache, useMe, type AppFlags } from '@/lib/use-me';

const PRODUCT_HREFS = new Set([
  '/',
  '/reports/executive',
  '/tracker',
  '/leaderboard',
  '/bug-budget',
]);

/** Product routes gated by menu flags; reports/settings always pass. */
function routeShown(href: string, flags: AppFlags): boolean {
  if (href === '/') return flags.show_defect_analytics;
  if (href === '/tracker') return flags.show_defect_tracker;
  if (href === '/leaderboard') return flags.show_leaderboard;
  if (href === '/bug-budget') return flags.show_bug_budget;
  return true;
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, flags, loaded } = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
    clearMeCache();
    router.push('/sign-in');
    router.refresh();
  };

  if (
    pathname === '/sign-in' ||
    pathname === '/pending-approval' ||
    pathname.startsWith('/auth/')
  ) {
    return null;
  }

  // Nothing gated renders until permissions are known, so the nav appears once
  // in its final state rather than popping items in when /api/me lands.
  const links = loaded
    ? APP_ROUTES.filter(
        (route) =>
          routeShown(route.href, flags) &&
          Boolean(user?.permissions.includes(route.permission)),
      )
    : [];

  const brandHref =
    links.find((l) => PRODUCT_HREFS.has(l.href))?.href ??
    links.find((l) => l.href.startsWith('/settings'))?.href ??
    '/no-access';


  return (
    <header className="bb-app-header">
      <div className="bb-app-header__inner">
        <Link href={brandHref} className="bb-app-brand">
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
