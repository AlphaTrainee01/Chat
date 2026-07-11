'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MessageCircle, Search, Bell, LogOut, User, Settings, Home } from 'lucide-react';
import { toast } from 'sonner';
import type { Notification, Room, SessionUser } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

export function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ rooms: Room[]; users: SessionUser[] } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.notifications.list(true).then(({ notifications }) => setNotifications(notifications)).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length < 1) { setSearchResults(null); return; }
      api.search(searchQuery).then((r) => {
        setSearchResults({ rooms: r.rooms, users: r.users });
        setSearchOpen(true);
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleLogout() {
    await logout();
    toast.success('Signed out');
    router.replace('/login');
  }

  async function markAllRead() {
    await api.notifications.markRead();
    setNotifications([]);
  }

  const unreadCount = notifications.length;

  return (
    <header className="sticky top-0 z-40 glass-strong border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button onClick={() => router.push('/home')} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="hidden text-lg font-bold tracking-tight sm:inline">Pulse</span>
        </button>

        {/* Search */}
        <div ref={searchRef} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults && setSearchOpen(true)}
            placeholder="Search rooms, people..."
            className="pl-9 h-10 bg-muted/50 border-transparent focus-visible:bg-background"
          />
          {searchOpen && searchResults && (searchResults.rooms.length > 0 || searchResults.users.length > 0) && (
            <div className="absolute top-full mt-2 w-full rounded-xl border border-border bg-popover shadow-xl animate-scale-in overflow-hidden">
              {searchResults.rooms.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Rooms</div>
                  {searchResults.rooms.slice(0, 5).map((room) => (
                    <button
                      key={room.id}
                      onClick={() => { router.push(`/rooms/${room.id}`); setSearchOpen(false); setSearchQuery(''); }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                    >
                      <span className="text-xl">{room.icon}</span>
                      <div className="flex-1 overflow-hidden">
                        <div className="truncate text-sm font-medium">{room.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{room.description || 'No description'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.users.length > 0 && (
                <div className="p-2 border-t">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">People</div>
                  {searchResults.users.slice(0, 5).map((u) => (
                    <button
                      key={u.id}
                      onClick={async () => {
                        try {
                          const { chat } = await api.private.create(u.id);
                          router.push(`/messages/${chat.id}`);
                          setSearchOpen(false); setSearchQuery('');
                        } catch { toast.error('Could not open chat'); }
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.avatar_url ?? undefined} />
                        <AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <div className="truncate text-sm font-medium">{u.display_name}</div>
                        <div className="truncate text-xs text-muted-foreground">@{u.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* Mobile home */}
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => router.push('/home')}>
            <Home className="h-5 w-5" />
          </Button>

          {/* Notifications */}
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="flex items-center justify-between border-b p-3">
                <span className="font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">You&apos;re all caught up!</div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={async () => {
                        await api.notifications.markRead(n.id);
                        setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                        if (n.link) router.push(n.link);
                        setNotifOpen(false);
                      }}
                      className="flex w-full gap-3 border-b p-3 text-left last:border-0 hover:bg-muted/50"
                    >
                      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-medium">{n.title}</div>
                        {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar_url ?? undefined} />
                  <AvatarFallback>{user?.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">{user?.display_name}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => router.push('/home')}>
                <Home className="mr-2 h-4 w-4" /> Home
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
