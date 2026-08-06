// Fester Rechte-Katalog. Muss synchron gehalten werden mit
// packages/database/prisma/seed.ts (bewusst dupliziert statt über
// Package-Grenzen hinweg geteilt, siehe knowledge-base/auth/rbac-rework.md).
export interface PermissionDescriptor {
  resource: string;
  action: string;
}

export const PERMISSIONS_CATALOG: PermissionDescriptor[] = [
  { resource: 'content', action: 'read' },
  { resource: 'content', action: 'create' },
  { resource: 'content', action: 'update' },
  { resource: 'content', action: 'delete' },
  { resource: 'media', action: 'read' },
  { resource: 'media', action: 'create' },
  { resource: 'media', action: 'update' },
  { resource: 'media', action: 'delete' },
  { resource: 'categories', action: 'read' },
  { resource: 'categories', action: 'create' },
  { resource: 'categories', action: 'update' },
  { resource: 'categories', action: 'delete' },
  { resource: 'tags', action: 'read' },
  { resource: 'tags', action: 'create' },
  { resource: 'tags', action: 'update' },
  { resource: 'tags', action: 'delete' },
  { resource: 'users', action: 'manage' },
  { resource: 'roles', action: 'manage' },
  { resource: 'settings', action: 'manage' },
];
