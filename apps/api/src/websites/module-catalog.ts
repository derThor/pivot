// Mandantenfähigkeit (Nutzervorgabe, 2026-08-27): "Module können nicht
// über neu Button angelegt werden, sondern werden von uns entwickelt und
// zur Verfügung gestellt" – fester, codeseitiger Katalog statt einer
// DB-Tabelle, analog zu `roles/permissions.catalog.ts`. Ein Mandant kann
// Einträge aus dieser Liste buchen (siehe `MandantModule` in
// schema.prisma – gilt für alle seine Websites gleichermaßen), aber
// niemand kann über die UI neue Einträge erzeugen.
// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): manche Module
// gliedern sich in einzeln (de)aktivierbare Unter-Features – bei
// Datenschutz sind das exakt die 7 Reiter von `/dashboard/privacy`
// (Keys 1:1 aus `apps/web/src/components/privacy-view.tsx`s `TabId`-Union
// übernommen, damit Katalog und Frontend nie auseinanderlaufen).
export interface ModuleFeatureEntry {
  key: string;
  label: string;
}

export interface ModuleCatalogEntry {
  key: string;
  label: string;
  description: string;
  category: 'compliance' | 'integration';
  features?: ModuleFeatureEntry[];
  // Nutzervorgabe, 2026-08-31: "In Master Einstellungen - Module kommen
  // nur Module, die auch vom Master selber benutzt werden" – NICHT der
  // ganze Katalog. Betrifft nur die Anzeige unter Einstellungen → Module
  // (settings-form.tsx filtert danach); Administration → Module
  // (/dashboard/modules) zeigt weiterhin den kompletten Katalog, da dort
  // alle für Mandanten buchbaren Module verwaltet werden. Bei jedem
  // neuen Katalog-Eintrag muss das VORHER mit dem Nutzer geklärt werden,
  // nicht automatisch annehmen.
  usedByMasterItself: boolean;
}

export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    key: 'datenschutz',
    label: 'Datenschutz',
    description:
      'DSGVO-Verwaltung: Rechtstexte, Löschanfragen, Verarbeitungsverzeichnis, Auftragsverarbeiter, Datenschutzvorfälle.',
    category: 'compliance',
    features: [
      { key: 'rechtstexte', label: 'Rechtstexte' },
      { key: 'loeschanfragen', label: 'Anfragen' },
      { key: 'verarbeitungen', label: 'Verarbeitungen' },
      { key: 'auftragsverarbeiter', label: 'Auftragsverarbeiter' },
      { key: 'vorfaelle', label: 'Vorfälle' },
      { key: 'dsb', label: 'Datenschutzbeauftragter' },
      { key: 'nutzer', label: 'Benutzer' },
    ],
    // Master betreibt selbst /dashboard/privacy und nutzt diese Reiter
    // für die eigene Installation.
    usedByMasterItself: true,
  },
  {
    key: 'magicline',
    label: 'Magicline',
    description:
      'Anbindung an die Magicline-Fitnessstudio-Software (Stammdaten, Verträge, Vertragsabschluss/Leads).',
    category: 'integration',
    // Reine Mandanten-Integration (Fitnessstudio-Software) – Master
    // betreibt selbst kein Fitnessstudio, braucht also keine eigene
    // Freischaltung dafür.
    usedByMasterItself: false,
  },
];

export const MODULE_KEYS = MODULE_CATALOG.map((entry) => entry.key);

export function isValidModuleKey(key: string): boolean {
  return MODULE_KEYS.includes(key);
}

export function getModuleCatalogEntry(
  key: string,
): ModuleCatalogEntry | undefined {
  return MODULE_CATALOG.find((entry) => entry.key === key);
}

export function getAllFeatureKeys(moduleKey: string): string[] {
  return getModuleCatalogEntry(moduleKey)?.features?.map((f) => f.key) ?? [];
}

export function isValidFeatureKey(
  moduleKey: string,
  featureKey: string,
): boolean {
  return getAllFeatureKeys(moduleKey).includes(featureKey);
}
