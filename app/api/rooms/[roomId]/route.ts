import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { getMemberRole } from '@/lib/db-helpers';
import type { Room } from '@/lib/types';

export const runtime = 'nodejs';

/** GET — fetch a single room with the caller's role + member count. */
export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const supabase = supabaseServer();
  const { data: room, error } = await supabase
    .from('rooms')
    .select('id, name, description, icon, owner_id, code, created_at')
    .eq('id', params.roomId)
    .maybeSingle();
  if (error || !room) return fail(404, 'Room not found.');

  const role = await getMemberRole(room.id, user.id);
  if (!role) return fail(403, 'You are not a member of this room.');

  const { data: owner } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .eq('id', room.owner_id)
    .maybeSingle();

  const { count } = await supabase
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id);

  return ok({
    room: {
      ...room,
      member_count: count ?? 0,
      owner: owner ?? null,
      my_role: role,
    } as Room,
  });
}
