export type Role = 'owner' | 'admin' | 'moderator' | 'member';

export type AttachmentType = 'image' | 'file';

export type NotificationType =
  | 'mention'
  | 'user_joined'
  | 'user_left'
  | 'message'
  | 'kick'
  | 'ban'
  | 'role';

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  is_online: boolean;
  last_active_at: string;
  created_at: string;
  last_username_change: string | null;
}

export interface SessionUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  icon: string;
  owner_id: string;
  code: string;
  created_at: string;
  member_count?: number;
  owner?: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  my_role?: Role;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  user: User;
}

export interface RoomBan {
  id: string;
  room_id: string;
  user_id: string;
  banned_by: string;
  banned_at: string;
  reason: string | null;
  user: User;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  reply_to_id: string | null;
  attachment_url: string | null;
  attachment_type: AttachmentType | null;
  attachment_name: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  sender: User;
  reply_to?: { id: string; content: string | null; sender: Pick<User, 'username' | 'display_name'> } | null;
}

export interface PrivateChat {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
  other_user: User;
  last_message?: {
    content: string | null;
    attachment_type: AttachmentType | null;
    created_at: string;
    sender_id: string;
  } | null;
}

export interface PrivateMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: AttachmentType | null;
  attachment_name: string | null;
  read_at: string | null;
  created_at: string;
  sender: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  dark_mode: boolean;
  desktop_notifications: boolean;
  mention_notifications: boolean;
  sound_enabled: boolean;
  updated_at: string;
}

export interface ApiError {
  error: string;
}
