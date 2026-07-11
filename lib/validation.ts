import {
  BIO_MAX,
  MESSAGE_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  ROOM_DESC_MAX,
  ROOM_NAME_MAX,
  ROOM_NAME_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from './constants';

const usernameRegex = /^[a-zA-Z0-9_]+$/;

export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters.`;
  }
  if (!usernameRegex.test(u)) {
    return 'Username may only contain letters, numbers, and underscores.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`;
  }
  return null;
}

export function validateRoomName(name: string): string | null {
  const n = name.trim();
  if (n.length < ROOM_NAME_MIN || n.length > ROOM_NAME_MAX) {
    return `Room name must be ${ROOM_NAME_MIN}-${ROOM_NAME_MAX} characters.`;
  }
  return null;
}

export function validateRoomDescription(desc: string): string | null {
  if (desc && desc.length > ROOM_DESC_MAX) {
    return `Description must be at most ${ROOM_DESC_MAX} characters.`;
  }
  return null;
}

export function validateMessage(content: string): string | null {
  if (content.length > MESSAGE_MAX) {
    return `Message must be at most ${MESSAGE_MAX} characters.`;
  }
  return null;
}

export function validateBio(bio: string): string | null {
  if (bio && bio.length > BIO_MAX) {
    return `Bio must be at most ${BIO_MAX} characters.`;
  }
  return null;
}

export function sanitize(str: string): string {
  return str.trim();
}
