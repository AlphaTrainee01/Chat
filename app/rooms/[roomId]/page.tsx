'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader } from '@/components/app/app-header';
import { MembersSidebar } from '@/components/chat/members-sidebar';
import { MessageBubble } from '@/components/chat/message-bubble';
import { MessageComposer } from '@/components/chat/message-composer';
import { useRoomRealtime } from '@/hooks/use-room-realtime';
import { useNotificationsRealtime } from '@/hooks/use-notifications-realtime';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Menu, Users, Copy, Check, ChevronLeft, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { toast } from 'sonner';
import type { Message, Room, Role } from '@/lib/types';

export default function RoomPage() {
  return (
    <AuthGuard>
      <RoomContent />
    </AuthGuard>
  );
}

function RoomContent() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roomListOpen, setRoomListOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const onMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);
  const onMessageUpdate = useCallback((msg: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
  }, []);
  const onMessageDelete = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString(), content: null, attachment_url: null } : m)));
  }, []);

  const { members, onlineUsers, typingList, sendTyping, stopTyping } = useRoomRealtime(roomId, {
    onMessage, onMessageUpdate, onMessageDelete,
  });

  // Load room + messages
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.rooms.get(roomId).then(({ room }) => room).catch(() => null),
      api.rooms.messages(roomId).then(({ messages, next_cursor }) => {
        setMessages(messages);
        setCursor(next_cursor);
      }),
    ]).then(([r]) => {
      if (!r) { toast.error('Room not found'); router.replace('/home'); return; }
      setRoom(r);
      setLoading(false);
    });
    api.rooms.list().then(({ rooms }) => setRooms(rooms)).catch(() => {});
  }, [roomId, router]);

  // Scroll to bottom on new messages (if already at bottom)
  useEffect(() => {
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Browser notifications
  useNotificationsRealtime((n) => {
    if (n.type === 'mention' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(n.title, { body: n.body ?? undefined });
    }
    toast(n.title, { description: n.body ?? undefined });
  });

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (el.scrollTop < 50 && cursor && !loadingMore) {
      loadMore();
    }
  }, [cursor, loadingMore]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { messages: older, next_cursor } = await api.rooms.messages(roomId, cursor);
      const el = scrollRef.current;
      const prevHeight = el?.scrollHeight ?? 0;
      setMessages((prev) => [...older, ...prev]);
      setCursor(next_cursor);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, cursor, loadingMore]);

  async function sendMessage(payload: { content?: string; attachment_url?: string; attachment_type?: 'image' | 'file'; attachment_name?: string }) {
    await api.rooms.sendMessage(roomId, { ...payload, reply_to_id: replyTo?.id });
    setReplyTo(null);
    atBottomRef.current = true;
  }

  async function editMessage(id: string, content: string) {
    await api.rooms.editMessage(roomId, id, content);
  }

  async function deleteMessage(id: string) {
    await api.rooms.deleteMessage(roomId, id);
  }

  async function leaveRoom() {
    try {
      await api.rooms.leave(roomId);
      toast.success('Left the room');
      router.push('/home');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave');
    }
  }

  async function deleteRoom() {
    try {
      await api.rooms.delete(roomId);
      toast.success('Room deleted');
      router.push('/home');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(room?.code ?? '');
    setCopied(true);
    toast.success('Room code copied');
    setTimeout(() => setCopied(false), 2000);
  }

  const canModerate = room?.my_role === 'admin' || room?.my_role === 'owner' || room?.my_role === 'moderator';

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background">
          <AppHeader />
          <div className="flex h-[calc(100vh-4rem)]">
            <div className="hidden lg:flex w-64 border-r border-border p-4 flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <div className="flex-1 flex flex-col">
              <Skeleton className="h-14 w-full" />
              <div className="flex-1 p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-2/3" />)}
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex h-screen flex-col bg-background overflow-hidden">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden">
          {/* Room list sidebar (left) */}
          <RoomListSidebar
            rooms={rooms}
            currentRoomId={roomId}
            open={roomListOpen}
            onOpenChange={setRoomListOpen}
          />

          {/* Center chat */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* Room header */}
            <div className="flex h-14 items-center gap-3 border-b border-border px-4 glass-strong">
              <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setRoomListOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <span className="text-2xl">{room?.icon}</span>
              <div className="flex-1 min-w-0">
                <h2 className="truncate font-semibold">{room?.name}</h2>
                <p className="truncate text-xs text-muted-foreground">{members.length} members</p>
              </div>
              <button onClick={copyCode} className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-mono hover:bg-muted transition-colors">
                {room?.code}
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSidebarOpen((s) => !s)}>
                {sidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-thin py-4">
              {loadingMore && (
                <div className="flex justify-center py-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center px-6">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
                    {room?.icon}
                  </div>
                  <h3 className="font-semibold text-lg">Welcome to {room?.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                    This is the beginning of the conversation. Say something to start the chat!
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const prev = messages[i - 1];
                  const showAvatar = !prev || prev.sender_id !== msg.sender_id || new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.sender_id === user?.id}
                      canModerate={canModerate}
                      onReply={setReplyTo}
                      onEdit={editMessage}
                      onDelete={deleteMessage}
                      showAvatar={showAvatar}
                    />
                  );
                })
              )}
              <div ref={bottomRef} />

              {typingList.length > 0 && (
                <div className="px-4 py-2 text-xs text-muted-foreground animate-fade-in">
                  <span className="flex items-center gap-1">
                    <span className="flex gap-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-typing" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-typing" style={{ animationDelay: '200ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-typing" style={{ animationDelay: '400ms' }} />
                    </span>
                    {typingList.length === 1
                      ? `${typingList[0].display_name} is typing...`
                      : `${typingList.length} people are typing...`}
                  </span>
                </div>
              )}
            </div>

            {/* Composer */}
            <MessageComposer
              onSend={sendMessage}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onTyping={sendTyping}
              onStopTyping={stopTyping}
              placeholder={`Message #${room?.name}`}
            />
          </div>

          {/* Members sidebar (right) */}
          <div className={`border-l border-border bg-card transition-all duration-300 ${sidebarOpen ? 'w-72' : 'w-0'} overflow-hidden`}>
            {room && (
              <div className="h-full w-72">
                <MembersSidebar roomId={roomId} members={members} onlineUsers={onlineUsers} myRole={room.my_role as Role} />
              </div>
            )}
          </div>

          {/* Mobile members drawer */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setSidebarOpen(false)} />
              <div className="absolute right-0 top-0 h-full w-72 bg-card shadow-xl animate-slide-in-right">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <span className="font-semibold">Members</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
                    <PanelRightClose className="h-5 w-5" />
                  </Button>
                </div>
                {room && (
                  <div className="h-[calc(100%-3.5rem)]">
                    <MembersSidebar roomId={roomId} members={members} onlineUsers={onlineUsers} myRole={room.my_role as Role} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function RoomListSidebar({ rooms, currentRoomId, open, onOpenChange }: {
  rooms: Room[];
  currentRoomId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex w-64 flex-shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold">Rooms</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => router.push(`/rooms/${room.id}`)}
              className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${room.id === currentRoomId ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            >
              <span className="text-xl flex-shrink-0">{room.icon}</span>
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-sm font-medium">{room.name}</div>
                <div className="truncate text-xs text-muted-foreground">{room.member_count} members</div>
              </div>
            </button>
          ))}
          {rooms.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">No rooms yet</div>
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button variant="outline" className="w-full" onClick={() => router.push('/home')}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Home
          </Button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-card shadow-xl animate-slide-in-right">
            <div className="flex h-14 items-center gap-2 border-b border-border px-4">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-semibold">Rooms</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => { router.push(`/rooms/${room.id}`); onOpenChange(false); }}
                  className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${room.id === currentRoomId ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  <span className="text-xl flex-shrink-0">{room.icon}</span>
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate text-sm font-medium">{room.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{room.member_count} members</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
