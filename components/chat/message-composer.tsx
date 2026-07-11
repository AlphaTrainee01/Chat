'use client';

import { useState, useRef, useCallback, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Smile, ImageIcon, Paperclip, Send, X, Loader2 } from 'lucide-react';
import { EMOJIS, ATTACHMENT_MAX_BYTES } from '@/lib/constants';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import type { Message } from '@/lib/types';

interface Props {
  onSend: (payload: {
    content?: string;
    attachment_url?: string;
    attachment_type?: 'image' | 'file';
    attachment_name?: string;
  }) => Promise<void>;
  replyTo: Message | null;
  onCancelReply: () => void;
  onTyping: () => void;
  onStopTyping: () => void;
  placeholder?: string;
}

export function MessageComposer({ onSend, replyTo, onCancelReply, onTyping, onStopTyping, placeholder }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleTyping = useCallback(() => {
    onTyping();
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onStopTyping(), 3000);
  }, [onTyping, onStopTyping]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = content.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      await onSend({ content: text });
      setContent('');
      onStopTyping();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file: File, isImage: boolean) {
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.error('File too large (max 5MB)');
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await api.upload({ data_url: dataUrl, type: file.type, name: file.name });
      await onSend({
        content: content.trim() || undefined,
        attachment_url: result.url,
        attachment_type: result.type,
        attachment_name: result.name,
      });
      setContent('');
      onStopTyping();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  function insertEmoji(emoji: string) {
    setContent((c) => c + emoji);
    setEmojiOpen(false);
  }

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-sm">
      {replyTo && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <div className="flex-1 truncate">
            <span className="font-medium text-primary">Replying to {replyTo.sender.display_name}</span>
            <span className="ml-2 text-muted-foreground">{replyTo.content || '[attachment]'}</span>
          </div>
          <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2 p-3">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, true); e.target.value = ''; }}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, false); e.target.value = ''; }}
        />

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto scrollbar-thin p-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => imageInputRef.current?.click()}>
          <ImageIcon className="h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="h-5 w-5" />
        </Button>

        <Textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); handleTyping(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          placeholder={placeholder ?? 'Type a message...'}
          className="min-h-9 max-h-32 resize-none scrollbar-thin"
          rows={1}
        />

        <Button type="submit" disabled={loading || !content.trim()} className="h-9 w-9 flex-shrink-0 gradient-primary border-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
