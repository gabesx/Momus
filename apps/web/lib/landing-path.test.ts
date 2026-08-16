import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_USER_PERMISSIONS } from '@momus/shared';
import { landingPathFor } from './landing-path';
import { APP_ROUTES } from './routes';

describe('landingPathFor', () => {
  it('sends analytics users to the dashboard', () => {
    expect(landingPathFor(['view_analytics', 'view_leaderboard'])).toBe('/');
  });

  it('falls back to the first page the user can actually open', () => {
    expect(landingPathFor(['view_leaderboard'])).toBe('/leaderboard');
    expect(landingPathFor(['manage_users'])).toBe('/settings/users');
    expect(landingPathFor(['view_executive_reports'])).toBe('/reports/executive');
  });

  it('sends a user with no permissions to /no-access', () => {
    expect(landingPathFor([])).toBe('/no-access');
  });

  it('ignores permissions it does not know', () => {
    expect(landingPathFor(['something_else'])).toBe('/no-access');
  });

  /**
   * The redirect-loop guard: whatever we send a user to must itself be a page
   * they hold the permission for, otherwise its own gate bounces them again.
   */
  it('never returns a page the user cannot open', () => {
    for (const permission of ALL_USER_PERMISSIONS) {
      const target = landingPathFor([permission]);
      const route = APP_ROUTES.find((r) => r.href === target);
      expect(route, `no landing route for ${permission}`).toBeDefined();
      expect(route?.permission).toBe(permission);
    }
  });

  it('covers every permission, so no one is stranded on /no-access', () => {
    for (const permission of ALL_USER_PERMISSIONS) {
      expect(landingPathFor([permission])).not.toBe('/no-access');
    }
  });
});

/**
 * Pages that intentionally render without a permission check: the signed-out
 * flow, plus redirect-only shims that render nothing and forward to a page
 * which is itself gated.
 */
const UNGATED_PAGES = new Set([
  'sign-in',
  'pending-approval',
  'no-access',
  'auth/auth-code-error',
  'analytics', // redirects to /
  'signed-out', // redirects to /sign-in
]);

function findPages(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'api') continue;
      out.push(...findPages(join(dir, entry.name), rel));
    } else if (entry.name === 'page.tsx') {
      out.push(base || '/');
    }
  }
  return out;
}

/**
 * Catches the gap where a new page ships reachable by URL because only its API
 * was gated — the reason /bug-budget/[id] slipped through review.
 */
describe('page guards', () => {
  const appDir = join(__dirname, '..', 'app');

  it('every page either checks a permission or is explicitly public', () => {
    const ungated: string[] = [];

    for (const page of findPages(appDir)) {
      if (UNGATED_PAGES.has(page)) continue;
      const file = join(appDir, page === '/' ? '' : page, 'page.tsx');
      if (!readFileSync(file, 'utf8').includes('requirePagePermission')) {
        ungated.push(page);
      }
    }

    expect(ungated, `add requirePagePermission or list as public: ${ungated.join(', ')}`).toEqual(
      [],
    );
  });
});
