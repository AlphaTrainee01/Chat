import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { ok, requireMethod } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;

  const user = await getSessionUser();
  return ok({ user });
}
