// Mandantenfähigkeit (Nutzervorgabe, 2026-08-27): "Module können nicht
// über neu Button angelegt werden, sondern werden von uns entwickelt und
// zur Verfügung gestellt" – fester, codeseitiger Katalog statt einer
// DB-Tabelle, analog zu `roles/permissions.catalog.ts`. Ein Mandant kann
// Einträge aus dieser Liste buchen (siehe `MandantModule` in
// schema.prisma – gilt für alle seine Websites gleichermaßen), aber
// niemand kann über die UI neue Einträge erzeugen.
export interface ModuleCatalogEntry {
  key: string;
  label: string;
  description: string;
  category: 'compliance' | 'integration';
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    key: 'datenschutz',
    label: 'Datenschutz',
    description:
      'DSGVO-Verwaltung: Rechtstexte, Löschanfragen, Verarbeitungsverzeichnis, Auftragsverarbeiter, Datenschutzvorfälle.',
    category: 'compliance',
  },
  {
    key: 'magicline',
    label: 'Magicline',
    description:
      'Anbindung an die Magicline-Fitnessstudio-Software (Stammdaten, Verträge, Vertragsabschluss/Leads).',
    category: 'integration',
  },
];

export const MODULE_KEYS = MODULE_CATALOG.map((entry) => entry.key);

export function isValidModuleKey(key: string): boolean {
  return MODULE_KEYS.includes(key);
}
