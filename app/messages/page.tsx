'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader } from '@/components/app/app-header';
import { api } from '@/lib/api-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { PrivateChat } from '@/lib/types';

export default function MessagesPage() {
  return (
    <AuthGuard>
      <MessagesContent />
    </AuthGuard>
  );
}

function MessagesContent() {
  const router = useRouter();
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.private.list().then(({ chats }) => {
      setChats(chats);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => router.push('/home')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
            <p className="text-sm text-muted-foreground">Your private conversations</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-center animate-fade-in">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <MessageCircle className="h-7 w-7 text-primary" />
            </div>
            <p className="font-medium">No conversations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click on a member in any room to start a private chat.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => router.push(`/messages/${chat.id}`)}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/50 animate-fade-in"
              >
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={chat.other_user.avatar_url ?? undefined} />
                    <AvatarFallback>{chat.other_user.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {chat.other_user.is_online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-success" />
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{chat.other_user.display_name}</span>
                    {chat.last_message && (
                      <span className="flex-shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(chat.last_message.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {chat.last_message
                      ? (chat.last_message.attachment_type ? `[${chat.last_message.attachment_type}]` : chat.last_message.content)
                      : 'No messages yet'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
