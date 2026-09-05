"use client";

import { useState } from "react";
import { Braces, ListTree, Plus, Trash2 } from "lucide-react";
import {
  validateTemplateManifest,
  type TemplateField,
  type TemplateFieldType,
  type TemplateManifest,
  type TemplateManifestIssue,
  type TemplateRegion,
} from "@pivot/blocks";

import { SystemMessage } from "@/components/ui/system-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Die Feldtypen des Vokabulars mit deutscher Beschriftung. Die Liste
 * lebt in @pivot/blocks; hier stehen nur die Namen dafür. */
const FIELD_TYPE_LABELS: Record<TemplateFieldType, string> = {
  text: "Text",
  textarea: "Mehrzeiliger Text",
  number: "Zahl",
  color: "Farbe",
  select: "Auswahl",
  boolean: "Schalter",
  image: "Bild",
  navigation: "Menü",
  spacing: "Abstand (Mobil/Tablet/Desktop)",
};

const EMPTY_MANIFEST: TemplateManifest = {
  name: "",
  regions: [],
  settings: [],
};

/**
 * Bearbeitet ein Template-Manifest **in der Oberfläche** statt als
 * JSON-Text (Nutzervorgabe, 2026-09-05: *"das jedes manifest dynamisch
 * bearbeitet werden kann in der ui"*).
 *
 * Zwei Ansichten auf dieselbe Sache: die **Felder-Ansicht** für den
 * Normalfall (Beschriftung nachtragen, Gruppe setzen, Feld ergänzen oder
 * entfernen) und die **JSON-Ansicht** für alles, was das Formular nicht
 * abbildet – etwa die Optionen einer Auswahl oder eine `showIf`-Bedingung.
 * Beide arbeiten auf demselben Objekt; ein Wechsel verliert nichts.
 *
 * Der Editor kennt kein einziges Feld eines bestimmten Templates. Er kennt
 * nur das Vokabular (die Feldtypen) – wie der Rest dieser Mechanik.
 */
