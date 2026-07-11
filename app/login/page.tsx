'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Welcome back!');
      router.replace('/home');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Hero panel */}
      <div className="relative hidden flex-1 overflow-hidden lg:flex">
        <div className="absolute inset-0 gradient-primary" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, hsl(173 80% 40%) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(199 89% 60%) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <MessageCircle className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Pulse</span>
          </div>
          <h1 className="max-w-md text-5xl font-bold leading-tight tracking-tight">
            Where conversations come alive.
          </h1>
          <p className="mt-6 max-w-md text-lg text-white/80">
            Create rooms, invite friends, and chat in real time. Group chats,
            private messages, and smart notifications — all in one place.
          </p>
          <div className="mt-12 flex gap-8">
            <div>
              <div className="text-3xl font-bold">Real-time</div>
              <div className="text-sm text-white/70">Instant delivery</div>
            </div>
            <div>
              <div className="text-3xl font-bold">Private</div>
              <div className="text-sm text-white/70">Your data, secured</div>
            </div>
            <div>
              <div className="text-3xl font-bold">Rooms</div>
              <div className="text-sm text-white/70">Unlimited spaces</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-white">
              <MessageCircle className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">Pulse</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-muted-foreground">Sign in to continue to Pulse.</p>

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
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full text-base">
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
