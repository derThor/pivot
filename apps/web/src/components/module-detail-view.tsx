import Link from "next/link";
import { ChevronRight, Diamond, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { ModuleAutoInstallToggle } from "@/components/module-auto-install-toggle";
import type { MandantListItem, ModuleCatalogEntry } from "@/lib/api-server";
import { actionLabels, resourceLabels } from "@/lib/permission-labels";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<ModuleCatalogEntry["category"], string> = {
  integration: "Schnittstelle",
  compliance: "Compliance",
};

// Gleiche Zuordnung wie dashboard/modules/page.tsx (Kachel-Icons) – kein
// gemeinsamer Katalog dafür, da nur diese zwei Stellen ein Icon pro Modul
// brauchen.
const MODULE_ICONS: Record<string, typeof Diamond> = {
  magicline: Diamond,
  datenschutz: ShieldCheck,
};

// Rein informativ (Nutzervorgabe, 2026-08-28: "Zusätzliche Rechte" auf der
// Modul-Übersicht) – welche Berechtigungen ein Modul inhaltlich mitbringt.
// Fester, kleiner Katalog statt Ableitung aus permissions.catalog.ts, da
// nicht jede Ressource dort einem Modul zugeordnet ist.
const MODULE_PERMISSIONS: Record<string, string[]> = {
  datenschutz: [
    "privacy:read",
    "privacy:create",
    "privacy:update",
    "privacy:delete",
  ],
};

// Ausführlichere Zusammenfassung für "Was das Modul mitbringt"
// (Nutzervorgabe, 2026-08-29) – ergänzt die knappe Katalog-Beschreibung
// (`module.description`, die z.B. auf der Kachel steht) um mehrere
// Absätze, die auch ohne Vorwissen erklären, was das Modul konkret
// leistet. Array statt einem langen String (Nutzervorgabe: "mit Absatz"
// – ein einzelner Fließtext-Block wirkte erdrückend), fällt auf
// `[module.description]` zurück, solange ein Modul (z.B. Magicline)
// noch keinen eigenen Text hat.
const MODULE_SUMMARY: Record<string, string[]> = {
  datenschutz: [
    "Bündelt alle datenschutzrelevanten Aufgaben rund um die Website in einem eigenen Arbeitsbereich, statt sie über mehrere Menüs zu verteilen.",
    "Rechtstexte wie Impressum und Datenschutzerklärung werden zentral gepflegt und automatisch verlinkt, Betroffenenanfragen (Auskunft, Löschung) durchlaufen einen nachvollziehbaren Bearbeitungsprozess mit Fristen, das Verzeichnis von Verarbeitungstätigkeiten und die Auftragsverarbeiter-Übersicht erfüllen die Dokumentationspflicht nach Art. 30 DSGVO, und Datenschutzvorfälle lassen sich erfassen und bis zur Meldung nachverfolgen.",
    "Jeder dieser Bereiche entspricht einem eigenen Reiter und lässt sich einzeln freischalten oder deaktivieren – ein Mandant sieht dadurch immer nur die Funktionen, die für ihn aktiviert sind, alle anderen Reiter bleiben sowohl in der Navigation als auch serverseitig unsichtbar.",
  ],
};

/** Administration → Module → [key] (Nutzervorgabe, 2026-08-28, nach
 * Mockup, aber ohne die drei bewusst nicht gebauten Elemente:
 * Versions-/Update-/Entfernen-Mechanik ist rein informativ, es gibt keinen
 * "Freigaben"-Tab hier (Mandanten-spezifisches passiert auf der jeweiligen
 * Mandant-Detailseite) und keine "Grundeinstellungen" (Masters eigene
 * Freischaltung liegt unter Einstellungen → Module, siehe
 * `module-settings-card.tsx` – Nutzervorgabe: "das soll unter
 * Einstellungen sein"). Ansonsten rein lesende Seite – EINZIGE Ausnahme
 * ist `ModuleAutoInstallToggle` (Korrektur 2026-08-29: steuert das
 * Verhalten des Moduls gegenüber neuen Mandanten, nicht Masters eigene
 * Nutzung, gehört deshalb hierher statt zu Masters eigener
 * Freischaltung – siehe Kommentar in `module-settings-card.tsx`). */
export function ModuleDetailView({
  module,
  mandanten,
  appVersion,
  autoInstallForNewMandants,
}: {
  module: ModuleCatalogEntry;
  mandanten: MandantListItem[];
  appVersion: string | null;
  autoInstallForNewMandants: boolean;
}) {
  const permissions = MODULE_PERMISSIONS[module.key] ?? [];
  const summary = MODULE_SUMMARY[module.key] ?? [module.description];
  // Nutzervorgabe, 2026-08-29: "es sollen da nur Mandanten angezeigt
  // werden, die das Modul auf Mandantenebene hinzugefügt haben" – NICHT
  // alle Mandanten, nur die mit einer `MandantModule`-Buchung für dieses
  // Modul. Zwei Zustände (kein "offen"/dritter Zustand mehr): Schieberegler
  // grün (`enabled: true`) → "freigeschaltet", Schieberegler aus
  // (`enabled: false`, aber trotzdem hinzugefügt) → "nicht freigegeben".
  // Klick öffnet das Bearbeiten-Popup der (ersten/Haupt-)Website dieses
  // Mandanten auf `/dashboard/websites` (`?edit=<id>`, siehe
  // websites-view.tsx) – fällt auf die Mandant-Detailseite zurück, falls
  // (z.B. nach Website-Löschung) aktuell keine Website vorhanden ist.
  const mandantRows = mandanten
    .map((mandant) => {
      const booking = mandant.modules.find((m) => m.moduleKey === module.key);
      if (!booking) return null;
      const website = mandant.websites[0] ?? null;
      return {
        mandant,
        label: website?.name ?? mandant.name,
        href: website
          ? `/dashboard/websites?edit=${website.id}`
          : `/dashboard/mandanten/${mandant.id}`,
        status: booking.enabled
          ? ("freigeschaltet" as const)
          : ("nicht_freigegeben" as const),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const STATUS_BADGE: Record<
    "freigeschaltet" | "nicht_freigegeben",
    { label: string; className: string }
  > = {
    freigeschaltet: {
      label: "freigeschaltet",
      className: "badge--green border-0",
    },
    nicht_freigegeben: {
      label: "nicht freigegeben",
      className: "badge--slate border-0",
    },
  };

  const Icon = MODULE_ICONS[module.key] ?? Diamond;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {module.label}
          </h1>
          <DashboardBreadcrumbs overrideLast={module.label} />
        </div>
      </div>

      <Card
        className={cn(
          "relative overflow-hidden border-none text-dark-surface-foreground shadow-sm",
          module.key === "datenschutz"
            ? "modul-kachel--datenschutz modul-kachel--wide"
            : "rounded-xl bg-dark-surface",
        )}
      >
        <CardContent className="relative flex flex-wrap items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{module.label}</p>
              <Badge className="border-0 bg-white/10 text-inherit">
                {CATEGORY_LABEL[module.category]}
              </Badge>
            </div>
            <p className="text-sm text-dark-surface-foreground/70">
              {module.description}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Was das Modul mitbringt</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                {summary.map((paragraph, index) => (
                  <p
                    key={index}
                    className={cn(
                      "text-sm",
                      index === 0
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="flex flex-col gap-5">
                {module.features && module.features.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Reiter
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {module.features.map((feature) => (
                        <Badge
                          key={feature.key}
                          className="badge--green border-0"
                        >
                          {feature.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {permissions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Zusätzliche Rechte
                    </p>
                    <ul className="flex flex-col gap-1">
                      {permissions.map((key) => {
                        const [resource, action] = key.split(":");
                        return (
                          <li key={key} className="text-sm">
                            {resourceLabels[resource] ?? resource}
                            {" · "}
                            {actionLabels[action] ?? action}
                          </li>
                        );
                      })}
                    </ul>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit border-button-border"
                      render={<Link href="/dashboard/roles" />}
                    >
                      In Rollen & Rechte öffnen
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            type="button"
            variant="outline"
            className="w-fit border-button-border"
            render={<Link href="/dashboard/mandanten" />}
          >
            Zu den Mandanten
            <ChevronRight />
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Bei Mandanten
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {mandantRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Von keinem Mandanten hinzugefügt.
                </p>
              ) : (
                mandantRows.map(({ mandant, label, href, status }) => (
                  <Link
                    key={mandant.id}
                    href={href}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3 transition-colors hover:bg-muted/70"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {label}
                    </span>
                    <Badge className={STATUS_BADGE[status].className}>
                      {STATUS_BADGE[status].label}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="gap-3 rounded-xl shadow-sm">
            <CardHeader>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Modul
              </p>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border px-6 py-0 text-sm">
              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground">Version</span>
                <span>{appVersion ?? "–"}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground">Kategorie</span>
                <span>{CATEGORY_LABEL[module.category]}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground">Datenquelle</span>
                <span>Lokal</span>
              </div>
            </CardContent>
          </Card>

          <ModuleAutoInstallToggle
            moduleKey={module.key}
            autoInstallForNewMandants={autoInstallForNewMandants}
          />
        </div>
      </div>
    </div>
  );
}
