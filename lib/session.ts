import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { supabaseServer } from './supabase';
import { SESSION_COOKIE, SESSION_TTL_MS } from './constants';
import type { SessionUser, User } from './types';

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function toSessionUser(u: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>): SessionUser {
  return { id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url };
}

export async function createUserSession(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {}
): Promise<{ token: string; user: SessionUser }> {
  const supabase = supabaseServer();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error } = await supabase.from('sessions').insert({
    token,
    user_id: userId,
    expires_at: expiresAt,
    ip_address: meta.ip ?? null,
    user_agent: meta.userAgent ?? null,
  });
  if (error) throw new Error(`Failed to create session: ${error.message}`);

  const { data: user, error: ue } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (ue || !user) throw new Error('Failed to load session user');

  return { token, user };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const supabase = supabaseServer();
  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabase.from('sessions').delete().eq('token', token);
    return null;
  }

  const { data: user, error: ue } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .eq('id', session.user_id)
    .maybeSingle();
  if (ue || !user) return null;

  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error('Unauthorized') as Error & { status: 401 };
    err.status = 401;
    throw err;
  }
  return user;
}

export function setSessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function destroySession(): Promise<void> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await supabaseServer().from('sessions').delete().eq('token', token);
  }
}
