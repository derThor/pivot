// Fester Rechte-Katalog. Muss synchron gehalten werden mit
// packages/database/prisma/seed.ts (bewusst dupliziert statt über
// Package-Grenzen hinweg geteilt, siehe knowledge-base/auth/rbac-rework.md).
export interface PermissionDescriptor {
  resource: string;
  action: string;
}

// Kategorisierung für die Rollen-&-Rechte-UI (Kern-Module/Erweiterungen/
// Verwaltung) – rein für die Frontend-Gruppierung, hat keine Auswirkung auf
// die Rechte-Prüfung selbst.
export type PermissionCategory = 'core' | 'extensions' | 'administration';

export const PERMISSIONS_CATALOG: PermissionDescriptor[] = [
  // Kern-Module
  { resource: 'content', action: 'read' },
  { resource: 'content', action: 'create' },
  { resource: 'content', action: 'update' },
  { resource: 'content', action: 'delete' },
  { resource: 'content', action: 'publish' },
  { resource: 'content', action: 'schedule' },
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
  { resource: 'navigation', action: 'read' },
  { resource: 'navigation', action: 'update' },
  { resource: 'navigation', action: 'reorder' },
  // Bausteine (Modul-Typen) sind laut `ModuleTypesController` bewusst nur
  // per Seed gepflegt (kein Anlegen/Bearbeiten/Löschen-Endpoint) – nur
  // "Lesen" existiert als echte Fähigkeit.
  { resource: 'module-types', action: 'read' },

  // Erweiterungen
  { resource: 'gallery', action: 'read' },
  { resource: 'gallery', action: 'create' },
  { resource: 'gallery', action: 'update' },
  { resource: 'gallery', action: 'delete' },
  { resource: 'faq', action: 'read' },
  { resource: 'faq', action: 'create' },
  { resource: 'faq', action: 'update' },
  { resource: 'faq', action: 'delete' },
  { resource: 'preview-links', action: 'read' },
  { resource: 'preview-links', action: 'create' },
  { resource: 'preview-links', action: 'revoke' },
  { resource: 'webhooks', action: 'read' },
  { resource: 'webhooks', action: 'create' },
  { resource: 'webhooks', action: 'update' },
  { resource: 'webhooks', action: 'delete' },

  // Verwaltung
  { resource: 'users', action: 'read' },
  { resource: 'users', action: 'invite' },
  { resource: 'users', action: 'update' },
  { resource: 'users', action: 'deactivate' },
  // Bewusst getrennt von `deactivate` (siehe knowledge-base/auth/
  // rbac-rework.md, Update 2026-08-16): Anonymisierung ist nicht
  // reversibel, braucht daher ein eigenes, restriktiveres Recht.
  { resource: 'users', action: 'delete' },
  { resource: 'users', action: 'impersonate' },
  { resource: 'roles', action: 'read' },
  { resource: 'roles', action: 'create' },
  { resource: 'roles', action: 'update' },
  { resource: 'settings', action: 'read' },
  { resource: 'settings', action: 'update' },
];

export const PERMISSION_CATEGORY_BY_RESOURCE: Record<
  string,
  PermissionCategory
> = {
  content: 'core',
  media: 'core',
  categories: 'core',
  tags: 'core',
  navigation: 'core',
  'module-types': 'core',
  gallery: 'extensions',
  faq: 'extensions',
  'preview-links': 'extensions',
  webhooks: 'extensions',
  users: 'administration',
  roles: 'administration',
  settings: 'administration',
};
