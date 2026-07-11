'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader } from '@/components/app/app-header';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  LogIn,
  Users,
  MessageCircle,
  User as UserIcon,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Room } from '@/lib/types';

const ROOM_ICONS = ['💬', '🎮', '🎵', '📚', '💻', '🎨', '⚽', '🍕', '✈️', '🔥', '🌟', '🚀'];

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

function HomeContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    api.rooms.list().then(({ rooms }) => {
      setRooms(rooms);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Greeting */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back, <span className="gradient-text">{user?.display_name}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Pick up where you left off or start something new.
          </p>
        </div>

        {/* Quick actions */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CreateRoomDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={(room) => { setRooms((r) => [room, ...r]); router.push(`/rooms/${room.id}`); }}
          />
          <JoinRoomDialog
            open={joinOpen}
            onOpenChange={setJoinOpen}
            onJoined={(room) => router.push(`/rooms/${room.id}`)}
          />
          <QuickCard
            icon={<MessageCircle className="h-6 w-6" />}
            title="Messages"
            subtitle="Private chats"
            onClick={() => router.push('/messages')}
          />
          <QuickCard
            icon={<UserIcon className="h-6 w-6" />}
            title="Profile"
            subtitle="View your page"
            onClick={() => router.push('/profile')}
          />
        </div>

        {/* Recent rooms */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent rooms</h2>
            {rooms.length > 0 && (
              <Badge variant="secondary">{rooms.length} joined</Badge>
            )}
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="h-32 animate-pulse bg-muted/50" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center animate-fade-in">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-medium">No rooms yet</p>
                <p className="text-sm text-muted-foreground">Create a room or join one with a code to get started.</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create room
                </Button>
                <Button variant="outline" onClick={() => setJoinOpen(true)}>
                  <LogIn className="mr-2 h-4 w-4" /> Join room
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} onClick={() => router.push(`/rooms/${room.id}`)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function QuickCard({
  icon, title, subtitle, onClick,
}: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 animate-slide-up"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </button>
  );
}

function RoomCard({ room, onClick }: { room: Room; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 animate-slide-up"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">
          {room.icon}
        </div>
        {room.my_role === 'owner' && <Badge className="gradient-primary border-0">Owner</Badge>}
        {room.my_role === 'admin' && <Badge variant="secondary">Admin</Badge>}
        {room.my_role === 'moderator' && <Badge variant="outline">Mod</Badge>}
      </div>
      <div>
        <div className="font-semibold leading-tight">{room.name}</div>
        {room.description && (
          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{room.description}</div>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {room.member_count ?? 0}</span>
        <span>•</span>
        <span>Code: <span className="font-mono font-medium text-foreground">{room.code}</span></span>
      </div>
    </button>
  );
}

function CreateRoomDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (room: Room) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('💬');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { room } = await api.rooms.create({ name, description, icon });
      toast.success('Room created!');
      onCreated(room);
      onOpenChange(false);
      setName(''); setDescription(''); setIcon('💬');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 animate-slide-up">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Plus className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Create room</div>
            <div className="text-sm text-muted-foreground">Start a new space</div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new room</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ROOM_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-all ${icon === emoji ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted hover:bg-muted/70'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="room-name">Room name</Label>
            <Input id="room-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My awesome room" maxLength={50} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="room-desc">Description (optional)</Label>
            <Textarea id="room-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this room about?" maxLength={200} rows={3} />
          </div>
          <Button onClick={submit} disabled={loading || !name.trim()} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create room
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JoinRoomDialog({
  open, onOpenChange, onJoined,
}: { open: boolean; onOpenChange: (v: boolean) => void; onJoined: (room: Room) => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { room, already_member } = await api.rooms.join(code.trim().toUpperCase());
      if (already_member) toast.info('You are already in this room.');
      else toast.success('Joined room!');
      onJoined(room);
      onOpenChange(false);
      setCode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 animate-slide-up">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <LogIn className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Join room</div>
            <div className="text-sm text-muted-foreground">Enter a room code</div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a room</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-code">Room code</Label>
            <Input
              id="room-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              className="font-mono text-lg tracking-wider"
              maxLength={8}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <Button onClick={submit} disabled={loading || code.length < 4} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Join room
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
