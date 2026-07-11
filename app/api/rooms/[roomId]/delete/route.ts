import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { canDeleteRoom } from '@/lib/permissions';
import type { Role } from '@/lib/types';

export const runtime = 'nodejs';

/** DELETE — delete a room (owner only). Cascades to members, messages, bans. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const methodError = requireMethod(req, 'DELETE');
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
  if (!membership) return fail(404, 'Room not found or you are not a member.');

  if (!canDeleteRoom(membership.role as Role)) {
    return fail(403, 'Only the owner can delete a room.');
  }

  const { error } = await supabase.from('rooms').delete().eq('id', params.roomId);
  if (error) return fail(500, 'Failed to delete room.');

  return ok({ success: true });
}
