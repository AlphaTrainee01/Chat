import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { fetchUserByIds, hydratePrivateSenders } from '@/lib/db-helpers';
import type { PrivateChat } from '@/lib/types';

export const runtime = 'nodejs';

/** GET — list the user's private conversations with last-message preview. */
export async function GET(req: NextRequest) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const supabase = supabaseServer();
  const { data: chats, error } = await supabase
    .from('private_chats')
    .select('id, user_a_id, user_b_id, created_at')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error || !chats) return fail(500, 'Failed to load conversations.');
  if (chats.length === 0) return ok({ chats: [] });

  const otherIds = chats.map((c) => (c.user_a_id === user.id ? c.user_b_id : c.user_a_id));
  const users = await fetchUserByIds(otherIds);

  const result: PrivateChat[] = [];
  for (const c of chats) {
    const otherId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
    const { data: last } = await supabase
      .from('private_messages')
      .select('content, attachment_type, created_at, sender_id')
      .eq('chat_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    result.push({
      id: c.id,
      user_a_id: c.user_a_id,
      user_b_id: c.user_b_id,
      created_at: c.created_at,
      other_user: users[otherId] ?? ({
        id: otherId,
        username: 'unknown',
        display_name: 'Unknown',
        avatar_url: null,
        bio: '',
        is_online: false,
        last_active_at: '',
        created_at: '',
        last_username_change: null,
      }),
      last_message: last ?? null,
    });
  }

  result.sort((a, b) => {
    const at = a.last_message?.created_at ?? a.created_at;
    const bt = b.last_message?.created_at ?? b.created_at;
    return bt.localeCompare(at);
  });

  return ok({ chats: result });
}
