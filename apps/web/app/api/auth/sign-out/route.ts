import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/auth';
import { SIGNED_OUT_COOKIE } from '@/lib/auth-constants';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  const res = NextResponse.json({ success: true });
  res.cookies.set(SIGNED_OUT_COOKIE, '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
