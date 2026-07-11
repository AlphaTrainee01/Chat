'use client';

import { useEffect, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { REALTIME } from '@/lib/constants';
import { useAuth } from './use-auth';
import type { Notification } from '@/lib/types';

export function useNotificationsRealtime(onNotification: (n: Notification) => void) {
  const { user } = useAuth();
  const onRef = useRef(onNotification);
  onRef.current = onNotification;

  useEffect(() => {
    if (!user) return;
    const channel = supabaseBrowser
      .channel(REALTIME.user(user.id))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          onRef.current(payload.new as Notification);
        }
      )
      .subscribe();

    return () => { supabaseBrowser.removeChannel(channel); };
  }, [user]);
}
