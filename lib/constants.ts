export const SESSION_COOKIE = 'rc_session';
export const SESSION_TTL_DAYS = 30;
export const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;

export const ROOM_NAME_MIN = 2;
export const ROOM_NAME_MAX = 50;
export const ROOM_DESC_MAX = 200;

export const MESSAGE_MAX = 4000;
export const BIO_MAX = 300;

export const ROOM_CODE_LENGTH = 8;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const REALTIME = {
  room: (roomId: string) => `room:${roomId}`,
  private: (chatId: string) => `private:${chatId}`,
  user: (userId: string) => `user:${userId}`,
} as const;

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export const EMOJIS = [
  '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗',
  '🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪',
  '😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🫠','🫡','🤑',
  '🥳','🥸','🥺','😣','😖','😫','🥹','😭','😤','😠','😡','🤬','😈','👿','💀','☠️',
  '💩','🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖',
  '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋',
  '🎉','🎊','🎈','🎂','🎁','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🎾','🏐','🏉',
  '🔥','⭐','✨','💫','💥','💯','✅','❌','⚠️','🔔','📢','💬','💭','📌','📎','🔗',
] as const;
