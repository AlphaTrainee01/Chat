import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { getMemberRole, hydrateReplies } from '@/lib/db-helpers';
import { notifyMentions } from '@/lib/notifications';
import { validateMessage } from '@/lib/validation';
import { fetchUserByIds } from '@/lib/db-helpers';
import type { Message } from '@/lib/types';

export const runtime = 'nodejs';

const PAGE_SIZE = 50;

/** GET — paginated message history for a room (newest first). */
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

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const supabase = supabaseServer();

  let query = supabase
    .from('messages')
    .select('id, room_id, sender_id, content, reply_to_id, attachment_url, attachment_type, attachment_name, edited_at, deleted_at, created_at')
    .eq('room_id', params.roomId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error || !data) return fail(500, 'Failed to load messages.');
  if (data.length === 0) return ok({ messages: [], next_cursor: null });

  const senderIds = data.map((m) => m.sender_id);
  const users = await fetchUserByIds(senderIds);

  const messages: Message[] = data.map((m) => ({
    ...m,
    sender: users[m.sender_id] ?? {
      id: m.sender_id,
      username: 'unknown',
      display_name: 'Unknown',
      avatar_url: null,
      bio: '',
      is_online: false,
      last_active_at: '',
      created_at: '',
      last_username_change: null,
    },
  }));

  const hydrated = await hydrateReplies(messages);
  const oldest = data[data.length - 1].created_at;
  return ok({ messages: hydrated, next_cursor: data.length < PAGE_SIZE ? null : oldest });
}

/** POST — send a message (text, attachment, and/or reply). */
export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const role = await getMemberRole(params.roomId, user.id);
  if (!role) return fail(403, 'You are not a member of this room.');

  let body: {
    content?: string;
    reply_to_id?: string;
    attachment_url?: string;
    attachment_type?: 'image' | 'file';
    attachment_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }

  const content = (body.content ?? '').trim();
  if (content) {
    const err = validateMessage(content);
    if (err) return fail(400, err);
  }
  if (!content && !body.attachment_url) return fail(400, 'Message is empty.');

  if (body.reply_to_id) {
    const { data: reply } = await supabaseServer()
      .from('messages')
      .select('id')
      .eq('id', body.reply_to_id)
      .eq('room_id', params.roomId)
      .maybeSingle();
    if (!reply) return fail(400, 'Reply target not found.');
  }

  const supabase = supabaseServer();
  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      room_id: params.roomId,
      sender_id: user.id,
      content: content || null,
      reply_to_id: body.reply_to_id ?? null,
      attachment_url: body.attachment_url ?? null,
      attachment_type: body.attachment_type ?? null,
      attachment_name: body.attachment_name ?? null,
    })
    .select('id, room_id, sender_id, content, reply_to_id, attachment_url, attachment_type, attachment_name, edited_at, deleted_at, created_at')
    .single();
  if (error || !msg) return fail(500, 'Failed to send message.');

  const { data: room } = await supabase
    .from('rooms')
    .select('name')
    .eq('id', params.roomId)
    .maybeSingle();

  if (content) {
    await notifyMentions(content, user, params.roomId, room?.name ?? 'a room');
  }

  const message: Message = {
    ...msg,
    sender: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio: '',
      is_online: true,
      last_active_at: new Date().toISOString(),
      created_at: '',
      last_username_change: null,
    },
    reply_to: null,
  };

  const hydrated = await hydrateReplies([message]);
  return ok({ message: hydrated[0] });
}
