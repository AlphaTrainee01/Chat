import { supabaseServer } from './supabase';
import type { NotificationType } from './types';

export async function pushNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  const { userId, type, title, body, link } = params;
  const { error } = await supabaseServer().from('notifications').insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
  });
  if (error) {
    console.error('pushNotification failed:', error.message);
  }
}

export async function notifyMentions(
  content: string,
  sender: { id: string; username: string; display_name: string },
  roomId: string,
  roomName: string
): Promise<void> {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = [...content.matchAll(mentionRegex)];
  const names = [...new Set(matches.map((m) => m[1]))];
  if (names.length === 0) return;

  const supabase = supabaseServer();
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .in('username', names);

  if (!users) return;
  for (const u of users) {
    if (u.id === sender.id) continue;
    await pushNotification({
      userId: u.id,
      type: 'mention',
      title: `${sender.display_name} mentioned you in ${roomName}`,
      body: content.length > 100 ? content.slice(0, 100) + '…' : content,
      link: `/rooms/${roomId}`,
    });
  }
}
