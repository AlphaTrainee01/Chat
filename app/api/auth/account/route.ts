import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import {
  clearSessionCookie,
  destroySession,
  getSessionUser,
  hashPassword,
  verifyPassword,
} from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { sanitize, validatePassword, validateUsername } from '@/lib/validation';

export const runtime = 'nodejs';

/** Change username and/or password. Requires the current password. */
export async function PATCH(req: NextRequest) {
  const methodError = requireMethod(req, 'PATCH');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  let body: { current_password?: string; new_username?: string; new_password?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }

  const supabase = supabaseServer();
  const { data: full } = await supabase
    .from('users')
    .select('password_hash, last_username_change')
    .eq('id', user.id)
    .maybeSingle();
  if (!full) return fail(404, 'User not found.');

  const valid = await verifyPassword(body.current_password ?? '', full.password_hash);
  if (!valid) return fail(403, 'Current password is incorrect.');

  if (body.new_username && body.new_username !== user.username) {
    const newUsername = sanitize(body.new_username);
    const err = validateUsername(newUsername);
    if (err) return fail(400, err);

    const last = full.last_username_change ? new Date(full.last_username_change).getTime() : 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) {
      return fail(429, 'You can only change your username once per day.');
    }

    const { data: taken } = await supabase
      .from('users')
      .select('id')
      .eq('username', newUsername)
      .neq('id', user.id)
      .maybeSingle();
    if (taken) return fail(409, 'Username already taken.');

    const { error: ue } = await supabase
      .from('users')
      .update({ username: newUsername, last_username_change: new Date().toISOString() })
      .eq('id', user.id);
    if (ue) return fail(500, 'Failed to update username.');
  }

  if (body.new_password) {
    const err = validatePassword(body.new_password);
    if (err) return fail(400, err);
    const newHash = await hashPassword(body.new_password);
    const { error: pe } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', user.id);
    if (pe) return fail(500, 'Failed to update password.');
  }

  const { data: updated } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, bio')
    .eq('id', user.id)
    .maybeSingle();
  return ok({ user: updated });
}

/** Permanently delete the account. Requires the current password. */
export async function DELETE(req: NextRequest) {
  const methodError = requireMethod(req, 'DELETE');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }
  if (!body.password) return fail(400, 'Password is required to delete your account.');

  const supabase = supabaseServer();
  const { data: full } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', user.id)
    .maybeSingle();
  if (!full) return fail(404, 'User not found.');

  const valid = await verifyPassword(body.password, full.password_hash);
  if (!valid) return fail(403, 'Password is incorrect.');

  await supabase.from('users').delete().eq('id', user.id);
  await destroySession();

  const res = ok({ success: true });
  res.headers.set('Set-Cookie', clearSessionCookie());
  return res;
}
