import { supabaseServer } from './supabase';
import type { Message, PrivateMessage, RoomMember, User } from './types';

export async function fetchUserByIds(ids: string[]): Promise<Record<string, User>> {
  if (ids.length === 0) return {};
  const unique = [...new Set(ids)];
  const { data, error } = await supabaseServer()
    .from('users')
    .select('*')
    .in('id', unique);
  if (error) return {};
  return Object.fromEntries((data as User[]).map((u) => [u.id, u]));
}

export async function fetchUsersByIds(ids: string[]): Promise<Map<string, User>> {
  const map = await fetchUserByIds(ids);
  return new Map(Object.entries(map));
}

export async function loadRoomMembers(roomId: string): Promise<RoomMember[]> {
  const supabase = supabaseServer();
  const { data: members, error } = await supabase
    .from('room_members')
    .select('id, room_id, user_id, role, joined_at')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (error || !members) return [];

  const userIds = members.map((m) => m.user_id);
  const users = await fetchUserByIds(userIds);
  return members.map((m) => ({
    id: m.id,
    room_id: m.room_id,
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    user: users[m.user_id] ?? ({ id: m.user_id, username: 'unknown', display_name: 'Unknown', avatar_url: null, bio: '', is_online: false, last_active_at: '', created_at: '', last_username_change: null } as User),
  }));
}

export async function getMemberRole(roomId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabaseServer()
    .from('room_members')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.role;
}

export async function getUserRole(roomId: string, userId: string): Promise<string | null> {
  return getMemberRole(roomId, userId);
}

/** Resolve reply-to preview for a batch of messages. */
export async function hydrateReplies(messages: Message[]): Promise<Message[]> {
  const replyIds = messages.map((m) => m.reply_to_id).filter((id): id is string => !!id);
  if (replyIds.length === 0) return messages;

  const supabase = supabaseServer();
  const { data: replied, error } = await supabase
    .from('messages')
    .select('id, content, sender_id')
    .in('id', [...new Set(replyIds)]);
  if (error || !replied) return messages;

  const senderIds = replied.map((r) => r.sender_id);
  const users = await fetchUserByIds(senderIds);
  const replyMap = new Map(replied.map((r) => [r.id as string, r]));

  return messages.map((m) => {
    if (!m.reply_to_id) return m;
    const r = replyMap.get(m.reply_to_id);
    if (!r) return { ...m, reply_to: null };
    const u = users[r.sender_id as string];
    return {
      ...m,
      reply_to: {
        id: r.id as string,
        content: r.content as string | null,
        sender: {
          username: u?.username ?? 'unknown',
          display_name: u?.display_name ?? 'Unknown',
        },
      },
    };
  });
}

/** Enrich raw private message rows with sender user objects. */
export async function hydratePrivateSenders(messages: PrivateMessage[]): Promise<PrivateMessage[]> {
  const senderIds = messages.map((m) => m.sender_id);
  const users = await fetchUserByIds(senderIds);
  return messages.map((m) => ({
    ...m,
    sender: users[m.sender_id] ?? ({ id: m.sender_id, username: 'unknown', display_name: 'Unknown', avatar_url: null, bio: '', is_online: false, last_active_at: '', created_at: '', last_username_change: null } as User),
  }));
}
