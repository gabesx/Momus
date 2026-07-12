import { NextResponse, type NextRequest } from 'next/server';
import { canAccessApp, type ApprovalStatus } from '@momus/domain';
import { createServerClient } from '@momus/infra/supabase';
import { updateSession } from '@/lib/supabase/middleware';

type AppAccess = 'ok' | 'pending' | 'denied' | 'missing';

const AUTH_FLOW_PREFIXES = [
  '/sign-in',
  '/auth/callback',
  '/api/auth/sign-out',
  '/api/auth/ensure-user',
] as const;

const PENDING_ALLOWED_PREFIXES = ['/pending-approval', ...AUTH_FLOW_PREFIXES] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublic(pathname: string): boolean {
  if (matchesPrefix(pathname, AUTH_FLOW_PREFIXES)) return true;
  if (pathname === '/api/health' || pathname.startsWith('/api/health/')) return true;
  if (pathname === '/api/inngest' || pathname.startsWith('/api/inngest/')) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname === '/favicon.ico') return true;
  return false;
}

async function resolveAccessForAuthId(authUserId: string): Promise<AppAccess> {
  const db = createServerClient();
  const { data: row, error } = await db
    .from('users')
    .select('approval_status, is_candidate')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error || !row) return 'missing';

  return canAccessApp({
    approvalStatus: row.approval_status as ApprovalStatus,
    isCandidate: row.is_candidate,
  });
}

function redirectToSignIn(request: NextRequest, error?: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/sign-in';
  if (error) url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}

function gatePendingOrMissing(
  request: NextRequest,
  response: NextResponse,
  access: 'pending' | 'missing',
): NextResponse {
  const { pathname } = request.nextUrl;

  if (matchesPrefix(pathname, PENDING_ALLOWED_PREFIXES)) {
    return response;
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, message: access === 'missing' ? 'User setup required' : 'Pending approval' },
      { status: 403 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = '/pending-approval';
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { user, response } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return response;

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const access = await resolveAccessForAuthId(user.id);

  if (access === 'denied') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: 'Account access denied' },
        { status: 403 },
      );
    }
    return redirectToSignIn(request, 'denied');
  }

  if (access === 'pending' || access === 'missing') {
    return gatePendingOrMissing(request, response, access);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
