'use client';

import { useEffect, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { REALTIME } from '@/lib/constants';
import { useAuth } from './use-auth';
import { api } from '@/lib/api-client';
import type { PrivateMessage } from '@/lib/types';

export function usePrivateRealtime(chatId: string, opts: {
  onMessage: (msg: PrivateMessage) => void;
  onRead: () => void;
}) {
  const { user } = useAuth();
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!user) return;
    const channel = supabaseBrowser
      .channel(REALTIME.private(chatId))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const row = payload.new as PrivateMessage;
          const { data: sender } = await supabaseBrowser
            .from('users')
            .select('id, username, display_name, avatar_url, bio, is_online, last_active_at, created_at, last_username_change')
            .eq('id', row.sender_id)
            .maybeSingle();
          const msg: PrivateMessage = {
            ...row,
            sender: sender ?? { id: row.sender_id, username: 'unknown', display_name: 'Unknown', avatar_url: null, bio: '', is_online: false, last_active_at: '', created_at: '', last_username_change: null },
          };
          optsRef.current.onMessage(msg);
          if (row.sender_id !== user.id) {
            api.private.markRead(chatId).catch(() => {});
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'private_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const row = payload.new as PrivateMessage;
          if (row.read_at && row.sender_id === user.id) {
            optsRef.current.onRead();
          }
        }
      )
      .subscribe();

    return () => { supabaseBrowser.removeChannel(channel); };
  }, [chatId, user]);
}
