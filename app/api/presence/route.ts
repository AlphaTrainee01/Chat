import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';

export const runtime = 'nodejs';

/** POST — heartbeat to mark the user online and update last_active_at. */
export async function POST(req: NextRequest) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const now = new Date().toISOString();
  await supabaseServer()
    .from('users')
    .update({ is_online: true, last_active_at: now })
    .eq('id', user.id);

  return ok({ online: true, at: now });
}

/** DELETE — mark the user offline on logout/unload. */
export async function DELETE(req: NextRequest) {
  const methodError = requireMethod(req, 'DELETE');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  await supabaseServer()
    .from('users')
    .update({ is_online: false, last_active_at: new Date().toISOString() })
    .eq('id', user.id);

  return ok({ online: false });
}
