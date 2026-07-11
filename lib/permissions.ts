import type { Role } from './types';

const RANK: Record<Role, number> = { member: 0, moderator: 1, admin: 2, owner: 3 };

export function canDeleteMessage(actor: Role | null, senderId: string, actorId: string): boolean {
  if (!actor) return false;
  if (senderId === actorId) return true;
  return RANK[actor] >= RANK.admin;
}

export function canKick(actor: Role | null, target: Role | null): boolean {
  if (!actor || !target) return false;
  if (RANK[actor] < RANK.admin) return false;
  return RANK[actor] > RANK[target];
}

export function canBan(actor: Role | null, target: Role | null): boolean {
  if (!actor || !target) return false;
  return actor === 'owner' && target !== 'owner';
}

export function canPromote(actor: Role | null, target: Role | null, newRole: Role): boolean {
  if (!actor || !target) return false;
  if (actor !== 'owner') return false;
  if (newRole === 'owner') return false;
  return RANK[newRole] > RANK[target];
}

export function canDemote(actor: Role | null, target: Role | null, newRole: Role): boolean {
  if (!actor || !target) return false;
  if (actor !== 'owner') return false;
  return RANK[newRole] < RANK[target];
}

export function canDeleteRoom(actor: Role | null): boolean {
  return actor === 'owner';
}

export function canTransferOwnership(actor: Role | null): boolean {
  return actor === 'owner';
}
