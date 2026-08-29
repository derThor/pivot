"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Blocks } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { ModuleSettingsEntry } from "@/lib/api-server";

const CATEGORY_LABEL: Record<ModuleSettingsEntry["category"], string> = {
  integration: "Schnittstelle",
  compliance: "Compliance",
};

/** Einstellungen → Module (Nutzervorgabe, 2026-08-28: "das soll unter
 * Einstellungen sein") – NUR Masters EIGENE Modul-/Feature-Freischaltung
 * für die eigene Installation, komplett getrennt vom Mandanten-
 * Buchungssystem ("Master wird nicht über Mandanten geregelt").
 * "Bei neuen Mandanten vorinstallieren" gehört NICHT hierher, auch wenn
 * es ebenfalls master-only ist – es steuert das Verhalten des Moduls
 * gegenüber Mandanten, nicht Masters eigene Nutzung, und lebt deshalb auf
 * `/dashboard/modules/[key]` (siehe `module-auto-install-toggle.tsx`,
 * Korrektur 2026-08-29 – ursprünglich fälschlich hier eingebaut). Diese
 * Seite ist ansonsten nur sichtbar/erreichbar auf einer Master-
 * Installation (Backend gated zusätzlich hart über `MasterOnlyGuard`). */
export function ModuleSettingsCard({
  modules,
}: {
  modules: ModuleSettingsEntry[];
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function patchModule(
    moduleKey: string,
    body: Record<string, boolean>,
  ) {
    setPendingKey(moduleKey);
    try {
      const res = await fetch(`/api/module-settings/${moduleKey}`, {
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

  async function patchFeature(
    moduleKey: string,
    featureKey: string,
    enabled: boolean,
  ) {
    setPendingKey(`${moduleKey}:${featureKey}`);
    try {
      const res = await fetch(
        `/api/module-settings/${moduleKey}/features/${featureKey}`,
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
    <div className="flex flex-col gap-4">
      {modules.map((module) => (
        <Card key={module.moduleKey} className="rounded-xl shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Blocks className="size-4.5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      {module.label}
                    </CardTitle>
                    <Badge className="badge--slate border-0">
                      {CATEGORY_LABEL[module.category]}
                    </Badge>
                  </div>
                </div>
              </div>
              <Switch
                checked={module.enabled}
                disabled={pendingKey === module.moduleKey}
                onCheckedChange={(checked) =>
                  patchModule(module.moduleKey, { enabled: checked })
                }
              />
            </div>
          </CardHeader>
          {module.enabled && module.features.length > 0 && (
            <CardContent className="flex flex-col gap-2">
              {module.features.map((feature) => (
                <div
                  key={feature.key}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3"
                >
                  <p className="text-sm font-medium">{feature.label}</p>
                  <Switch
                    checked={module.enabledFeatures.includes(feature.key)}
                    disabled={pendingKey === `${module.moduleKey}:${feature.key}`}
                    onCheckedChange={(checked) =>
                      patchFeature(module.moduleKey, feature.key, checked)
                    }
                  />
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
