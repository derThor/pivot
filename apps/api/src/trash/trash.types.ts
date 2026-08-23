// Sieben echte, papierkorb-fähige Typen ("Bausteine"/ModuleType sind
// Vorlagen, keine löschbaren Instanzen, daher nicht dabei). Die Werte
// decken sich bewusst mit den Permission-Ressourcen im Katalog
// (`${type}:read`/`${type}:delete`), Galerien/FAQs teilen sich technisch
// `GlobalModule`, siehe global-modules.service.ts `resolveResource()`.
// "forms" kam 2026-08-23 mit dem Formulare-Feature dazu (eigenes
// Datenmodell, kein GlobalModule).
export const TRASH_TYPES = [
  'content',
  'media',
  'categories',
  'tags',
  'gallery',
  'faq',
  'forms',
] as const;

export type TrashType = (typeof TRASH_TYPES)[number];
