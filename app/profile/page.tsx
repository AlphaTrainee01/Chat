'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader } from '@/components/app/app-header';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MessageCircle, Users, Settings as SettingsIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { Room, User } from '@/lib/types';

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<(User & { bio: string }) | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [chats, setChats] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    // Fetch full profile via me endpoint extended — we use settings profile data
    fetch('/api/auth/me').then(async (r) => {
      const data = await r.json();
      if (data.user) setProfile(data.user);
    });
    api.rooms.list().then(({ rooms }) => setRooms(rooms)).catch(() => {});
    api.private.list().then(({ chats }) => setChats(chats.length)).catch(() => {});
  }, [user]);

  const joinDate = profile ? format(new Date(profile.created_at || Date.now()), 'MMMM d, yyyy') : '';

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => router.push('/home')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        </div>

        {/* Profile header card */}
        <Card className="mb-6 overflow-hidden animate-slide-up">
          <div className="h-28 gradient-primary" />
          <div className="px-6 pb-6">
            <div className="-mt-12 mb-4 flex items-end justify-between">
              <Avatar className="h-24 w-24 border-4 border-card">
                <AvatarImage src={profile?.avatar_url ?? user?.avatar_url ?? undefined} />
                <AvatarFallback className="text-3xl">{user?.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <Button variant="outline" onClick={() => router.push('/settings')}>
                <SettingsIcon className="mr-2 h-4 w-4" /> Edit
              </Button>
            </div>
            <h2 className="text-xl font-bold">{profile?.display_name ?? user?.display_name}</h2>
            <p className="text-sm text-muted-foreground">@{profile?.username ?? user?.username}</p>
            {profile?.bio && <p className="mt-3 text-sm">{profile.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Joined {joinDate}
              </span>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <Card className="p-5 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{rooms.length}</div>
                <div className="text-xs text-muted-foreground">Rooms joined</div>
              </div>
            </div>
          </Card>
          <Card className="p-5 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{chats}</div>
                <div className="text-xs text-muted-foreground">Conversations</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Rooms */}
        <h3 className="mb-3 text-lg font-semibold">Your rooms</h3>
        {rooms.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            You haven&apos;t joined any rooms yet.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => router.push(`/rooms/${room.id}`)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md animate-fade-in"
              >
                <span className="text-2xl">{room.icon}</span>
                <div className="flex-1 overflow-hidden">
                  <div className="truncate font-medium">{room.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{room.member_count} members</div>
                </div>
                {room.my_role === 'owner' && <Badge className="gradient-primary border-0">Owner</Badge>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
