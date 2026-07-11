import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';

export const runtime = 'nodejs';

/** POST — open (or create) a private chat with a given user id. */
export async function POST(req: NextRequest) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }
  const otherId = body.user_id?.trim();
  if (!otherId) return fail(400, 'user_id is required.');
  if (otherId === user.id) return fail(400, 'Cannot start a chat with yourself.');

  const supabase = supabaseServer();
  const { data: other } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, bio, is_online, last_active_at, created_at, last_username_change')
    .eq('id', otherId)
    .maybeSingle();
  if (!other) return fail(404, 'User not found.');

  const { data: existing } = await supabase
    .from('private_chats')
    .select('id, user_a_id, user_b_id, created_at')
    .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${otherId}),and(user_a_id.eq.${otherId},user_b_id.eq.${user.id})`)
    .maybeSingle();

  if (existing) {
    return ok({
      chat: {
        id: existing.id,
        user_a_id: existing.user_a_id,
        user_b_id: existing.user_b_id,
        created_at: existing.created_at,
        other_user: other,
      },
    });
  }

  const { data: chat, error } = await supabase
    .from('private_chats')
    .insert({ user_a_id: user.id, user_b_id: otherId })
    .select('id, user_a_id, user_b_id, created_at')
    .single();
  if (error || !chat) return fail(500, 'Failed to create chat.');

  return ok({
    chat: {
      id: chat.id,
      user_a_id: chat.user_a_id,
      user_b_id: chat.user_b_id,
      created_at: chat.created_at,
      other_user: other,
    },
  });
}
