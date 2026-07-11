'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      await register(username, password, displayName || undefined);
      toast.success('Account created. Welcome to Pulse!');
      router.replace('/home');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-white">
              <MessageCircle className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">Pulse</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight">Create your account</h2>
          <p className="mt-2 text-muted-foreground">Join the conversation in seconds.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                autoComplete="username"
                required
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, underscores. 3–20 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">Display name (optional)</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others see you"
                maxLength={30}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
                className="h-11"
              />
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full text-base">
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Hero panel */}
      <div className="relative hidden flex-1 overflow-hidden lg:flex">
        <div className="absolute inset-0 gradient-primary" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 80%, hsl(173 80% 40%) 0%, transparent 50%), radial-gradient(circle at 20% 20%, hsl(199 89% 60%) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <MessageCircle className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Pulse</span>
          </div>
          <h1 className="max-w-md text-5xl font-bold leading-tight tracking-tight">
            Start chatting with your people.
          </h1>
          <p className="mt-6 max-w-md text-lg text-white/80">
            Create rooms for your team, your friends, or your community.
            Share messages, images, and files in real time.
          </p>
          <ul className="mt-12 space-y-4 text-white/90">
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm">✓</span>
              Create and join unlimited rooms
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm">✓</span>
              Private one-on-one conversations
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm">✓</span>
              Roles, moderation, and member management
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
