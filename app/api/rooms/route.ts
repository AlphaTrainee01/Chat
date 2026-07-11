import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, generateRoomCode, ok, requireMethod } from '@/lib/api';
import { sanitize, validateRoomDescription, validateRoomName } from '@/lib/validation';
import { loadRoomMembers } from '@/lib/db-helpers';
import { pushNotification } from '@/lib/notifications';
import type { Room } from '@/lib/types';

export const runtime = 'nodejs';

/** GET — list the current user's rooms (membership-based). */
export async function GET(req: NextRequest) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const supabase = supabaseServer();
  const { data: memberships, error } = await supabase
    .from('room_members')
    .select('room_id, role, joined_at')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  if (error || !memberships) return fail(500, 'Failed to load rooms.');
  if (memberships.length === 0) return ok({ rooms: [] });

  const roomIds = memberships.map((m) => m.room_id);
  const roleByRoom = new Map(memberships.map((m) => [m.room_id as string, m.role as string]));

  const { data: rooms, error: re } = await supabase
    .from('rooms')
    .select('id, name, description, icon, owner_id, code, created_at')
    .in('id', roomIds)
    .order('created_at', { ascending: false });
  if (re || !rooms) return fail(500, 'Failed to load rooms.');

  const ownerIds = [...new Set(rooms.map((r) => r.owner_id))];
  const { data: owners } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .in('id', ownerIds);
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o]));

  const result = await Promise.all(
    rooms.map(async (r) => {
      const { count } = await supabase
        .from('room_members')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', r.id);
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        icon: r.icon,
        owner_id: r.owner_id,
        code: r.code,
        created_at: r.created_at,
        member_count: count ?? 0,
        owner: ownerMap.get(r.owner_id) ?? null,
        my_role: roleByRoom.get(r.id) ?? 'member',
      } as Room;
    })
  );

  return ok({ rooms: result });
}

/** POST — create a new room; creator becomes owner. */
export async function POST(req: NextRequest) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  let body: { name?: string; description?: string; icon?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }

  const name = sanitize(body.name ?? '');
  const description = body.description ? sanitize(body.description) : '';
  const icon = body.icon ? body.icon.trim().slice(0, 10) : '💬';

  const nameErr = validateRoomName(name);
  if (nameErr) return fail(400, nameErr);
  const descErr = validateRoomDescription(description);
  if (descErr) return fail(400, descErr);

  const supabase = supabaseServer();
  let code = generateRoomCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: exists } = await supabase.from('rooms').select('id').eq('code', code).maybeSingle();
    if (!exists) break;
    code = generateRoomCode();
    attempts++;
  }

  const { data: room, error } = await supabase
    .from('rooms')
    .insert({ name, description, icon, owner_id: user.id, code })
    .select('id, name, description, icon, owner_id, code, created_at')
    .single();
  if (error || !room) return fail(500, 'Failed to create room.');

  const { error: me } = await supabase
    .from('room_members')
    .insert({ room_id: room.id, user_id: user.id, role: 'owner' });
  if (me) return fail(500, 'Failed to join room as owner.');

  return ok({
    room: {
      ...room,
      member_count: 1,
      owner: { id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url },
      my_role: 'owner',
    } as Room,
  });
}
