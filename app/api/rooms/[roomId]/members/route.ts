import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { loadRoomMembers } from '@/lib/db-helpers';
import { getMemberRole } from '@/lib/db-helpers';
import {
  canBan,
  canDemote,
  canKick,
  canPromote,
  canTransferOwnership,
} from '@/lib/permissions';
import { pushNotification } from '@/lib/notifications';
import type { Role } from '@/lib/types';

export const runtime = 'nodejs';

/** GET — list all members of a room. */
export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const role = await getMemberRole(params.roomId, user.id);
  if (!role) return fail(403, 'You are not a member of this room.');

  const members = await loadRoomMembers(params.roomId);
  return ok({ members, my_role: role });
}

/** PATCH — manage a member: kick, ban, promote, demote, or transfer ownership. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const methodError = requireMethod(req, 'PATCH');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  let body: {
    action: 'kick' | 'ban' | 'promote' | 'demote' | 'transfer';
    user_id: string;
    role?: Role;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }

  const supabase = supabaseServer();
  const actorRole = await getMemberRole(params.roomId, user.id);
  if (!actorRole) return fail(403, 'You are not a member of this room.');

  const { data: target } = await supabase
    .from('room_members')
    .select('role')
    .eq('room_id', params.roomId)
    .eq('user_id', body.user_id)
    .maybeSingle();
  if (!target) return fail(404, 'Target user is not a member.');

  const actor = actorRole as Role;
  const targetRole = target.role as Role;
  const roomId = params.roomId;

  switch (body.action) {
    case 'kick': {
      if (!canKick(actor, targetRole)) return fail(403, 'You cannot kick this user.');
      await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', body.user_id);
      await pushNotification({
        userId: body.user_id,
        type: 'kick',
        title: `You were removed from a room`,
        body: body.reason ?? `Removed by @${user.username}.`,
      });
      return ok({ success: true });
    }
    case 'ban': {
      if (!canBan(actor, targetRole)) return fail(403, 'Only the owner can ban members.');
      await supabase.from('room_bans').insert({
        room_id: roomId,
        user_id: body.user_id,
        banned_by: user.id,
        reason: body.reason ?? null,
      });
      await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', body.user_id);
      await pushNotification({
        userId: body.user_id,
        type: 'ban',
        title: 'You were banned from a room',
        body: body.reason ?? `Banned by @${user.username}.`,
      });
      return ok({ success: true });
    }
    case 'promote': {
      const newRole = body.role ?? 'moderator';
      if (!canPromote(actor, targetRole, newRole)) return fail(403, 'You cannot promote this user.');
      await supabase
        .from('room_members')
        .update({ role: newRole })
        .eq('room_id', roomId)
        .eq('user_id', body.user_id);
      await pushNotification({
        userId: body.user_id,
        type: 'role',
        title: `Your role was changed to ${newRole}`,
      });
      return ok({ success: true });
    }
    case 'demote': {
      const newRole = body.role ?? 'member';
      if (!canDemote(actor, targetRole, newRole)) return fail(403, 'You cannot demote this user.');
      await supabase
        .from('room_members')
        .update({ role: newRole })
        .eq('room_id', roomId)
        .eq('user_id', body.user_id);
      await pushNotification({
        userId: body.user_id,
        type: 'role',
        title: `Your role was changed to ${newRole}`,
      });
      return ok({ success: true });
    }
    case 'transfer': {
      if (!canTransferOwnership(actor)) return fail(403, 'Only the owner can transfer ownership.');
      if (body.user_id === user.id) return fail(400, 'Cannot transfer to yourself.');
      await supabase
        .from('room_members')
        .update({ role: 'member' })
        .eq('room_id', roomId)
        .eq('user_id', user.id);
      await supabase
        .from('room_members')
        .update({ role: 'owner' })
        .eq('room_id', roomId)
        .eq('user_id', body.user_id);
      await supabase
        .from('rooms')
        .update({ owner_id: body.user_id })
        .eq('id', roomId);
      await pushNotification({
        userId: body.user_id,
        type: 'role',
        title: 'Ownership transferred to you',
        body: `@${user.username} transferred room ownership to you.`,
        link: `/rooms/${roomId}`,
      });
      return ok({ success: true });
    }
    default:
      return fail(400, 'Unknown action.');
  }
}
