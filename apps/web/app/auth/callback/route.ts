import { canAccessApp } from '@momus/domain';
import { UsersRepository, createServerClient } from '@momus/infra';
import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getSupabasePublicEnv } from '@/lib/supabase/env';

function safeRedirectPath(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

function redirectToSignIn(
  request: NextRequest,
  error: 'auth' | 'denied' | 'not_allowlisted',
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/sign-in';
  url.search = '';
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
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
  let response = NextResponse.redirect(new URL(redirectPath, request.url));

  const { url, anonKey } = getSupabasePublicEnv();
  const supabase = createSupabaseServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToSignIn(request, 'auth');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return redirectToSignIn(request, 'auth');
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
      return redirectToSignIn(request, 'not_allowlisted');
    }

    const access = canAccessApp({
      approvalStatus: result.user.approval_status,
      isCandidate: result.user.is_candidate,
    });

    if (access === 'denied') {
      await supabase.auth.signOut();
      return redirectToSignIn(request, 'denied');
    }

    if (access === 'pending') {
      response = NextResponse.redirect(new URL('/pending-approval', request.url));
      return response;
    }

    return response;
  } catch {
    await supabase.auth.signOut();
    return redirectToSignIn(request, 'auth');
  }
}
