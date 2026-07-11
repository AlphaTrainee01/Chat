import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import {
  createUserSession,
  hashPassword,
  setSessionCookie,
  toSessionUser,
} from '@/lib/session';
import { sanitize, validatePassword, validateUsername } from '@/lib/validation';
import { fail, getClientMeta, ok, requireMethod } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  let body: { username?: string; password?: string; display_name?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }

  const username = sanitize(body.username ?? '');
  const password = body.password ?? '';
  const display_name = sanitize(body.display_name ?? '') || username;

  const usernameErr = validateUsername(username);
  if (usernameErr) return fail(400, usernameErr);
  const passwordErr = validatePassword(password);
  if (passwordErr) return fail(400, passwordErr);

  const supabase = supabaseServer();
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existing) return fail(409, 'Username already taken.');

  const password_hash = await hashPassword(password);
  const { data: user, error } = await supabase
    .from('users')
    .insert({ username, password_hash, display_name })
    .select('id, username, display_name, avatar_url')
    .single();
  if (error || !user) return fail(500, 'Failed to create account.');

  await supabase.from('user_settings').insert({ user_id: user.id });

  const meta = getClientMeta(req);
  const { token } = await createUserSession(user.id, meta);
  const res = ok({ user: toSessionUser(user) });
  res.headers.set('Set-Cookie', setSessionCookie(token));
  return res;
}
