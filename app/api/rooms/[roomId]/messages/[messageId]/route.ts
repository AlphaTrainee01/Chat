import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { getMemberRole } from '@/lib/db-helpers';
import { canDeleteMessage } from '@/lib/permissions';
import { validateMessage } from '@/lib/validation';
import type { Role } from '@/lib/types';

export const runtime = 'nodejs';

/** PATCH — edit the content of your own message. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomId: string; messageId: string } }
) {
  const methodError = requireMethod(req, 'PATCH');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const actorRole = await getMemberRole(params.roomId, user.id);
  if (!actorRole) return fail(403, 'You are not a member of this room.');

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }
  const content = (body.content ?? '').trim();
  if (!content) return fail(400, 'Content cannot be empty.');
  const err = validateMessage(content);
  if (err) return fail(400, err);

  const supabase = supabaseServer();
  const { data: msg } = await supabase
    .from('messages')
    .select('sender_id, deleted_at')
    .eq('id', params.messageId)
    .eq('room_id', params.roomId)
    .maybeSingle();
  if (!msg) return fail(404, 'Message not found.');
  if (msg.deleted_at) return fail(400, 'Cannot edit a deleted message.');
  if (msg.sender_id !== user.id) return fail(403, 'You can only edit your own messages.');

  const { data: updated, error } = await supabase
    .from('messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', params.messageId)
    .select('id, content, edited_at')
    .maybeSingle();
  if (error || !updated) return fail(500, 'Failed to edit message.');

  return ok({ message: updated });
}

/** DELETE — soft-delete a message (own message, or admin+ for any). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomId: string; messageId: string } }
) {
  const methodError = requireMethod(req, 'DELETE');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const actorRole = await getMemberRole(params.roomId, user.id);
  if (!actorRole) return fail(403, 'You are not a member of this room.');

  const supabase = supabaseServer();
  const { data: msg } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('id', params.messageId)
    .eq('room_id', params.roomId)
    .maybeSingle();
  if (!msg) return fail(404, 'Message not found.');

  if (!canDeleteMessage(actorRole as Role, msg.sender_id, user.id)) {
    return fail(403, 'You cannot delete this message.');
  }

  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString(), content: null, attachment_url: null })
    .eq('id', params.messageId);
  if (error) return fail(500, 'Failed to delete message.');

  return ok({ success: true });
}
