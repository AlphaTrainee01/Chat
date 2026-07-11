'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Crown, Shield, Wrench, MoreVertical, MessageCircle, UserMinus, Ban, ArrowUpCircle, ArrowDownCircle, KeyRound } from 'lucide-react';
import type { RoomMember, Role } from '@/lib/types';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

interface Props {
  roomId: string;
  members: RoomMember[];
  onlineUsers: Set<string>;
  myRole: Role;
}

const roleIcon: Record<Role, React.ReactNode> = {
  owner: <Crown className="h-3 w-3 text-warning" />,
  admin: <Shield className="h-3 w-3 text-primary" />,
  moderator: <Wrench className="h-3 w-3 text-success" />,
  member: null,
};

const roleRank: Record<Role, number> = { member: 0, moderator: 1, admin: 2, owner: 3 };

export function MembersSidebar({ roomId, members, onlineUsers, myRole }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const online = members.filter((m) => onlineUsers.has(m.user_id) || m.user_id === user?.id);
  const offline = members.filter((m) => !onlineUsers.has(m.user_id) && m.user_id !== user?.id);
  online.sort((a, b) => roleRank[b.role] - roleRank[a.role]);
  offline.sort((a, b) => roleRank[b.role] - roleRank[a.role]);

  async function openPrivateChat(userId: string) {
    try {
      const { chat } = await api.private.create(userId);
      router.push(`/messages/${chat.id}`);
    } catch {
      toast.error('Could not open chat');
    }
  }

  async function manageMember(action: 'kick' | 'ban' | 'promote' | 'demote' | 'transfer', userId: string, role?: Role) {
    try {
      await api.rooms.manageMember(roomId, { action, user_id: userId, role });
      toast.success(`Member ${action}ed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h3 className="font-semibold">Members</h3>
        <p className="text-xs text-muted-foreground">{members.length} total</p>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <MemberGroup label="Online" count={online.length}>
          {online.map((m) => (
            <MemberRow key={m.id} member={m} isOnline onMessage={() => openPrivateChat(m.user_id)} canManage={roleRank[myRole] > roleRank[m.role] && m.user_id !== user?.id} myRole={myRole} onManage={manageMember} />
          ))}
        </MemberGroup>
        {offline.length > 0 && (
          <MemberGroup label="Offline" count={offline.length}>
            {offline.map((m) => (
              <MemberRow key={m.id} member={m} isOnline={false} onMessage={() => openPrivateChat(m.user_id)} canManage={roleRank[myRole] > roleRank[m.role] && m.user_id !== user?.id} myRole={myRole} onManage={manageMember} />
            ))}
          </MemberGroup>
        )}
      </div>
    </div>
  );
}

function MemberGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label} — {count}
      </div>
      {children}
    </div>
  );
}

function MemberRow({ member, isOnline, onMessage, canManage, myRole, onManage }: {
  member: RoomMember;
  isOnline: boolean;
  onMessage: () => void;
  canManage: boolean;
  myRole: Role;
  onManage: (action: 'kick' | 'ban' | 'promote' | 'demote' | 'transfer', userId: string, role?: Role) => void;
}) {
  return (
    <div className="group flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors">
      <div className="relative">
        <Avatar className="h-9 w-9">
          <AvatarImage src={member.user.avatar_url ?? undefined} />
          <AvatarFallback>{member.user.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-success" />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{member.user.display_name}</span>
          {roleIcon[member.role]}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          @{member.user.username}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onMessage}>
          <MessageCircle className="h-4 w-4" />
        </Button>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              {myRole === 'owner' && member.role !== 'admin' && (
                <DropdownMenuItem onClick={() => onManage('promote', member.user_id, 'admin')}>
                  <ArrowUpCircle className="mr-2 h-3.5 w-3.5" /> Promote to Admin
                </DropdownMenuItem>
              )}
              {myRole === 'owner' && member.role === 'admin' && (
                <DropdownMenuItem onClick={() => onManage('demote', member.user_id, 'moderator')}>
                  <ArrowDownCircle className="mr-2 h-3.5 w-3.5" /> Demote to Moderator
                </DropdownMenuItem>
              )}
              {myRole === 'owner' && member.role === 'moderator' && (
                <DropdownMenuItem onClick={() => onManage('demote', member.user_id, 'member')}>
                  <ArrowDownCircle className="mr-2 h-3.5 w-3.5" /> Demote to Member
                </DropdownMenuItem>
              )}
              {myRole === 'owner' && member.role === 'member' && (
                <DropdownMenuItem onClick={() => onManage('promote', member.user_id, 'moderator')}>
                  <ArrowUpCircle className="mr-2 h-3.5 w-3.5" /> Promote to Moderator
                </DropdownMenuItem>
              )}
              {myRole === 'owner' && member.role !== 'owner' && (
                <DropdownMenuItem onClick={() => onManage('transfer', member.user_id)}>
                  <KeyRound className="mr-2 h-3.5 w-3.5" /> Transfer Ownership
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onManage('kick', member.user_id)}>
                <UserMinus className="mr-2 h-3.5 w-3.5" /> Kick
              </DropdownMenuItem>
              {myRole === 'owner' && (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onManage('ban', member.user_id)}>
                  <Ban className="mr-2 h-3.5 w-3.5" /> Ban
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
