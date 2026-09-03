import Link from "next/link";
import { Diamond, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PageContent } from "@/components/page-content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ModuleEnabledToggle } from "@/components/module-enabled-toggle";
import {
  getMandanten,
  getMandantModuleCatalog,
  getModuleSettings,
  getPublicSettings,
} from "@/lib/api-server";
import type { ModuleCatalogEntry } from "@/lib/api-server";
import { cn } from "@/lib/utils";

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
 * auf der jeweiligen Mandant-Detailseite, die eigene Freischaltung des
 * Masters unter Einstellungen → Module (siehe module-settings-card.tsx).
 *
 * Kachel-Design nach Mockup (Nutzervorgabe, 2026-08-29): dunkle Karte
 * (bestehendes `bg-dark-surface`-Token, siehe dashboard/page.tsx) mit
 * großem, transparentem Icon-Wasserzeichen im Hintergrund, das beim
 * Hovern der Kachel vergrößert wird. Explizit KEINE "Gebucht von
 * <Mandant>"-Aufzählung mehr in der Kachel (Nutzervorgabe) – stattdessen
 * die Anzahl der Websites, auf denen das Modul aktuell aktiv
 * freigeschaltet ist.
 *
 * Der Schalter (`ModuleEnabledToggle`) ist ein echter Kill-Switch, kein
 * rein visueller Status mehr (Nutzervorgabe, 2026-08-29: "wenn der
 * deaktiviert wird, wird das Modul überall auf inaktiv gesetzt. wenn
 * aktiviert, dann nur da auf aktiv setzen, die das Modul schon hatten") –
 * die Kaskade auf bestehende `MandantModule`-Buchungen läuft serverseitig
 * in `ModuleSettingsService.update`. */
export default async function ModulesPage() {
  const [catalog, mandanten, moduleSettings, publicSettings] =
    await Promise.all([
      getMandantModuleCatalog(),
      // Erste Seite reicht für die Zählung bei der aktuellen/realistischen
      // Mandantenzahl – bei Bedarf später auf eine echte Aggregation im
      // Backend umstellen.
      getMandanten({ page: 1, pageSize: 100 }),
      getModuleSettings(),
      getPublicSettings(),
    ]);

  const settingsByKey = new Map(
    (moduleSettings ?? []).map((entry) => [entry.moduleKey, entry]),
  );

  const activeWebsitesByModule = new Map<string, number>();
  for (const mandant of mandanten?.items ?? []) {
    for (const entry of mandant.modules) {
      if (!entry.enabled) continue;
      const count = activeWebsitesByModule.get(entry.moduleKey) ?? 0;
      activeWebsitesByModule.set(
        entry.moduleKey,
        count + mandant.websites.length,
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Module" />
      <PageContent plain>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(catalog ?? []).map((module) => {
            const Icon = MODULE_ICONS[module.key] ?? Diamond;
            const enabled = settingsByKey.get(module.key)?.enabled ?? true;
            const websiteCount = activeWebsitesByModule.get(module.key) ?? 0;

            return (
              <Link
                key={module.key}
                href={`/dashboard/modules/${module.key}`}
                className="group"
              >
                <Card
                  className={cn(
                    "relative overflow-hidden border-none text-dark-surface-foreground shadow-sm",
                    module.key === "datenschutz"
                      ? "modul-kachel--datenschutz"
                      : "rounded-xl bg-dark-surface",
                  )}
                >
                  {module.key !== "datenschutz" && (
                    <Icon
                      className="pointer-events-none absolute -right-6 -bottom-6 size-36 text-white/5 transition-transform duration-300 ease-out group-hover:scale-125"
                      strokeWidth={1}
                    />
                  )}
                  <CardContent className="relative flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">
                              {module.label}
                            </p>
                            {publicSettings?.appVersion && (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium">
                                v{publicSettings.appVersion}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-dark-surface-foreground/60">
                            {CATEGORY_LABEL[module.category]} ·{" "}
                            {websiteCount}{" "}
                            {websiteCount === 1 ? "Webseite" : "Webseiten"}
                          </p>
                        </div>
                      </div>
                      <ModuleEnabledToggle
                        moduleKey={module.key}
                        enabled={enabled}
                      />
                    </div>
                    <p className="text-sm text-dark-surface-foreground/70">
                      {module.description}
                    </p>
                    {module.features && module.features.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {module.features.map((feature) => (
                          <Badge
                            key={feature.key}
                            className="border border-primary/40 bg-primary/10 text-primary"
                          >
                            {feature.label}
                          </Badge>
                        ))}
                      </div>
                    )}
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
