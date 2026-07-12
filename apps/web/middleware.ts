import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

function isPublic(pathname: string): boolean {
  if (pathname === '/sign-in' || pathname.startsWith('/sign-in/')) return true;
  if (pathname === '/auth/callback' || pathname.startsWith('/auth/callback/')) return true;
  if (pathname === '/api/health' || pathname.startsWith('/api/health/')) return true;
  if (pathname === '/api/inngest' || pathname.startsWith('/api/inngest/')) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname === '/favicon.ico') return true;
  return false;
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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
