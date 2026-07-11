import type {
  Message,
  Notification,
  PrivateChat,
  PrivateMessage,
  Room,
  RoomMember,
  SessionUser,
  UserSettings,
  Role,
} from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  auth: {
    register: (body: { username: string; password: string; display_name?: string }) =>
      request<{ user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { username: string; password: string }) =>
      request<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
    me: () => request<{ user: SessionUser | null }>('/api/auth/me'),
    updateProfile: (body: { display_name?: string; bio?: string; avatar_url?: string }) =>
      request<{ user: SessionUser & { bio: string } }>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),
    updateAccount: (body: { current_password?: string; new_username?: string; new_password?: string }) =>
      request<{ user: SessionUser & { bio: string } }>('/api/auth/account', { method: 'PATCH', body: JSON.stringify(body) }),
    deleteAccount: (body: { password: string }) =>
      request<{ success: boolean }>('/api/auth/account', { method: 'DELETE', body: JSON.stringify(body) }),
  },
  rooms: {
    list: () => request<{ rooms: Room[] }>('/api/rooms'),
    create: (body: { name: string; description?: string; icon?: string }) =>
      request<{ room: Room }>('/api/rooms', { method: 'POST', body: JSON.stringify(body) }),
    get: (roomId: string) => request<{ room: Room }>(`/api/rooms/${roomId}`),
    join: (code: string) =>
      request<{ room: Room; already_member: boolean }>('/api/rooms/join', { method: 'POST', body: JSON.stringify({ code }) }),
    leave: (roomId: string) => request<{ success: boolean }>(`/api/rooms/${roomId}/leave`, { method: 'POST' }),
    delete: (roomId: string) => request<{ success: boolean }>(`/api/rooms/${roomId}/delete`, { method: 'DELETE' }),
    members: (roomId: string) => request<{ members: RoomMember[]; my_role: Role }>(`/api/rooms/${roomId}/members`),
    manageMember: (roomId: string, body: { action: 'kick' | 'ban' | 'promote' | 'demote' | 'transfer'; user_id: string; role?: Role; reason?: string }) =>
      request<{ success: boolean }>(`/api/rooms/${roomId}/members`, { method: 'PATCH', body: JSON.stringify(body) }),
    messages: (roomId: string, cursor?: string) =>
      request<{ messages: Message[]; next_cursor: string | null }>(
        `/api/rooms/${roomId}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
      ),
    sendMessage: (roomId: string, body: { content?: string; reply_to_id?: string; attachment_url?: string; attachment_type?: 'image' | 'file'; attachment_name?: string }) =>
      request<{ message: Message }>(`/api/rooms/${roomId}/messages`, { method: 'POST', body: JSON.stringify(body) }),
    editMessage: (roomId: string, messageId: string, content: string) =>
      request<{ message: { id: string; content: string; edited_at: string } }>(
        `/api/rooms/${roomId}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ content }) }
      ),
    deleteMessage: (roomId: string, messageId: string) =>
      request<{ success: boolean }>(`/api/rooms/${roomId}/messages/${messageId}`, { method: 'DELETE' }),
  },
  private: {
    list: () => request<{ chats: PrivateChat[] }>('/api/private'),
    create: (userId: string) =>
      request<{ chat: PrivateChat }>('/api/private/create', { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
    messages: (chatId: string, cursor?: string) =>
      request<{ messages: PrivateMessage[]; next_cursor: string | null }>(
        `/api/private/${chatId}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
      ),
    send: (chatId: string, body: { content?: string; attachment_url?: string; attachment_type?: 'image' | 'file'; attachment_name?: string }) =>
      request<{ message: PrivateMessage }>(`/api/private/${chatId}`, { method: 'POST', body: JSON.stringify(body) }),
    markRead: (chatId: string) =>
      request<{ success: boolean }>(`/api/private/${chatId}`, { method: 'PATCH' }),
  },
  notifications: {
    list: (unread?: boolean) =>
      request<{ notifications: Notification[] }>(`/api/notifications${unread ? '?unread=true' : ''}`),
    markRead: (id?: string) =>
      request<{ success: boolean }>(`/api/notifications${id ? `?id=${id}` : ''}`, { method: 'PATCH' }),
  },
  settings: {
    get: () => request<{ settings: UserSettings }>('/api/settings'),
    update: (body: Partial<Pick<UserSettings, 'dark_mode' | 'desktop_notifications' | 'mention_notifications' | 'sound_enabled'>>) =>
      request<{ settings: UserSettings }>('/api/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  },
  search: (q: string, type?: 'rooms' | 'users' | 'messages' | 'all') =>
    request<{ rooms: Room[]; users: SessionUser[]; messages: Message[] }>(
      `/api/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`
    ),
  presence: {
    heartbeat: () => request<{ online: boolean; at: string }>('/api/presence', { method: 'POST' }),
    offline: () => request<{ online: boolean }>('/api/presence', { method: 'DELETE' }),
  },
  upload: (body: { data_url: string; type: string; name: string }) =>
    request<{ url: string; type: 'image' | 'file'; name: string }>('/api/upload', { method: 'POST', body: JSON.stringify(body) }),
};
