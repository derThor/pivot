// Sechs echte, papierkorb-fähige Typen (siehe Plan: "Formulare" gibt es
// nicht, "Bausteine"/ModuleType sind Vorlagen, keine löschbaren Instanzen).
// Die Werte decken sich bewusst mit den Permission-Ressourcen im Katalog
// (`${type}:read`/`${type}:delete`), Galerien/FAQs teilen sich technisch
// `GlobalModule`, siehe global-modules.service.ts `resolveResource()`.
export const TRASH_TYPES = [
  'content',
  'media',
  'categories',
  'tags',
  'gallery',
  'faq',
] as const;

export type TrashType = (typeof TRASH_TYPES)[number];
