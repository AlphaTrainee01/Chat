import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';

export const runtime = 'nodejs';

/** GET — list notifications (newest first, paginated). */
export async function GET(req: NextRequest) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get('unread') === 'true';

  let query = supabaseServer()
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) return fail(500, 'Failed to load notifications.');
  return ok({ notifications: data ?? [] });
}

/** PATCH — mark notifications as read (all, or a single id via ?id=). */
export async function PATCH(req: NextRequest) {
  const methodError = requireMethod(req, 'PATCH');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const supabase = supabaseServer();

  if (id) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return fail(500, 'Failed to mark notification as read.');
  } else {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (error) return fail(500, 'Failed to mark notifications as read.');
  }

  return ok({ success: true });
}
