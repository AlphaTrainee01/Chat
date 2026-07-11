import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';

export const runtime = 'nodejs';

/** GET ?q=...&type=rooms|users|messages — search across rooms, users, messages. */
export async function GET(req: NextRequest) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const type = searchParams.get('type') ?? 'all';
  if (q.length < 1) return ok({ rooms: [], users: [], messages: [] });

  const supabase = supabaseServer();
  const pattern = `%${q}%`;
  const [rooms, users, messages] = await Promise.all([
    type === 'all' || type === 'rooms'
      ? supabase
          .from('rooms')
          .select('id, name, description, icon, code')
          .or(`name.ilike.${pattern},description.ilike.${pattern}`)
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    type === 'all' || type === 'users'
      ? supabase
          .from('users')
          .select('id, username, display_name, avatar_url')
          .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    type === 'all' || type === 'messages'
      ? (async () => {
          const { data: memberships } = await supabase
            .from('room_members')
            .select('room_id')
            .eq('user_id', user.id);
          const roomIds = (memberships ?? []).map((m) => m.room_id);
          if (roomIds.length === 0) return { data: [], error: null };
          return supabase
            .from('messages')
            .select('id, room_id, content, created_at, sender_id')
            .in('room_id', roomIds)
            .ilike('content', pattern)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(20);
        })()
      : Promise.resolve({ data: [], error: null }),
  ]);

  return ok({
    rooms: rooms.data ?? [],
    users: users.data ?? [],
    messages: messages.data ?? [],
  });
}
