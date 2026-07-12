import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { success: false, message: 'Use the sign-in page' },
    { status: 410 },
  );
}
