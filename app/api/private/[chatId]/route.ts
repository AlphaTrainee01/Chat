import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { fetchUserByIds, hydratePrivateSenders } from '@/lib/db-helpers';
import { validateMessage } from '@/lib/validation';
import type { PrivateMessage } from '@/lib/types';

const PAGE_SIZE = 50;

export const runtime = 'nodejs';

/** GET — message history for a private chat (only if caller is a participant). */
export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const methodError = requireMethod(req, 'GET');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const supabase = supabaseServer();
  const { data: chat, error } = await supabase
    .from('private_chats')
    .select('id, user_a_id, user_b_id')
    .eq('id', params.chatId)
    .maybeSingle();
  if (error || !chat) return fail(404, 'Chat not found.');
  if (chat.user_a_id !== user.id && chat.user_b_id !== user.id) {
    return fail(403, 'You do not have access to this chat.');
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');

  let query = supabase
    .from('private_messages')
    .select('id, chat_id, sender_id, content, attachment_url, attachment_type, attachment_name, read_at, created_at')
    .eq('chat_id', params.chatId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error: me } = await query;
  if (me || !data) return fail(500, 'Failed to load messages.');
  if (data.length === 0) return ok({ messages: [], next_cursor: null });

  const senderIds = data.map((m) => m.sender_id);
  const users = await fetchUserByIds(senderIds);
  const messages: PrivateMessage[] = data.map((m) => ({
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
  const hydrated = await hydratePrivateSenders(messages);
  const oldest = data[data.length - 1].created_at;
  return ok({ messages: hydrated, next_cursor: data.length < PAGE_SIZE ? null : oldest });
}

/** POST — send a private message. */
export async function POST(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const supabase = supabaseServer();
  const { data: chat, error } = await supabase
    .from('private_chats')
    .select('id, user_a_id, user_b_id')
    .eq('id', params.chatId)
    .maybeSingle();
  if (error || !chat) return fail(404, 'Chat not found.');
  if (chat.user_a_id !== user.id && chat.user_b_id !== user.id) {
    return fail(403, 'You do not have access to this chat.');
  }

  let body: {
    content?: string;
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

  const { data: msg, error: ie } = await supabase
    .from('private_messages')
    .insert({
      chat_id: params.chatId,
      sender_id: user.id,
      content: content || null,
      attachment_url: body.attachment_url ?? null,
      attachment_type: body.attachment_type ?? null,
      attachment_name: body.attachment_name ?? null,
    })
    .select('id, chat_id, sender_id, content, attachment_url, attachment_type, attachment_name, read_at, created_at')
    .single();
  if (ie || !msg) return fail(500, 'Failed to send message.');

  const message: PrivateMessage = {
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
  };

  const recipientId = chat.user_a_id === user.id ? chat.user_b_id : chat.user_a_id;
  await supabaseServer().from('notifications').insert({
    user_id: recipientId,
    type: 'message',
    title: `${user.display_name} sent you a message`,
    body: content ? (content.length > 100 ? content.slice(0, 100) + '…' : content) : 'Sent an attachment',
    link: `/messages/${params.chatId}`,
  });

  return ok({ message });
}

/** PATCH — mark unread messages from the other user as read (seen status). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const methodError = requireMethod(req, 'PATCH');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  const supabase = supabaseServer();
  const { data: chat } = await supabase
    .from('private_chats')
    .select('user_a_id, user_b_id')
    .eq('id', params.chatId)
    .maybeSingle();
  if (!chat) return fail(404, 'Chat not found.');
  if (chat.user_a_id !== user.id && chat.user_b_id !== user.id) {
    return fail(403, 'You do not have access to this chat.');
  }

  const { error } = await supabase
    .from('private_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('chat_id', params.chatId)
    .neq('sender_id', user.id)
    .is('read_at', null);
  if (error) return fail(500, 'Failed to mark messages as read.');

  return ok({ success: true });
}
