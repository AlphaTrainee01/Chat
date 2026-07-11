'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader } from '@/components/app/app-header';
import { MessageComposer } from '@/components/chat/message-composer';
import { usePrivateRealtime } from '@/hooks/use-private-realtime';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, Download, CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import type { PrivateChat, PrivateMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function PrivateChatPage() {
  return (
    <AuthGuard>
      <ChatContent />
    </AuthGuard>
  );
}

function ChatContent() {
  const { chatId } = useParams<{ chatId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [chat, setChat] = useState<PrivateChat | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<PrivateChat[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const onMessage = useCallback((msg: PrivateMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const onRead = useCallback(() => {
    setMessages((prev) => prev.map((m) => (m.sender_id === user?.id && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m)));
  }, [user]);

  usePrivateRealtime(chatId, { onMessage, onRead });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.private.messages(chatId).then(({ messages }) => { setMessages(messages); }),
      api.private.list().then(({ chats }) => {
        setChats(chats);
        const current = chats.find((c) => c.id === chatId);
        setChat(current ?? null);
      }),
    ]).then(() => setLoading(false));
    api.private.markRead(chatId).catch(() => {});
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(payload: { content?: string; attachment_url?: string; attachment_type?: 'image' | 'file'; attachment_name?: string }) {
    await api.private.send(chatId, payload);
  }

  const otherUser = chat?.other_user;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl">
        {/* Chat list (desktop) */}
        <div className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-border bg-card">
          <div className="border-b border-border p-4">
            <h3 className="font-semibold">Conversations</h3>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
            {chats.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/messages/${c.id}`)}
                className={`flex w-full items-center gap-2 rounded-lg p-2.5 text-left transition-colors ${c.id === chatId ? 'bg-primary/10' : 'hover:bg-muted'}`}
              >
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={c.other_user.avatar_url ?? undefined} />
                  <AvatarFallback>{c.other_user.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="truncate text-sm font-medium">{c.other_user.display_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.last_message ? (c.last_message.attachment_type ? `[${c.last_message.attachment_type}]` : c.last_message.content) : 'No messages'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <div className="flex h-14 items-center gap-3 border-b border-border px-4 glass-strong">
            <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={() => router.push('/messages')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {otherUser && (
              <>
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={otherUser.avatar_url ?? undefined} />
                    <AvatarFallback>{otherUser.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {otherUser.is_online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-success" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="truncate font-semibold">{otherUser.display_name}</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {otherUser.is_online ? 'Online' : `last active ${formatDistanceShort(otherUser.last_active_at)}`}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin py-4">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className={cn('h-16', i % 2 === 0 ? 'w-2/3 ml-auto' : 'w-2/3')} />)}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-6">
                <Avatar className="mb-3 h-16 w-16">
                  <AvatarImage src={otherUser?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xl">{otherUser?.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-lg">{otherUser?.display_name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This is the start of your private conversation. Say hello!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                const time = new Date(msg.created_at);
                const timeLabel = isToday(time) ? format(time, 'HH:mm') : isYesterday(time) ? `Yesterday ${format(time, 'HH:mm')}` : format(time, 'MMM d, HH:mm');
                return (
                  <div key={msg.id} className={cn('flex px-4 py-1 animate-fade-in', isOwn ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[75%] sm:max-w-[65%]')}>
                      <div className={cn('rounded-2xl px-4 py-2.5 text-sm break-words', isOwn ? 'chat-bubble-me rounded-tr-md' : 'chat-bubble-them rounded-tl-md')}>
                        {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                        {msg.attachment_url && msg.attachment_type === 'image' && (
                          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.attachment_url} alt={msg.attachment_name ?? 'image'} className="max-w-full rounded-lg max-h-64 object-cover" />
                          </a>
                        )}
                        {msg.attachment_url && msg.attachment_type === 'file' && (
                          <a href={msg.attachment_url} download={msg.attachment_name} className="mt-2 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-xs hover:bg-black/20">
                            <FileText className="h-4 w-4" />
                            <span className="flex-1 truncate">{msg.attachment_name}</span>
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        <div className={cn('mt-1 flex items-center gap-1 text-[10px] opacity-70', isOwn ? 'justify-end' : 'justify-start')}>
                          <span>{timeLabel}</span>
                          {isOwn && msg.read_at && <CheckCheck className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <MessageComposer
            onSend={sendMessage}
            replyTo={null}
            onCancelReply={() => {}}
            onTyping={() => {}}
            onStopTyping={() => {}}
            placeholder={`Message ${otherUser?.display_name ?? ''}`}
          />
        </div>
      </div>
    </div>
  );
}

function formatDistanceShort(iso: string): string {
  if (!iso) return 'unknown';
  try {
    return formatDistanceToNowShort(new Date(iso));
  } catch {
    return 'unknown';
  }
}

function formatDistanceToNowShort(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
