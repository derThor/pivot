import Link from "next/link";
import { Blocks, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import type { MandantListItem, ModuleCatalogEntry } from "@/lib/api-server";

const CATEGORY_LABEL: Record<ModuleCatalogEntry["category"], string> = {
  integration: "Schnittstelle",
  compliance: "Compliance",
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

/** Administration → Module → [key] (Nutzervorgabe, 2026-08-28, nach
 * Mockup, aber ohne die drei bewusst nicht gebauten Elemente:
 * Versions-/Update-/Entfernen-Mechanik ist rein informativ, es gibt keinen
 * "Freigaben"-Tab hier (Mandanten-spezifisches passiert auf der jeweiligen
 * Mandant-Detailseite) und keine "Grundeinstellungen" (Masters eigene
 * Freischaltung liegt unter Einstellungen → Module, siehe
 * `module-settings-card.tsx` – Nutzervorgabe: "das soll unter
 * Einstellungen sein"). Rein lesende Seite. */
export function ModuleDetailView({
  module,
  mandanten,
  appVersion,
}: {
  module: ModuleCatalogEntry;
  mandanten: MandantListItem[];
  appVersion: string | null;
}) {
  const permissions = MODULE_PERMISSIONS[module.key] ?? [];
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

      <Card className="rounded-xl shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Blocks className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{module.label}</p>
              <Badge className="badge--slate border-0">
                {CATEGORY_LABEL[module.category]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {module.description}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Was das Modul mitbringt</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {module.features && module.features.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Reiter
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {module.features.map((feature) => (
                    <Badge key={feature.key} className="badge--slate border-0">
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
                  {permissions.map((key) => (
                    <li key={key} className="text-sm">
                      {key}
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit border-border"
                  render={<Link href="/dashboard/roles" />}
                >
                  In Rollen & Rechte öffnen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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

          <Card className="rounded-xl shadow-sm">
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

          <Button
            type="button"
            variant="outline"
            className="border-border"
            render={<Link href="/dashboard/mandanten" />}
          >
            Zu den Mandanten
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
