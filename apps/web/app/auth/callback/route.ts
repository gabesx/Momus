import { canAccessApp } from '@momus/domain';
import { UsersRepository, createServerClient } from '@momus/infra';
import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getSupabasePublicEnv } from '@/lib/supabase/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Same-origin relative path only; rejects protocol-relative and backslash tricks. */
function safeRedirectPath(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  try {
    const resolved = new URL(next, 'http://momus.local');
    if (resolved.origin !== 'http://momus.local') return '/';
    return `${resolved.pathname}${resolved.search}${resolved.hash}` || '/';
  } catch {
    return '/';
  }
}

function redirectWithCookies(
  url: URL,
  cookies: CookieToSet[],
): NextResponse {
  const response = NextResponse.redirect(url);
  for (const { name, value, options } of cookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}

function redirectToSignIn(
  request: NextRequest,
  error: 'auth' | 'denied' | 'not_allowlisted',
  cookies: CookieToSet[] = [],
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/sign-in';
  url.search = '';
  url.searchParams.set('error', error);
  return redirectWithCookies(url, cookies);
}

function authNameFromMetadata(meta: Record<string, unknown>): string | null {
  const name =
    (typeof meta.name === 'string' && meta.name.trim()) ||
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    null;
  return name;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (!code) {
    return redirectToSignIn(request, 'auth');
  }

  const redirectPath = safeRedirectPath(next);
  const cookiesToSet: CookieToSet[] = [];

  const { url, anonKey } = getSupabasePublicEnv();
  const supabase = createSupabaseServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies: CookieToSet[]) {
        cookies.forEach((cookie) => {
          cookiesToSet.push(cookie);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToSignIn(request, 'auth', cookiesToSet);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return redirectToSignIn(request, 'auth', cookiesToSet);
  }

  try {
    const repo = new UsersRepository(createServerClient());
    const result = await repo.ensureUser({
      authUserId: user.id,
      email: user.email,
      name: authNameFromMetadata(user.user_metadata ?? {}),
    });

    if (!result.ok) {
      await supabase.auth.signOut();
      return redirectToSignIn(request, 'not_allowlisted', cookiesToSet);
    }

    const access = canAccessApp({
      approvalStatus: result.user.approval_status,
      isCandidate: result.user.is_candidate,
    });

    if (access === 'denied') {
      await supabase.auth.signOut();
      return redirectToSignIn(request, 'denied', cookiesToSet);
    }

    if (access === 'pending') {
      return redirectWithCookies(
        new URL('/pending-approval', request.url),
        cookiesToSet,
      );
    }

    return redirectWithCookies(new URL(redirectPath, request.url), cookiesToSet);
  } catch {
    await supabase.auth.signOut();
    return redirectToSignIn(request, 'auth', cookiesToSet);
  }
}
