import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import {
  createUserSession,
  setSessionCookie,
  toSessionUser,
  verifyPassword,
} from '@/lib/session';
import { sanitize } from '@/lib/validation';
import { fail, getClientMeta, ok, requireMethod } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }

  const username = sanitize(body.username ?? '');
  const password = body.password ?? '';
  if (!username || !password) return fail(400, 'Username and password are required.');

  const supabase = supabaseServer();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, password_hash')
    .eq('username', username)
    .maybeSingle();
  if (error || !user) return fail(401, 'Invalid username or password.');

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return fail(401, 'Invalid username or password.');

  await supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', user.id);

  const meta = getClientMeta(req);
  const { token } = await createUserSession(user.id, meta);
  const res = ok({ user: toSessionUser(user) });
  res.headers.set('Set-Cookie', setSessionCookie(token));
  return res;
}
