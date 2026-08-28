import Link from "next/link";
import { Diamond, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PageContent } from "@/components/page-content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMandanten, getMandantModuleCatalog } from "@/lib/api-server";
import type { ModuleCatalogEntry } from "@/lib/api-server";

const MODULE_ICONS: Record<string, typeof Diamond> = {
  magicline: Diamond,
  datenschutz: ShieldCheck,
};

const CATEGORY_LABEL: Record<ModuleCatalogEntry["category"], string> = {
  integration: "Schnittstelle",
  compliance: "Compliance",
};

/** Übersicht "Administration → Module" (Nutzervorgabe, 2026-08-27: fester,
 * von uns entwickelter Katalog – "Module können nicht über neu Button
 * angelegt werden"). Rein lesend: Buchung/Freigabe pro Mandant passiert
 * auf der jeweiligen Mandant-Detailseite (siehe mandant-detail-view.tsx),
 * hier nur der Katalog + wie viele Mandanten ein Modul gebucht haben. */
export default async function ModulesPage() {
  const [catalog, mandanten] = await Promise.all([
    getMandantModuleCatalog(),
    // Erste Seite reicht für die Zählung bei der aktuellen/realistischen
    // Mandantenzahl – bei Bedarf später auf eine echte Aggregation im
    // Backend umstellen.
    getMandanten({ page: 1, pageSize: 100 }),
  ]);

  const bookingsByModule = new Map<string, string[]>();
  for (const mandant of mandanten?.items ?? []) {
    for (const entry of mandant.modules) {
      const names = bookingsByModule.get(entry.moduleKey) ?? [];
      names.push(mandant.name);
      bookingsByModule.set(entry.moduleKey, names);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Module" />
      <PageContent plain>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(catalog ?? []).map((module) => {
            const Icon = MODULE_ICONS[module.key] ?? Diamond;
            const bookedBy = bookingsByModule.get(module.key) ?? [];
            return (
              <Link key={module.key} href={`/dashboard/modules/${module.key}`}>
                <Card className="rounded-xl shadow-sm transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4.5" />
                      </span>
                      <div>
                        <CardTitle className="text-base">
                          {module.label}
                        </CardTitle>
                        <Badge className="badge--slate mt-1 border-0">
                          {CATEGORY_LABEL[module.category]}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      {module.description}
                    </p>
                    <p className="text-sm">
                      {bookedBy.length === 0
                        ? "Von keinem Mandanten gebucht."
                        : `Gebucht von ${bookedBy.length} ${bookedBy.length === 1 ? "Mandant" : "Mandanten"}: ${bookedBy.join(", ")}`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Neue Module werden von uns entwickelt und zur Verfügung gestellt –
          Buchung pro Mandant erfolgt auf der jeweiligen{" "}
          <Link
            href="/dashboard/mandanten"
            className="text-primary underline underline-offset-2"
          >
            Mandant-Detailseite
          </Link>
          .
        </p>
      </PageContent>
    </div>
  );
}
