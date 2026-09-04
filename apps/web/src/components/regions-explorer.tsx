"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutTemplate, Save } from "lucide-react";
import type { GlobalModule, TemplateRegion } from "@pivot/blocks";

import {
  BlockEditorField,
  type ModuleInstance,
} from "@/components/block-editor-field";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { SystemMessage } from "@/components/ui/system-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toastEdited } from "@/components/app-toast";
import type { ModuleType } from "@/lib/api-server";
import { bff } from "@/lib/bff";
import { cn } from "@/lib/utils";

/**
 * Inhalte → Bereiche: die Bereiche, die das Frontend-Template deklariert
 * hat, gefüllt mit Bausteinen (Stufe 2 der Template-Mechanik).
 *
 * Links die Liste aus dem Manifest, rechts derselbe Designer wie bei einer
 * Seite. Diese Datei kennt weder "Kopfbereich" noch "Fußbereich" – beides
 * kommt aus dem Manifest, und ein anderes Template bringt andere Bereiche
 * mit.
 */
export function RegionsExplorer({
  templateName,
  regions,
  selectedKey,
  initialData,
  moduleTypes,
  globalModules,
}: {
  templateName: string | null;
  regions: TemplateRegion[];
  selectedKey: string | null;
  initialData: Record<string, unknown>;
  moduleTypes: ModuleType[];
  globalModules: GlobalModule[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [blocks, setBlocks] = useState<ModuleInstance[]>(
    (initialData?.blocks as ModuleInstance[] | undefined) ?? [],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = regions.find((region) => region.key === selectedKey) ?? null;

  function selectRegion(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("region", key);
    // Volle Navigation statt lokalem Zustand: der Inhalt des Bereichs wird
    // serverseitig geladen, und ein ungespeicherter Stand soll beim
    // Wechseln nicht stillschweigend mitwandern.
    router.push(`/dashboard/regions?${params.toString()}`);
  }

  async function handleSave() {
    if (!selectedKey) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(bff(`/api/template-regions/${selectedKey}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { blocks } }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      toastEdited("Der Bereich wurde gespeichert.");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DashboardBreadcrumbs />

      {regions.length === 0 ? (
        <SystemMessage
          variant="warning"
          title="Keine Bereiche gefunden"
          description="Die Webseite konnte nicht nach ihren Bereichen gefragt werden. Entweder läuft sie gerade nicht, oder ihr Template bringt kein Manifest mit – dann gibt es hier nichts zu gestalten."
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[260px_1fr]">
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Bereiche</CardTitle>
              <p className="text-sm text-muted-foreground">
                {templateName
                  ? `Aus dem Template „${templateName}“.`
                  : "Aus dem Template dieser Webseite."}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {regions.map((region) => {
                const isActive = region.key === selectedKey;
                return (
                  <button
                    key={region.key}
                    type="button"
                    onClick={() => selectRegion(region.key)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      isActive
                        ? "border-primary bg-muted"
                        : "border-border hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md",
                        // Icon-Kästchen bleiben grau, solange der Punkt
                        // nicht ausgewählt ist (App-Konvention).
                        isActive
                          ? "bg-primary/20 text-pivot-navy"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <LayoutTemplate className="size-4" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {region.label}
                      </span>
                      {region.description && (
                        <span className="text-xs text-muted-foreground">
                          {region.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>{selected?.label ?? "Bereich"}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Die Bausteine dieses Bereichs stehen auf JEDER Seite der
                  Webseite. Solange keiner gesetzt ist, zeigt das Template seine
                  eingebaute Fassung.
                </p>
              </div>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                <Save className="size-4" />
                {isSaving ? "Speichert…" : "Speichern"}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {error && (
                <SystemMessage
                  variant="error"
                  title="Nicht gespeichert"
                  description={error}
                />
              )}
              {selected?.required && selected.required.length > 0 && (
                <SystemMessage
                  variant="info"
                  title="Empfohlene Bausteine"
                  description={`Dieses Template erwartet hier: ${selected.required.join(", ")}. Ohne sie funktioniert der Bereich, wirkt aber unfertig.`}
                />
              )}
              <BlockEditorField
                value={blocks}
                onChange={setBlocks}
                moduleTypes={moduleTypes}
                globalModules={globalModules}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
