"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import {
  isTemplateFieldVisible,
  resolveTemplateSettings,
  type TemplateField,
  type TemplateManifest,
  type TemplateSettingValue,
  type TemplateSettingsValues,
  type TemplateSpacingValue,
} from "@pivot/blocks";

import {
  BreakpointTabs,
  type BreakpointTab,
} from "@/components/breakpoint-tabs";
import { ImagePickerDialog } from "@/components/image-picker-dialog";
import { SwitchRow } from "@/components/switch-row";
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
import type { NavigationSummary } from "@/lib/api-server";
import { bff } from "@/lib/bff";
import { mediaUrl } from "@/lib/media";

/** Ein Abstandsfeld (`type: "spacing"`): dieselbe Bedienung wie im
 * Designer und am Menüpunkt – Reiter oben, zwei Zahlenfelder darunter. */
function SpacingControl({
  value,
  onChange,
}: {
  value: TemplateSpacingValue;
  onChange: (next: TemplateSpacingValue) => void;
}) {
  const [tab, setTab] = useState<BreakpointTab>("mobile");
  const suffix =
    tab === "mobile" ? "Mobile" : tab === "tablet" ? "Tablet" : "Desktop";

  function setSide(side: "top" | "bottom", raw: string) {
    const key = `${side}${suffix}` as keyof TemplateSpacingValue;
    const parsed = Number(raw);
    // Leeres Feld heißt "kein eigener Wert" (Vorgabe des Templates) und ist
    // etwas anderes als 0 – deshalb null statt einer stillen Umwandlung.
    const next =
      raw.trim() === "" || !Number.isFinite(parsed) || parsed < 0
        ? null
        : Math.min(1000, Math.round(parsed));
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-2">
      <BreakpointTabs value={tab} onChange={setTab} />
      <div className="flex flex-wrap items-center justify-center gap-4">
        {(["top", "bottom"] as const).map((side) => (
          <div key={side} className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {side === "top" ? "Oben" : "Unten"}
            </span>
            <Input
              type="number"
              min={0}
              max={1000}
              placeholder="–"
              className="h-9 w-20 px-2 text-center text-sm"
              value={
                (value[`${side}${suffix}` as keyof TemplateSpacingValue] ??
                  "") as number | ""
              }
              onChange={(e) => setSide(side, e.target.value)}
            />
          </div>
        ))}
        <span className="text-sm text-muted-foreground">px</span>
      </div>
    </div>
  );
}

/** Ein einzelnes Feld, gezeichnet nach seinem Typ. Die Verwaltung kennt
 * die Typen – nicht die Felder. */
