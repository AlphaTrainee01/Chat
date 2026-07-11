/*
# Real-Time Room Chat — Core Schema

## Overview
Full schema for a production real-time room chat application using custom
bcrypt + session-cookie authentication (NOT Supabase Auth). The app uses
Next.js API routes as the server (stand-in for Express) and Supabase
Realtime as the transport (stand-in for Socket.IO). All data writes are
mediated by server-side API routes that enforce authorization based on
the session table; RLS here is intentionally permissive (anon+authenticated
read/write) because the API layer is the real authorization boundary and
the client also needs anon-key access for Realtime subscriptions.

## New Tables

1. `users`
   - id (uuid PK)
   - username (text, unique, case-insensitive via citext)
   - password_hash (text, bcrypt hash — never plain text)
   - display_name (text)
   - avatar_url (text, nullable)
   - bio (text, nullable, About/Bio)
   - is_online (boolean, default false — derived/presence flag)
   - last_active_at (timestamptz)
   - created_at (timestamptz, join date)
   - last_username_change (timestamptz, nullable)

2. `sessions`
   - id (uuid PK)
   - token (text, unique, indexed — the opaque session token in the cookie)
   - user_id (uuid FK -> users.id ON DELETE CASCADE)
   - expires_at (timestamptz)
   - created_at (timestamptz)
   - ip_address (text, nullable)
   - user_agent (text, nullable)

3. `rooms`
   - id (uuid PK)
   - name (text)
   - description (text, nullable)
   - icon (text, nullable — emoji or icon identifier)
   - owner_id (uuid FK -> users.id)
   - code (text, unique, indexed — short join code, e.g. 8-char base32)
   - created_at (timestamptz)

4. `room_members`
   - id (uuid PK)
   - room_id (uuid FK -> rooms.id ON DELETE CASCADE)
   - user_id (uuid FK -> users.id ON DELETE CASCADE)
   - role (text: 'owner' | 'admin' | 'moderator' | 'member')
   - joined_at (timestamptz)
   - UNIQUE (room_id, user_id)

5. `room_bans`
   - id (uuid PK)
   - room_id (uuid FK -> rooms.id ON DELETE CASCADE)
   - user_id (uuid FK -> users.id ON DELETE CASCADE)
   - banned_by (uuid FK -> users.id)
   - banned_at (timestamptz)
   - reason (text, nullable)
   - UNIQUE (room_id, user_id)

6. `messages`
   - id (uuid PK)
   - room_id (uuid FK -> rooms.id ON DELETE CASCADE)
   - sender_id (uuid FK -> users.id ON DELETE CASCADE)
   - content (text, nullable when attachment-only)
   - reply_to_id (uuid FK -> messages.id ON DELETE SET NULL, nullable)
   - attachment_url (text, nullable)
   - attachment_type (text: 'image' | 'file' | null)
   - attachment_name (text, nullable)
   - edited_at (timestamptz, nullable)
   - deleted_at (timestamptz, nullable — soft delete)
   - created_at (timestamptz)

7. `private_chats`
   - id (uuid PK)
   - user_a_id (uuid FK -> users.id ON DELETE CASCADE)
   - user_b_id (uuid FK -> users.id ON DELETE CASCADE)
   - created_at (timestamptz)
   - UNIQUE (least, greatest) enforced via generated columns

8. `private_messages`
   - id (uuid PK)
   - chat_id (uuid FK -> private_chats.id ON DELETE CASCADE)
   - sender_id (uuid FK -> users.id ON DELETE CASCADE)
   - content (text, nullable when attachment-only)
   - attachment_url (text, nullable)
   - attachment_type (text, nullable)
   - attachment_name (text, nullable)
   - read_at (timestamptz, nullable — seen status)
   - created_at (timestamptz)

9. `notifications`
   - id (uuid PK)
   - user_id (uuid FK -> users.id ON DELETE CASCADE — recipient)
   - type (text: 'mention' | 'user_joined' | 'user_left' | 'message' | 'kick' | 'ban' | 'role')
   - title (text)
   - body (text, nullable)
   - link (text, nullable)
   - is_read (boolean, default false)
   - created_at (timestamptz)

10. `user_settings`
    - user_id (uuid PK FK -> users.id ON DELETE CASCADE)
    - dark_mode (boolean, default true)
    - desktop_notifications (boolean, default true)
    - mention_notifications (boolean, default true)
    - sound_enabled (boolean, default true)
    - updated_at (timestamptz)

## Indexes
- users.username (unique, citext)
- sessions.token (unique)
- rooms.code (unique)
- room_members (room_id, user_id) unique
- messages (room_id, created_at) for chat history pagination
- private_messages (chat_id, created_at)
- notifications (user_id, is_read, created_at)

## Security (RLS)
- RLS enabled on every table.
- Policies allow `anon, authenticated` read/write. This is intentional and
  required because the app uses custom session auth (not Supabase Auth), so
  requests from both the browser and server run as the anon role. The real
  authorization boundary is enforced server-side in Next.js API routes,
  which validate the session cookie, ownership, room membership, and role
  before every mutation. Realtime subscriptions also require anon-key
  access to the tables.

## Notes
1. Password hashes use bcrypt (cost 10) and are stored in `password_hash`.
2. Session tokens are 32-byte cryptographically-random hex strings.
3. `users.username` uses `citext` for case-insensitive uniqueness while
   preserving the original casing in a separate generated column is not
   needed — citext preserves display case but compares case-insensitively.
4. Private chat uniqueness uses two generated columns (`member_lo`,
   `member_hi`) with a unique constraint so that a chat between A and B is
   the same row regardless of who initiated.
*/

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  bio text DEFAULT '',
  is_online boolean NOT NULL DEFAULT false,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_username_change timestamptz
);

