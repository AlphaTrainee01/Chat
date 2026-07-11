import { NextRequest } from 'next/server';
import { clearSessionCookie, destroySession } from '@/lib/session';
import { ok, requireMethod } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  await destroySession();
  const res = ok({ success: true });
  res.headers.set('Set-Cookie', clearSessionCookie());
  return res;
}