function TemplateFieldControl({
  field,
  value,
  onChange,
  navigations,
}: {
  field: TemplateField;
  value: TemplateSettingValue;
  onChange: (next: TemplateSettingValue) => void;
  navigations: NavigationSummary[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const id = `template-${field.key}`;

  if (field.type === "boolean") {
    return (
      <SwitchRow
        label={field.label}
        description={field.description}
        checked={value === true}
        onCheckedChange={(checked) => onChange(checked)}
      />
    );
  }

  const control = (() => {
    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            id={id}
            rows={3}
            value={(value as string | null) ?? ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value || null)}
          />
        );
      case "number":
        return (
          <div className="flex items-center gap-2">
            <Input
              id={id}
              type="number"
              min={field.min}
              max={field.max}
              className="w-32"
              value={(value as number | null) ?? ""}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                onChange(
                  e.target.value === "" || !Number.isFinite(parsed)
                    ? null
                    : parsed,
                );
              }}
            />
            {field.unit && (
              <span className="text-sm text-muted-foreground">
                {field.unit}
              </span>
            )}
          </div>
        );
      case "color":
        return (
          <div className="flex items-center gap-2">
            {/* Farbwähler und Textfeld nebeneinander: der Wähler ist
                bequem, der Hex-Wert lässt sich aber auch aus einem
                Styleguide einfügen. */}
            <input
              id={id}
              type="color"
              className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
              value={(value as string | null) ?? "#000000"}
              onChange={(e) => onChange(e.target.value)}
            />
            <Input
              className="w-32 font-mono text-sm"
              value={(value as string | null) ?? ""}
              placeholder="#000000"
              onChange={(e) => onChange(e.target.value || null)}
            />
          </div>
        );
      case "select":
        return (
          <Select
            value={(value as string | null) ?? ""}
            onValueChange={(next) => onChange(next)}
          >
            <SelectTrigger id={id} className="w-full sm:w-64">
              <SelectValue placeholder="Bitte wählen" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map(([optionValue, optionLabel]) => (
                <SelectItem key={optionValue} value={optionValue}>
                  {optionLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "navigation":
        return (
          <Select
            value={(value as string | null) ?? "none"}
            onValueChange={(next) => onChange(next === "none" ? null : next)}
          >
            <SelectTrigger id={id} className="w-full sm:w-64">
              <SelectValue placeholder="Kein Menü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Menü</SelectItem>
              {navigations.map((navigation) => (
                <SelectItem key={navigation.id} value={navigation.id}>
                  {navigation.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "image":
        return (
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-40 items-center justify-start overflow-hidden rounded-md border border-border bg-background px-2 text-muted-foreground">
              {value ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl({ url: value as string })}
                  alt={field.label}
                  className="h-full w-auto object-contain"
                />
              ) : (
                <ImageIcon className="size-4" />
              )}
            </span>
            <Button
              type="button"
              variant="outline"
              className="border-button-border"
              onClick={() => setPickerOpen(true)}
            >
              {value ? "Ersetzen" : "Auswählen"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="outline"
                className="border-button-border"
                aria-label="Bild entfernen"
                onClick={() => onChange(null)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            <ImagePickerDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onSelect={(url) => {
                onChange(url);
                setPickerOpen(false);
              }}
            />
          </div>
        );
      case "spacing":
        return (
          <SpacingControl
            value={(value as TemplateSpacingValue | null) ?? {}}
            onChange={(next) => onChange(next)}
          />
        );
      default:
        return (
          <Input
            id={id}
            value={(value as string | null) ?? ""}
            placeholder={"placeholder" in field ? field.placeholder : undefined}
            onChange={(e) => onChange(e.target.value || null)}
          />
        );
    }
  })();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      {control}
      {field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}

/**
 * Die Einstellungen, die das Frontend-TEMPLATE dieser Installation
 * deklariert hat (Nutzerentscheidung, 2026-09-05: *"beim frontend muss das
 * für jedes template, egal wie es aussieht, gehen"*).
 *
 * Diese Datei kennt kein einziges Feld namentlich. Sie holt das Manifest
 * der Website (`GET /api/template`, siehe die gleichnamige Route) und
 * zeichnet daraus Felder – exakt so, wie der Seiten-Designer aus
 * `ModuleType.schema` seine Baustein-Formulare zeichnet. Ein anderes
 * Template bringt andere Felder mit, ohne dass hier eine Zeile anders ist.
 *
 * Das Manifest wird im BROWSER geholt und nicht serverseitig
 * mitgeliefert: die Einstellungen-Seite soll auch dann laden, wenn die
 * Website gerade nicht läuft (Entwicklung, Deploy). Fehlt es, steht hier
 * ein Hinweis und der Rest der Seite bleibt bedienbar.
 */
export function TemplateSettingsFields({
  values,
  onChange,
  navigations,
}: {
  values: TemplateSettingsValues | null;
  onChange: (next: TemplateSettingsValues) => void;
  navigations: NavigationSummary[];
}) {
  const [manifest, setManifest] = useState<TemplateManifest | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    fetch(bff("/api/template"))
      .then(
        (res) => res.json() as Promise<{ manifest: TemplateManifest | null }>,
      )
      .then((body) => {
        if (!active) return;
        setManifest(body.manifest);
        setState(body.manifest ? "ready" : "unavailable");
      })
      .catch(() => active && setState("unavailable"));
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <p className="text-sm text-muted-foreground sm:col-span-2">
        Template wird gelesen …
      </p>
    );
  }

  if (state === "unavailable" || !manifest) {
    return (
      <p className="text-sm text-muted-foreground sm:col-span-2">
        Die Webseite konnte nicht nach ihren Gestaltungswerten gefragt werden.
        Entweder läuft sie gerade nicht, oder ihr Template bringt kein Manifest
        mit – dann gelten seine eingebauten Vorgaben.
      </p>
    );
  }

  // Vorgaben des Manifests unter die gespeicherten Werte legen, damit
  // Felder nie leer wirken, obwohl das Template einen Wert benutzt.
  const resolved = resolveTemplateSettings(manifest, values);

  // Reihenfolge der Gruppen = Reihenfolge ihres ersten Feldes im Manifest.
  // Das Template bestimmt damit auch den Aufbau der Seite, nicht nur ihren
  // Inhalt.
  const groups: { title: string | null; fields: TemplateField[] }[] = [];
  for (const field of manifest.settings) {
    if (!isTemplateFieldVisible(field, resolved)) continue;
    const title = field.group ?? null;
    const existing = groups.find((group) => group.title === title);
    if (existing) existing.fields.push(field);
    else groups.push({ title, fields: [field] });
  }

  return (
    <div className="flex flex-col gap-6 sm:col-span-2">
      <p className="text-sm text-muted-foreground">
        Diese Werte stammen aus dem Template{" "}
        <span className="font-medium text-foreground">{manifest.name}</span>.
        Ein leeres Feld bedeutet: es gilt die Vorgabe des Templates.
      </p>
      {groups.map((group) => (
        <div key={group.title ?? "_"} className="flex flex-col gap-4">
          {group.title && (
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.title}
            </h3>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.fields.map((field) => (
              <TemplateFieldControl
                key={field.key}
                field={field}
                value={resolved[field.key] ?? null}
                navigations={navigations}
                onChange={(next) =>
                  // Immer den vollständigen Satz zurückgeben: die Werte
                  // liegen als EIN Json-Feld in der Datenbank.
                  onChange({ ...resolved, [field.key]: next })
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
