import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getSupabasePublicEnv } from '@/lib/supabase/env';

function safeRedirectPath(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (!code) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('error', 'auth');
    return NextResponse.redirect(url);
  }

  const redirectPath = safeRedirectPath(next);
  let response = NextResponse.redirect(new URL(redirectPath, request.url));

  const { url, anonKey } = getSupabasePublicEnv();
  const supabase = createServerClient(url, anonKey, {
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
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('error', 'auth');
    return NextResponse.redirect(url);
  }

  return response;
}
