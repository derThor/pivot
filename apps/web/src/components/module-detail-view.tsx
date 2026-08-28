"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Blocks, ChevronRight, Globe } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { WEBSITE_STATUS_BADGE } from "@/lib/website-status";
import type {
  MandantListItem,
  ModuleCatalogEntry,
  ModuleSettingsEntry,
} from "@/lib/api-server";

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
 * Mockup, aber ohne die bewusst nicht gebauten Elemente:
 * Versions-/Update-/Entfernen-Mechanik ist rein informativ, es gibt keinen
 * "Freigaben"-Tab hier (Mandanten-spezifisches passiert auf der jeweiligen
 * Mandant-Detailseite). Masters EIGENE Freischaltung (Nutzervorgabe: "das
 * soll direkt in dem Modul unter Module und Datenschutz eingestellt
 * werden und nicht in Einstellung Module") sitzt direkt hier, nicht unter
 * Einstellungen. `settings` ist `null` auf einer Client-Installation
 * (`MasterOnlyGuard`) – dann werden keine Schalter angezeigt. */
export function ModuleDetailView({
  module,
  activeMandanten,
  appVersion,
  settings,
}: {
  module: ModuleCatalogEntry;
  activeMandanten: MandantListItem[];
  appVersion: string | null;
  settings: ModuleSettingsEntry | null;
}) {
  const router = useRouter();
  const permissions = MODULE_PERMISSIONS[module.key] ?? [];
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function patchModule(body: Record<string, boolean>) {
    setPendingKey("module");
    try {
      const res = await fetch(`/api/module-settings/${module.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toastEdited(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      router.refresh();
    } finally {
      setPendingKey(null);
    }
  }

  async function patchFeature(featureKey: string, enabled: boolean) {
    setPendingKey(featureKey);
    try {
      const res = await fetch(
        `/api/module-settings/${module.key}/features/${featureKey}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toastEdited(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      router.refresh();
    } finally {
      setPendingKey(null);
    }
  }

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
          {settings && (
            <Switch
              checked={settings.enabled}
              disabled={pendingKey === "module"}
              onCheckedChange={(checked) => patchModule({ enabled: checked })}
            />
          )}
        </CardContent>
      </Card>

      {settings &&
        settings.enabled &&
        module.features &&
        module.features.length > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Freischaltung für diese Installation</CardTitle>
            <p className="text-sm text-muted-foreground">
              Gilt für Master selbst – unabhängig von der Buchung einzelner
              Mandanten.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {module.features.map((feature) => (
              <div
                key={feature.key}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3"
              >
                <p className="text-sm font-medium">{feature.label}</p>
                <Switch
                  checked={settings.enabledFeatures.includes(feature.key)}
                  disabled={pendingKey === feature.key}
                  onCheckedChange={(checked) =>
                    patchFeature(feature.key, checked)
                  }
                />
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3">
              <div>
                <p className="text-sm font-medium">
                  Bei neuen Mandanten vorinstallieren
                </p>
                <p className="text-xs text-muted-foreground">
                  Wird beim Anlegen eines neuen Mandanten automatisch
                  gebucht.
                </p>
              </div>
              <Switch
                checked={settings.autoInstallForNewMandants}
                disabled={pendingKey === "module"}
                onCheckedChange={(checked) =>
                  patchModule({ autoInstallForNewMandants: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

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
              <CardTitle className="text-base">Auf Websites aktiv</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {activeMandanten.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground">
                  Von keinem Mandanten gebucht.
                </p>
              ) : (
                activeMandanten.flatMap((mandant) =>
                  mandant.websites.map((website) => {
                    const badge = WEBSITE_STATUS_BADGE[website.status];
                    return (
                      <div
                        key={website.id}
                        className="flex items-center justify-between gap-3 px-6 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Globe className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm">
                            {website.domain}
                          </span>
                        </div>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </div>
                    );
                  }),
                )
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
