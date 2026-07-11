import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { loadRoomMembers } from '@/lib/db-helpers';
import { pushNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

/** POST — leave a room. Owners must transfer ownership first. */
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const supabase = supabaseServer();
  const { data: membership } = await supabase
    .from('room_members')
    .select('role')
    .eq('room_id', params.roomId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return fail(404, 'You are not a member of this room.');

  if (membership.role === 'owner') {
    const { data: others } = await supabase
      .from('room_members')
      .select('user_id, role')
      .eq('room_id', params.roomId)
      .neq('user_id', user.id)
      .order('role', { ascending: false });
    if (!others || others.length === 0) {
      return fail(400, 'Transfer ownership or delete the room before leaving.');
    }
    const newOwner = others[0];
    await supabase
      .from('room_members')
      .update({ role: 'owner' })
      .eq('room_id', params.roomId)
      .eq('user_id', newOwner.user_id);
    await supabase
      .from('rooms')
      .update({ owner_id: newOwner.user_id })
      .eq('id', params.roomId);
    await pushNotification({
      userId: newOwner.user_id,
      type: 'role',
      title: 'You are now the owner of a room',
      body: 'The previous owner left and transferred ownership to you.',
      link: `/rooms/${params.roomId}`,
    });
  }

  const { error } = await supabase
    .from('room_members')
    .delete()
    .eq('room_id', params.roomId)
    .eq('user_id', user.id);
  if (error) return fail(500, 'Failed to leave room.');

  const members = await loadRoomMembers(params.roomId);
  for (const m of members) {
    await pushNotification({
      userId: m.user_id,
      type: 'user_left',
      title: `${user.display_name} left the room`,
      link: `/rooms/${params.roomId}`,
    });
  }

  return ok({ success: true });
}
