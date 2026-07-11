import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { fail, ok, requireMethod } from '@/lib/api';
import { ATTACHMENT_MAX_BYTES } from '@/lib/constants';
import type { AttachmentType } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_DATA_URL_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

/**
 * Accepts a base64 data URL and returns it for storage. In a production setup
 * with Supabase Storage available, this would upload to a bucket and return a
 * public URL. Here we return the data URL itself so the app is self-contained.
 */
export async function POST(req: NextRequest) {
  const methodError = requireMethod(req, 'POST');
  if (methodError) return methodError;

  const user = await getSessionUser();
  if (!user) return fail(401, 'Unauthorized.');

  let body: { data_url?: string; type?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.');
  }
  if (!body.data_url || !body.type) return fail(400, 'Missing data_url or type.');
  if (body.data_url.length > MAX_DATA_URL_BYTES) return fail(413, 'File too large (max 2MB).');

  const isImage = IMAGE_TYPES.includes(body.type);
  const attachmentType: AttachmentType = isImage ? 'image' : 'file';

  return ok({
    url: body.data_url,
    type: attachmentType,
    name: body.name ?? (isImage ? 'image' : 'file'),
  });
}
