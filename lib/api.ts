import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function requireMethod(req: Request, ...methods: string[]) {
  const m = req.method.toUpperCase();
  return methods.includes(m) ? null : fail(405, 'Method not allowed');
}

export function getClientMeta(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || undefined;
  const userAgent = req.headers.get('user-agent') || undefined;
  return { ip, userAgent };
}

export function generateRoomCode(): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    out += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return out;
}

export function isApiError(e: unknown): e is { error: string } {
  return typeof e === 'object' && e !== null && 'error' in e;
}