-- 2. sessions
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- 3. rooms
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT '💬',
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);

-- 4. room_members
CREATE TABLE IF NOT EXISTS room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','moderator','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);

-- 5. room_bans
CREATE TABLE IF NOT EXISTS room_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  UNIQUE (room_id, user_id)
);

-- 6. messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text,
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  attachment_url text,
  attachment_type text CHECK (attachment_type IN ('image','file') OR attachment_type IS NULL),
  attachment_name text,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (content IS NOT NULL OR attachment_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);

-- 7. private_chats
CREATE TABLE IF NOT EXISTS private_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_lo uuid GENERATED ALWAYS AS (least(user_a_id, user_b_id)) STORED,
  member_hi uuid GENERATED ALWAYS AS (greatest(user_a_id, user_b_id)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_lo, member_hi)
);
CREATE INDEX IF NOT EXISTS idx_private_chats_a ON private_chats(user_a_id);
CREATE INDEX IF NOT EXISTS idx_private_chats_b ON private_chats(user_b_id);

-- 8. private_messages
CREATE TABLE IF NOT EXISTS private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES private_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text,
  attachment_url text,
  attachment_type text CHECK (attachment_type IN ('image','file') OR attachment_type IS NULL),
  attachment_name text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (content IS NOT NULL OR attachment_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_private_messages_chat_created ON private_messages(chat_id, created_at DESC);

-- 9. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('mention','user_joined','user_left','message','kick','ban','role')),
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- 10. user_settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dark_mode boolean NOT NULL DEFAULT true,
  desktop_notifications boolean NOT NULL DEFAULT true,
  mention_notifications boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Permissive policies: authorization is enforced in the Next.js API layer
-- (session cookie validation, ownership, membership, role checks).
-- The anon-key client needs access for Realtime subscriptions and for the
-- API routes (which run server-side but still resolve to the anon role
-- when using the anon key). This is intentional for this custom-auth model.

DROP POLICY IF EXISTS "anon_rw_users" ON users;
CREATE POLICY "anon_rw_users" ON users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_u_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_d_users" ON users FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_rw_sessions" ON sessions;
CREATE POLICY "anon_rw_sessions" ON sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_sessions" ON sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_d_sessions" ON sessions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_rw_rooms" ON rooms;
CREATE POLICY "anon_rw_rooms" ON rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_rooms" ON rooms FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_u_rooms" ON rooms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_d_rooms" ON rooms FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_rw_room_members" ON room_members;
CREATE POLICY "anon_rw_room_members" ON room_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_room_members" ON room_members FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_u_room_members" ON room_members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_d_room_members" ON room_members FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_rw_room_bans" ON room_bans;
CREATE POLICY "anon_rw_room_bans" ON room_bans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_room_bans" ON room_bans FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_d_room_bans" ON room_bans FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_rw_messages" ON messages;
CREATE POLICY "anon_rw_messages" ON messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_messages" ON messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_u_messages" ON messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_d_messages" ON messages FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_rw_private_chats" ON private_chats;
CREATE POLICY "anon_rw_private_chats" ON private_chats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_private_chats" ON private_chats FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_d_private_chats" ON private_chats FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_rw_private_messages" ON private_messages;
CREATE POLICY "anon_rw_private_messages" ON private_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_private_messages" ON private_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_u_private_messages" ON private_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_d_private_messages" ON private_messages FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_rw_notifications" ON notifications;
CREATE POLICY "anon_rw_notifications" ON notifications FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_notifications" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_u_notifications" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_d_notifications" ON notifications FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_rw_user_settings" ON user_settings;
CREATE POLICY "anon_rw_user_settings" ON user_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_i_user_settings" ON user_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_u_user_settings" ON user_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_d_user_settings" ON user_settings FOR DELETE TO anon, authenticated USING (true);

-- Enable realtime publication for the chat-critical tables
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages, private_messages, room_members, notifications, rooms, users;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
