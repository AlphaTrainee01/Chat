import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import type { UserSettings } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const { data, error } = await supabaseServer()
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !data) return fail(404, 'Settings not found.');
  return ok({ settings: data as UserSettings });
}

export async function PATCH(req: NextRequest) {
  const methodError = requireMethod(req, 'PATCH');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  let body: Partial<Pick<UserSettings, 'dark_mode' | 'desktop_notifications' | 'mention_notifications' | 'sound_enabled'>>;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }

  const updates: Record<string, boolean> = {};
  for (const key of ['dark_mode', 'desktop_notifications', 'mention_notifications', 'sound_enabled'] as const) {
    if (typeof body[key] === 'boolean') updates[key] = body[key]!;
  }
  if (Object.keys(updates).length === 0) return fail(400, 'No settings to update.');

  const { data, error } = await supabaseServer()
    .from('user_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle();
  if (error || !data) return fail(500, 'Failed to update settings.');
  return ok({ settings: data as UserSettings });
}
