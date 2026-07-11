import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { loadRoomMembers } from '@/lib/db-helpers';
import { pushNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

/** POST — join a room by its code. */
export async function POST(req: NextRequest) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }
  const code = (body.code ?? '').trim().toUpperCase();
  if (!code) return fail(400, 'Room code is required.');

  const supabase = supabaseServer();
  const { data: room, error } = await supabase
    .from('rooms')
    .select('id, name, description, icon, owner_id, code, created_at')
    .eq('code', code)
    .maybeSingle();
  if (error || !room) return fail(404, 'Room not found.');

  const { data: ban } = await supabase
    .from('room_bans')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (ban) return fail(403, 'You are banned from this room.');

  const { data: existing } = await supabase
    .from('room_members')
    .select('id, role')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return ok({ room: { ...room, my_role: existing.role }, already_member: true });
  }

  const { error: ie } = await supabase
    .from('room_members')
    .insert({ room_id: room.id, user_id: user.id, role: 'member' });
  if (ie) return fail(500, 'Failed to join room.');

  const members = await loadRoomMembers(room.id);
  for (const m of members) {
    if (m.user_id === user.id) continue;
    await pushNotification({
      userId: m.user_id,
      type: 'user_joined',
      title: `${user.display_name} joined ${room.name}`,
      body: `@${user.username} just joined the room.`,
      link: `/rooms/${room.id}`,
    });
  }

  return ok({ room: { ...room, my_role: 'member' }, already_member: false });
}