export function TemplateManifestEditor({
  manifest,
  onChange,
  issues,
}: {
  manifest: TemplateManifest | null;
  onChange: (next: TemplateManifest) => void;
  /** Prüfergebnis von außen (z.B. nach dem Speichern), zusätzlich zur
   * laufenden Prüfung beim Bearbeiten. */
  issues?: TemplateManifestIssue[] | null;
}) {
  const [view, setView] = useState<"fields" | "json">("fields");
  const [json, setJson] = useState(() =>
    JSON.stringify(manifest ?? EMPTY_MANIFEST, null, 2),
  );
  const [jsonIssues, setJsonIssues] = useState<TemplateManifestIssue[] | null>(
    null,
  );

  const current = manifest ?? EMPTY_MANIFEST;

  function update(next: Partial<TemplateManifest>) {
    const merged = { ...current, ...next };
    onChange(merged);
    // Die JSON-Ansicht zieht mit, damit ein Wechsel den gerade
    // bearbeiteten Stand zeigt und nicht den von vorhin.
    setJson(JSON.stringify(merged, null, 2));
  }

  function updateField(index: number, patch: Partial<TemplateField>) {
    const settings = current.settings.map((field, i) =>
      i === index ? ({ ...field, ...patch } as TemplateField) : field,
    );
    update({ settings });
  }

  function addField() {
    update({
      settings: [
        ...current.settings,
        {
          key: `feld${current.settings.length + 1}`,
          label: "Neues Feld",
          type: "text",
        },
      ],
    });
  }

  function removeField(index: number) {
    update({ settings: current.settings.filter((_, i) => i !== index) });
  }

  function updateRegion(index: number, patch: Partial<TemplateRegion>) {
    const regions = current.regions.map((region, i) =>
      i === index ? { ...region, ...patch } : region,
    );
    update({ regions });
  }

  function applyJson(raw: string) {
    setJson(raw);
    setJsonIssues(null);
    if (!raw.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Beim Tippen ist unfertiges JSON normal – gemeckert wird erst beim
      // Verlassen des Feldes (onBlur unten).
      return;
    }
    const found = validateTemplateManifest(parsed);
    if (found.length > 0) {
      setJsonIssues(found);
      return;
    }
    onChange(parsed as TemplateManifest);
  }

  const shown = issues ?? jsonIssues;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manifest-name">Name des Templates</Label>
          <Input
            id="manifest-name"
            className="w-64"
            value={current.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
          {(
            [
              ["fields", "Felder", ListTree],
              ["json", "JSON", Braces],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                view === value
                  ? "border-primary bg-card shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown && shown.length > 0 && (
        <SystemMessage
          variant="error"
          title="Manifest unvollständig"
          description={shown
            .map((issue) =>
              issue.path ? `${issue.path}: ${issue.message}` : issue.message,
            )
            .join(" · ")}
        />
      )}

      {view === "json" ? (
        <div className="flex flex-col gap-1.5">
          <Textarea
            rows={18}
            className="font-mono text-xs"
            value={json}
            onChange={(e) => applyJson(e.target.value)}
            onBlur={(e) => {
              try {
                JSON.parse(e.target.value);
              } catch (error) {
                setJsonIssues([
                  {
                    path: "",
                    message: `Kein gültiges JSON: ${
                      error instanceof Error ? error.message : "unbekannt"
                    }`,
                  },
                ]);
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Für alles, was das Formular nicht abbildet: Optionen einer Auswahl,
            Bedingungen (<code>showIf</code>), Pflicht-Bausteine eines Bereichs.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Bereiche
            </span>
            {current.regions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Bereiche deklariert. Ein Bereich erscheint nur, wenn das
                Template ihn auch rendert – deshalb lassen sie sich hier
                umbenennen, aber nicht erfinden.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {current.regions.map((region, index) => (
                  <li
                    key={region.key}
                    className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Schlüssel
                      </Label>
                      <Input
                        className="h-9 w-40 font-mono text-xs"
                        value={region.key}
                        disabled
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Beschriftung
                      </Label>
                      <Input
                        className="h-9"
                        value={region.label}
                        onChange={(e) =>
                          updateRegion(index, { label: e.target.value })
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Einstellungen ({current.settings.length})
              </span>
              <Button
                type="button"
                variant="outline"
                className="border-button-border"
                onClick={addField}
              >
                <Plus className="size-4" />
                Feld hinzufügen
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {current.settings.map((field, index) => (
                <li
                  key={`${field.key}-${index}`}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-3"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Schlüssel
                      </Label>
                      <Input
                        className="h-9 w-40 font-mono text-xs"
                        value={field.key}
                        onChange={(e) =>
                          updateField(index, { key: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex min-w-40 flex-1 flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Beschriftung
                      </Label>
                      <Input
                        className="h-9"
                        value={field.label}
                        onChange={(e) =>
                          updateField(index, { label: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Typ
                      </Label>
                      <Select
                        value={field.type}
                        onValueChange={(next) =>
                          updateField(index, {
                            type: (next ?? "text") as TemplateFieldType,
                          })
                        }
                        items={FIELD_TYPE_LABELS}
                      >
                        <SelectTrigger className="h-9 w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FIELD_TYPE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-button-border"
                      aria-label={`${field.label} entfernen`}
                      onClick={() => removeField(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Gruppe
                      </Label>
                      <Input
                        className="h-9 w-40"
                        placeholder="z.B. Farben"
                        value={field.group ?? ""}
                        onChange={(e) =>
                          updateField(index, {
                            group: e.target.value || undefined,
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        CSS-Variable
                      </Label>
                      <Input
                        className="h-9 w-56 font-mono text-xs"
                        placeholder="--color-…"
                        value={field.cssVar ?? ""}
                        onChange={(e) =>
                          updateField(index, {
                            cssVar: e.target.value || undefined,
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Vorgabewert
                      </Label>
                      <Input
                        className="h-9"
                        value={
                          field.default === undefined || field.default === null
                            ? ""
                            : typeof field.default === "object"
                              ? JSON.stringify(field.default)
                              : String(field.default)
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          // Der Typ bestimmt, wie der Text zu lesen ist –
                          // sonst stünde in einem Zahlenfeld später ein
                          // String und die Website rechnete damit.
                          const value =
                            raw === ""
                              ? null
                              : field.type === "number"
                                ? Number(raw)
                                : field.type === "boolean"
                                  ? raw === "true"
                                  : raw;
                          updateField(index, {
                            default: value,
                          } as Partial<TemplateField>);
                        }}
                      />
                    </div>
                  </div>
                  {field.type === "select" && (
                    <p className="text-xs text-muted-foreground">
                      Die Optionen dieser Auswahl stehen nur in der JSON-Ansicht
                      (<code>options</code>).
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {current.settings.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Noch keine Einstellungen. „Entwurf erzeugen“ liest die Tokens
                der Webseite aus und legt sie an.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
