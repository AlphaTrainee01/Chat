'use client';

import { memo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Reply, Pencil, Trash2, FileText, Download, Check, CheckCheck } from 'lucide-react';
import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

interface Props {
  message: Message;
  isOwn: boolean;
  canModerate: boolean;
  onReply: (msg: Message) => void;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showAvatar: boolean;
}

function MessageBubbleImpl({ message, isOwn, canModerate, onReply, onEdit, onDelete, showAvatar }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content ?? '');
  const [busy, setBusy] = useState(false);

  if (message.deleted_at) {
    return (
      <div className={cn('flex gap-3 px-4 py-1', isOwn && 'flex-row-reverse')}>
        <div className={cn('max-w-[75%] rounded-2xl px-4 py-2 text-sm italic text-muted-foreground', isOwn ? 'chat-bubble-me' : 'chat-bubble-them')}>
          Message deleted
        </div>
      </div>
    );
  }

  const time = new Date(message.created_at);
  const timeLabel = isToday(time) ? format(time, 'HH:mm') : isYesterday(time) ? `Yesterday ${format(time, 'HH:mm')}` : format(time, 'MMM d, HH:mm');
  const canDelete = isOwn || canModerate;
  const canEdit = isOwn && !message.attachment_url;

  async function saveEdit() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await onEdit(message.id, draft.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn('group flex gap-3 px-4 py-1.5 animate-fade-in', isOwn && 'flex-row-reverse')}>
      {showAvatar && !isOwn && (
        <Avatar className="mt-1 h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.sender.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{message.sender.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      {(isOwn || !showAvatar) && <div className="w-8 flex-shrink-0" />}

      <div className={cn('max-w-[75%] sm:max-w-[65%]', isOwn && 'items-end')}>
        {showAvatar && !isOwn && (
          <div className="mb-0.5 ml-1 text-xs font-medium text-muted-foreground">
            {message.sender.display_name}
          </div>
        )}

        {message.reply_to && (
          <div className={cn('mb-1 rounded-lg border-l-2 px-2 py-1 text-xs text-muted-foreground', isOwn ? 'border-primary-foreground/40 mr-1' : 'border-primary/40 ml-1')}>
            <span className="font-medium">@{message.reply_to.sender.username}: </span>
            {message.reply_to.content || '[attachment]'}
          </div>
        )}

        <div className={cn('relative rounded-2xl px-4 py-2.5 text-sm break-words', isOwn ? 'chat-bubble-me rounded-tr-md' : 'chat-bubble-them rounded-tl-md')}>
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-20 bg-background/20 border-0 text-foreground resize-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={busy}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
              {message.attachment_url && message.attachment_type === 'image' && (
                <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={message.attachment_url} alt={message.attachment_name ?? 'image'} className="max-w-full rounded-lg max-h-64 object-cover" />
                </a>
              )}
              {message.attachment_url && message.attachment_type === 'file' && (
                <a href={message.attachment_url} download={message.attachment_name} className="mt-2 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-xs hover:bg-black/20 transition-colors">
                  <FileText className="h-4 w-4" />
                  <span className="flex-1 truncate">{message.attachment_name}</span>
                  <Download className="h-4 w-4" />
                </a>
              )}
            </>
          )}

          <div className={cn('mt-1 flex items-center gap-1 text-[10px] opacity-70', isOwn ? 'justify-end' : 'justify-start')}>
            {message.edited_at && <span>edited</span>}
            <span>{timeLabel}</span>
          </div>

          {!editing && (
            <div className={cn('absolute top-1 opacity-0 transition-opacity group-hover:opacity-100', isOwn ? '-left-8' : '-right-8')}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground transition-colors shadow-sm">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="text-xs">
                  <DropdownMenuItem onClick={() => onReply(message)}>
                    <Reply className="mr-2 h-3.5 w-3.5" /> Reply
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => { setDraft(message.content ?? ''); setEditing(true); }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(message.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
