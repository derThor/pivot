import Link from "next/link";
import { Blocks, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
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
  // Nutzervorgabe, 2026-08-28: "Bei Mandanten" statt "Auf Websites aktiv"
  // – ALLE Mandanten (nicht nur die mit gebuchtem Modul), damit auch
  // sichtbar ist, wer es noch nicht hat. Klick öffnet direkt das
  // Bearbeiten-Popup der (ersten/Haupt-)Website dieses Mandanten auf
  // `/dashboard/websites` (`?edit=<id>`, siehe websites-view.tsx).
  const mandantRows = mandanten
    .map((mandant) => {
      const website = mandant.websites[0];
      if (!website) return null;
      const booking = mandant.modules.find((m) => m.moduleKey === module.key);
      const isSetUp = !!booking?.enabled;
      return { mandant, website, isSetUp };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PageHeader title={module.label} />
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
              <CardTitle className="text-base">Bei Mandanten</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {mandantRows.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground">
                  Noch keine Mandanten angelegt.
                </p>
              ) : (
                mandantRows.map(({ mandant, website, isSetUp }) => (
                  <Link
                    key={mandant.id}
                    href={`/dashboard/websites?edit=${website.id}`}
                    className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0 truncate text-sm">
                      {website.name}
                    </span>
                    <Badge
                      className={
                        isSetUp
                          ? "badge--green border-0"
                          : "badge--slate border-0"
                      }
                    >
                      {isSetUp ? "eingerichtet" : "nicht freigegeben"}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Modul</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Version</span>
                <span>{appVersion ?? "–"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Kategorie</span>
                <span>{CATEGORY_LABEL[module.category]}</span>
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
