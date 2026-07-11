import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { sanitize, validateBio } from '@/lib/validation';
import { BIO_MAX } from '@/lib/constants';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  const methodError = requireMethod(req, 'PATCH');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  let body: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }

  const updates: Record<string, string | null> = {};
  if (typeof body.display_name === 'string') {
    const name = sanitize(body.display_name);
    if (name.length === 0 || name.length > 30) return fail(400, 'Display name must be 1-30 characters.');
    updates.display_name = name;
  }
  if (typeof body.bio === 'string') {
    const bioErr = validateBio(body.bio);
    if (bioErr) return fail(400, bioErr);
    updates.bio = body.bio.slice(0, BIO_MAX);
  }
  if (typeof body.avatar_url === 'string') {
    updates.avatar_url = body.avatar_url || null;
  }

  if (Object.keys(updates).length === 0) return fail(400, 'No fields to update.');

  const { data, error } = await supabaseServer()
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select('id, username, display_name, avatar_url, bio')
    .maybeSingle();
  if (error || !data) return fail(500, 'Failed to update profile.');

  return ok({ user: data });
}
