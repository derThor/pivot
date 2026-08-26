import {
  Building2,
  ClipboardList,
  Compass,
  FileText,
  FolderTree,
  HelpCircle,
  Image as ImageIcon,
  Images,
  Inbox,
  Layers,
  Link2,
  Lock,
  ShieldCheck,
  Settings,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { PermissionDescriptor } from "@/lib/api-server";

// Zentrale Anzeige-Texte für den Rechte-Katalog – von `role-form-dialog.tsx`
// (Anlegen) und `roles-explorer.tsx` (Detail-Panel) gemeinsam genutzt, damit
// beide Stellen nicht auseinanderlaufen, sobald der Katalog wächst.
export const resourceLabels: Record<string, string> = {
  content: "Seiten",
  media: "Medien",
  categories: "Kategorien",
  tags: "Tags",
  navigation: "Menüs",
  "module-types": "Bausteine",
  gallery: "Galerien",
  faq: "FAQs",
  forms: "Formulare",
  "form-submissions": "Formular-Einsendungen",
  "preview-links": "Vorschau-Links",
  users: "Benutzer",
  roles: "Rollen & Rechte",
  settings: "Einstellungen",
  company: "Firma",
  privacy: "Datenschutz",
};

export const resourceIcons: Record<string, LucideIcon> = {
  content: FileText,
  media: ImageIcon,
  categories: FolderTree,
  tags: Tags,
  navigation: Compass,
  "module-types": Layers,
  gallery: Images,
  faq: HelpCircle,
  forms: ClipboardList,
  "form-submissions": Inbox,
  "preview-links": Link2,
  users: Users,
  roles: ShieldCheck,
  settings: Settings,
  company: Building2,
  privacy: Lock,
};

export const actionLabels: Record<string, string> = {
  read: "Lesen",
  create: "Erstellen",
  update: "Bearbeiten",
  delete: "Löschen",
  invite: "Anlegen",
  deactivate: "Deaktivieren",
  publish: "Veröffentlichen",
  schedule: "Planen",
  reorder: "Sortieren",
  revoke: "Widerrufen",
};

export const categoryLabels: Record<PermissionDescriptor["category"], string> =
  {
    core: "Kern",
    extensions: "Erweiterungen",
    administration: "Verwaltung",
    system: "System",
  };

// Abschnitts-Überschriften über den Rechte-Karten-Gruppen im Detail-Panel –
// bewusst eigene Labels statt `categoryLabels` (1:1 nach Bildvorlage: "Kern"
// wird dort zu "Kern-Module", die anderen beiden bleiben gleich).
export const categorySectionLabels: Record<
  PermissionDescriptor["category"],
  string
> = {
  core: "Kern-Module",
  extensions: "Erweiterungen",
  administration: "Verwaltung",
  system: "System",
};

// Reihenfolge der Kategorie-Tabs (fix, nicht von der Katalog-Reihenfolge
// abhängig). `system` (nur `settings`, Nutzervorgabe 2026-08-21) ganz
// hinten – die exklusivste Gruppe, analog zur Pivot-Rolle als höchste Stufe.
export const categoryOrder: PermissionDescriptor["category"][] = [
  "core",
  "extensions",
  "administration",
  "system",
];

export function groupByResource(
  catalog: PermissionDescriptor[],
): [string, PermissionDescriptor[]][] {
  const groups = new Map<string, PermissionDescriptor[]>();
  for (const permission of catalog) {
    const list = groups.get(permission.resource) ?? [];
    list.push(permission);
    groups.set(permission.resource, list);
  }
  return Array.from(groups.entries());
}
