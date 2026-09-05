"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Palette, Trash2, Upload } from "lucide-react";
import type { TemplateManifest } from "@pivot/blocks";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { SystemMessage } from "@/components/ui/system-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { bff } from "@/lib/bff";
import { cn } from "@/lib/utils";

interface FrontendTemplateItem {
  id: string;
  key: string;
  name: string;
  version: string | null;
  manifest: TemplateManifest;
  isActive: boolean;
  updatedAt: string;
}

/**
 * Hochgeladene Frontend-Templates: Liste, Upload, Umschalten
 * (Nutzervorgabe, 2026-09-05: *"das man ein frontend-template hinzufügen
 * kann … aktivieren und deaktivieren … nur eins aktiv … im livebetrieb"*).
 *
 * **Was ein Paket enthält** – und warum nicht mehr: `template.json`
 * (Name + Manifest), `theme.css`, optional `regions.json` und einen
 * `assets`-Ordner. CSS und Daten brauchen keinen Build und wirken deshalb
 * sofort; React-Code müsste kompiliert werden und kann nie Teil eines
 * Uploads sein. Ein Template ändert das Aussehen, nicht Aufbau oder
 * Verhalten.
 *
 * Ist keines aktiv, gilt das im Frontend-Projekt eingebaute Template.
 */
export function FrontendTemplatesCard() {
  const [items, setItems] = useState<FrontendTemplateItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await fetch(bff("/api/frontend-templates"));
      setItems(res.ok ? ((await res.json()) as FrontendTemplateItem[]) : []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function send(path: string, init?: RequestInit) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(bff(path), init);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message ?? "Das hat nicht geklappt.");
        return false;
      }
      await load();
      return true;
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const ok = await send("/api/frontend-templates", {
      method: "POST",
      body: form,
    });
    if (ok) {
      setNote(
        "Paket übernommen. Aktiv wird es erst, wenn du es unten aktivierst.",
      );
    }
  }

  const active = items?.find((item) => item.isActive) ?? null;

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <div className="flex flex-col gap-1">
        <Label>Templates</Label>
        <p className="text-sm text-muted-foreground">
          {active
            ? `Aktiv ist „${active.name}“ – es bestimmt Farben, Typografie und Feinschliff der öffentlichen Webseite.`
            : "Aktiv ist das im Frontend-Projekt eingebaute Template."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-button-border"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" />
          Paket hochladen (.zip)
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleUpload(file);
          }}
        />
        {active && (
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
            disabled={busy}
            onClick={() =>
              void send("/api/frontend-templates/deactivate", {
                method: "POST",
              })
            }
          >
            Auf eingebautes Template zurück
          </Button>
        )}
      </div>

      {error && (
        <SystemMessage
          variant="error"
          title="Nicht übernommen"
          description={error}
        />
      )}
      {note && (
        <SystemMessage variant="info" title="Hinweis" description={note} />
      )}

      {items === null ? (
        <p className="text-sm text-muted-foreground">
          Templates werden geladen …
        </p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          <Palette className="size-5" />
          Noch kein Template hochgeladen.
          <span>Es gilt das eingebaute Template dieser Installation.</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4",
                item.isActive
                  ? "border-primary bg-muted"
                  : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                    item.isActive
                      ? "bg-primary/20 text-pivot-navy"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {item.isActive ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Palette className="size-4" />
                  )}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {item.name}
                    {item.version && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {item.version}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.manifest?.settings?.length ?? 0} Einstellungen ·{" "}
                    {item.manifest?.regions?.length ?? 0} Bereiche
                    {item.isActive && " · aktiv"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!item.isActive && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-button-border"
                    disabled={busy}
                    onClick={() =>
                      void send(`/api/frontend-templates/${item.id}/activate`, {
                        method: "POST",
                      })
                    }
                  >
                    Aktivieren
                  </Button>
                )}
                {/* Das aktive lässt sich nicht löschen – sonst stünde die
                    Webseite ohne Gestaltung da. Erst umschalten. */}
                {!item.isActive && (
                  <ConfirmDeleteDialog
                    title={`„${item.name}“ löschen?`}
                    description="Das Paket und seine Dateien werden entfernt. Gepflegte Inhalte und Bereiche bleiben."
                    onConfirm={async () => {
                      await send(`/api/frontend-templates/${item.id}`, {
                        method: "DELETE",
                      });
                    }}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        className="border-button-border"
                        aria-label={`${item.name} löschen`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Ein Paket besteht aus <code>template.json</code> (Name und Manifest),{" "}
        <code>theme.css</code>, optional <code>regions.json</code> und einem
        Ordner <code>assets/</code> für Schriften und Bilder. Externe Adressen
        im CSS werden abgelehnt – Schriften und Bilder müssen im Paket liegen.
      </p>
    </div>
  );
}
