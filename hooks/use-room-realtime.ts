'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { REALTIME } from '@/lib/constants';
import { useAuth } from './use-auth';
import { api } from '@/lib/api-client';
import type { Message, RoomMember } from '@/lib/types';

type TypingState = Record<string, { username: string; display_name: string; ts: number }>;

export function useRoomRealtime(roomId: string, opts: {
  onMessage: (msg: Message) => void;
  onMessageUpdate: (msg: Message) => void;
  onMessageDelete: (id: string) => void;
}) {
  const { user } = useAuth();
  const { onMessage, onMessageUpdate, onMessageDelete } = opts;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [members, setMembers] = useState<RoomMember[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<TypingState>({});
  const channelRef = useRef<ReturnType<typeof supabaseBrowser.channel> | null>(null);

  // Load members initially
  useEffect(() => {
    api.rooms.members(roomId).then(({ members }) => setMembers(members)).catch(() => {});
  }, [roomId]);

  // Subscribe to room_members changes
  useEffect(() => {
    const memberChannel = supabaseBrowser
      .channel(`members:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, () => {
        api.rooms.members(roomId).then(({ members }) => setMembers(members)).catch(() => {});
      })
      .subscribe();
    return () => { supabaseBrowser.removeChannel(memberChannel); };
  }, [roomId]);

  // Messages + typing + presence
  useEffect(() => {
    if (!user) return;
    const channel = supabaseBrowser
      .channel(REALTIME.room(roomId), {
        config: { presence: { key: user.id } },
      });

    channel
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as Message;
          // Hydrate sender
          const { data: sender } = await supabaseBrowser
            .from('users')
            .select('id, username, display_name, avatar_url, bio, is_online, last_active_at, created_at, last_username_change')
            .eq('id', row.sender_id)
            .maybeSingle();
          optsRef.current.onMessage({
            ...row,
            sender: sender ?? { id: row.sender_id, username: 'unknown', display_name: 'Unknown', avatar_url: null, bio: '', is_online: false, last_active_at: '', created_at: '', last_username_change: null },
            reply_to: null,
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as Message;
          if (row.deleted_at) optsRef.current.onMessageDelete(row.id);
          else optsRef.current.onMessageUpdate(row as Message);
        }
      )
      .on('broadcast', { event: 'typing' }, (payload: { payload: { user_id: string; username: string; display_name: string } }) => {
        const p = payload.payload;
        setTyping((prev) => {
          if (p.user_id === user.id) return prev;
          const next = { ...prev, [p.user_id]: { username: p.username, display_name: p.display_name, ts: Date.now() } };
          return next;
        });
      })
      .on('broadcast', { event: 'stop_typing' }, (payload: { payload: { user_id: string } }) => {
        setTyping((prev) => {
          if (!prev[payload.payload.user_id]) return prev;
          const next = { ...prev };
          delete next[payload.payload.user_id];
          return next;
        });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        for (const key of Object.keys(state)) ids.add(key);
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, username: user.username, display_name: user.display_name });
        }
      });

    channelRef.current = channel;
    return () => { supabaseBrowser.removeChannel(channel); };
  }, [roomId, user]);

  // Prune stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        let changed = false;
        const next: TypingState = {};
        for (const [id, info] of Object.entries(prev)) {
          if (now - info.ts < 4000) next[id] = info;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const sendTyping = useCallback(() => {
    if (!user || !channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, username: user.username, display_name: user.display_name } });
  }, [user]);

  const stopTyping = useCallback(() => {
    if (!user || !channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'stop_typing', payload: { user_id: user.id } });
  }, [user]);

  const typingList = Object.values(typing).filter((t) => t.username !== user?.username);

  return { members, onlineUsers, typingList, sendTyping, stopTyping };
}
