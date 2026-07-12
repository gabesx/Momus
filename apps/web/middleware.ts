import { NextResponse, type NextRequest } from 'next/server';
import { SIGNED_OUT_COOKIE } from '@/lib/auth-constants';

export function middleware(request: NextRequest) {
  const signedOut = request.cookies.get(SIGNED_OUT_COOKIE)?.value === '1';
  if (!signedOut) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (
    pathname === '/signed-out' ||
    pathname.startsWith('/api/auth/sign-in') ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/health/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, message: 'Authentication required' },
      { status: 401 },
    );
  }

  return NextResponse.redirect(new URL('/signed-out', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
