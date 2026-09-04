"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Compass,
  Image as ImageIcon,
  Plus,
  Trash2,
  Video as VideoIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedPicker } from "@/components/segmented-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ImagePickerDialog } from "@/components/image-picker-dialog";
import { VideoPickerDialog } from "@/components/video-picker-dialog";
import {
  focalObjectPosition,
  toImageValue,
  toRepeaterItems,
  toVideoValue,
  videoEmbedSrc,
  type RepeaterItem,
} from "@/components/block-field-output";
import { resolveImageSrc } from "@/lib/media";
import type { ContentTypeField, FormListItem } from "@/lib/api-server";
import { bff } from "@/lib/bff";

// Nur veröffentlichte Formulare sind wählbar – ein Entwurf/pausiertes
// Formular hätte im Baustein nichts zu suchen (siehe FormsService.submit(),
// das nur `status: "published"` annimmt). Lädt einmalig pro Editor-Sitzung,
// nicht pro Feld-Instanz (mehrere Formular-Bausteine auf derselben Seite
// teilen sich denselben Abruf).
let formsCache: Promise<FormListItem[]> | null = null;
export function loadPublishedForms(): Promise<FormListItem[]> {
  if (!formsCache) {
    formsCache = fetch(bff("/api/forms?status=published&pageSize=100"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.items ?? [])
      .catch(() => []);
  }
  return formsCache;
}

function FormFieldSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [forms, setForms] = useState<FormListItem[] | null>(null);

  useEffect(() => {
    let active = true;
    loadPublishedForms().then((items) => {
      if (active) setForms(items);
    });
    return () => {
      active = false;
    };
  }, []);

  if (forms === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ClipboardList className="size-4" />
        Formulare werden geladen …
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        <ClipboardList className="size-5" />
        Kein veröffentlichtes Formular vorhanden.
        <span>Lege eines unter „Formulare&quot; an.</span>
      </div>
    );
  }

  const items = Object.fromEntries(forms.map((f) => [f.id, f.name]));

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v ?? "")}
      items={items}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Formular auswählen" />
      </SelectTrigger>
      <SelectContent>
        {forms.map((form) => (
          <SelectItem key={form.id} value={form.id}>
            {form.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Menü-Auswahl für ein Baustein-Feld vom Typ `navigation` (Menü-Baustein
 * in Template-Bereichen, 2026-09-05). Aufbau bewusst 1:1 wie
 * `FormFieldSelect` darüber – dieselbe Aufgabe, dieselbe Bedienung. */
function NavigationFieldSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [navigations, setNavigations] = useState<
    { id: string; name: string }[] | null
  >(null);

  useEffect(() => {
    let active = true;
    fetch(bff("/api/navigations"))
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: { id: string; name: string }[] }) => {
        if (active) setNavigations(body.items ?? []);
      })
      .catch(() => active && setNavigations([]));
    return () => {
      active = false;
    };
  }, []);

  if (navigations === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Compass className="size-4" />
        Menüs werden geladen …
      </div>
    );
  }

  if (navigations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        <Compass className="size-5" />
        Kein Menü vorhanden.
        <span>Lege eines unter „Menüs&quot; an.</span>
      </div>
    );
  }

  const items = Object.fromEntries(navigations.map((n) => [n.id, n.name]));

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v ?? "")}
      items={items}
    >
      <SelectTrigger>
        <SelectValue placeholder="Menü wählen" />
      </SelectTrigger>
      <SelectContent>
        {navigations.map((navigation) => (
          <SelectItem key={navigation.id} value={navigation.id}>
            {navigation.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ModuleFieldInput({
  field,
  value,
  onChange,
  richTextMaxHeight,
}: {
  field: ContentTypeField;
  value: unknown;
  onChange: (value: unknown) => void;
  // Siehe RichTextEditor: begrenzt Rich-Text-Unterfelder auf eine feste,
  // scrollbare Höhe statt frei zu wachsen. Wird bei Repeater-Feldern an
  // die Unterfelder weitergereicht, damit z.B. eine lange FAQ-Antwort
  // nicht die Kachel-Höhe im Grid sprengt (siehe global-module-form-dialog.tsx).
  richTextMaxHeight?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const stringValue = typeof value === "string" ? value : "";

  if (field.type === "image") {
    const img = toImageValue(value);
    return (
      <div className="flex flex-col gap-1.5">
        <Label required={field.required}>{field.name}</Label>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="block w-full overflow-hidden rounded-md border border-dashed text-left transition-colors hover:border-orange-400"
        >
          {img.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveImageSrc(img.url)}
              alt=""
              style={{ objectPosition: focalObjectPosition(img) }}
              className="max-h-40 w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 py-8 text-sm text-muted-foreground">
              <ImageIcon className="size-5" />
              Bild auswählen
            </div>
          )}
        </button>
        <ImagePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(url, _alt, item) => {
            onChange({
              ...img,
              url,
              mediaId: item?.id,
              variants: item?.variants,
              thumbnailUrl: item?.thumbnailUrl ?? undefined,
              focalX: item?.focalX ?? undefined,
              focalY: item?.focalY ?? undefined,
            });
            setPickerOpen(false);
          }}
        />
      </div>
    );
  }

  if (field.type === "form") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label required={field.required}>Formular</Label>
        <FormFieldSelect value={stringValue} onChange={(v) => onChange(v)} />
      </div>
    );
  }

  if (field.type === "navigation") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label required={field.required}>Menü</Label>
        <NavigationFieldSelect
          value={stringValue}
          onChange={(v) => onChange(v)}
        />
        <p className="text-xs text-muted-foreground">
          Gepflegt wird das Menü unter Inhalte → Menüs; hier wird nur
          ausgewählt, welches an dieser Stelle erscheint.
        </p>
      </div>
    );
  }

  if (field.type === "logo") {
    // Das Logo selbst gehört zum Template dieser Webseite
    // (apps/site/src/template/brand.ts) und wird hier NICHT hochgeladen –
    // gewählt wird nur, für welchen Grund es gedacht ist.
    const variant = stringValue === "dark" ? "dark" : "light";
    return (
      <div className="flex flex-col gap-1.5">
        <Label>Logo</Label>
        <SegmentedPicker
          options={[
            { label: "Für hellen Grund", value: "light" },
            { label: "Für dunklen Grund", value: "dark" },
          ]}
          value={variant}
          onChange={(v) => onChange(v)}
        />
        <p className="text-xs text-muted-foreground">
          Das Logo selbst gehört zum Template der Webseite. Ohne hinterlegtes
          Bild erscheint der Webseiten-Titel als Wortmarke.
        </p>
      </div>
    );
  }

  if (field.type === "boolean") {
    // Fehlender Wert (z.B. Einträge von vor Einführung dieses Felds) gilt
    // als "an" – konsistent mit der Lese-Seite (siehe isPublished-Prüfung
    // `!== false` in block-field-output.tsx), sonst würde ein frisch
    // hinzugefügtes Boolean-Feld bestehende Daten rückwirkend "ausschalten".
    const checked = value !== false;
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={`module-field-${field.name}`}
          checked={checked}
          onCheckedChange={onChange}
        />
        <Label htmlFor={`module-field-${field.name}`}>{field.name}</Label>
      </div>
    );
  }

  if (field.type === "video") {
    const video = toVideoValue(value);
    const embedSrc = video.url ? videoEmbedSrc(video.url) : null;
    return (
      <div className="flex flex-col gap-1.5">
        <Label required={field.required}>{field.name}</Label>
        {video.url ? (
          <div className="flex flex-col gap-2">
            {embedSrc ? (
              <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
                <iframe
                  src={embedSrc}
                  title="Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="size-full"
                />
              </div>
            ) : (
              <video
                src={resolveImageSrc(video.url)}
                controls
                className="max-h-40 w-full rounded-md bg-black"
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              Ersetzen
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="block w-full overflow-hidden rounded-md border border-dashed text-left transition-colors hover:border-orange-400"
          >
            <div className="flex flex-col items-center justify-center gap-1 py-8 text-sm text-muted-foreground">
              <VideoIcon className="size-5" />
              Video auswählen
            </div>
          </button>
        )}
        <VideoPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(url, item) => {
            onChange({ url, mediaId: item?.id });
            setPickerOpen(false);
          }}
        />
      </div>
    );
  }

  if (field.type === "repeater") {
    const items = toRepeaterItems(value);
    const subFields = field.fields ?? [];

    function updateItems(next: RepeaterItem[]) {
      onChange(next);
    }

    function addItem() {
      updateItems([...items, { id: crypto.randomUUID(), values: {} }]);
    }

    function removeItem(index: number) {
      updateItems(items.filter((_, i) => i !== index));
    }

    function moveItem(index: number, direction: -1 | 1) {
      const target = index + direction;
      if (target < 0 || target >= items.length) return;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      updateItems(next);
    }

    function updateItemField(
      index: number,
      fieldName: string,
      fieldValue: unknown,
    ) {
      const next = [...items];
      next[index] = {
        ...next[index],
        values: { ...next[index].values, [fieldName]: fieldValue },
      };
      updateItems(next);
    }

    return (
      <div className="flex flex-col gap-2">
        <Label required={field.required}>{field.name}</Label>
        {/* Container-Query statt Viewport-Breakpoint (`@sm`/`@xl` statt
            `sm`/`xl`): dieselbe Komponente läuft sowohl im schmalen
            Schnell-anlegen-Popup im Designer (siehe
            insert-shared-block-dialog.tsx, max. ~512px) als auch auf den
            breiten FAQ-/Galerie-Anlegen/Bearbeiten-Popups
            (global-module-form-dialog.tsx)
            – die Spaltenzahl muss sich nach der tatsächlich verfügbaren
            Breite richten, nicht nach der Bildschirmgröße, sonst würde das
            Popup bei breiten Bildschirmen trotzdem mehrspaltig und zu eng. */}
        <div className="@container">
          <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @xl:grid-cols-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-md border p-3"
              >
                {subFields.map((subField) => (
                  <ModuleFieldInput
                    key={subField.name}
                    field={subField}
                    value={item.values[subField.name]}
                    onChange={(v) => updateItemField(index, subField.name, v)}
                    richTextMaxHeight={richTextMaxHeight}
                  />
                ))}
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                    aria-label="Nach oben verschieben"
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                    aria-label="Nach unten verschieben"
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeItem(index)}
                    aria-label="Eintrag entfernen"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-sm text-muted-foreground transition-colors hover:border-orange-400 hover:text-foreground"
            >
              <Plus className="size-5" />
              Eintrag hinzufügen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`module-field-${field.name}`} required={field.required}>
        {field.name}
      </Label>
      {field.type === "richtext" ? (
        <RichTextEditor
          value={stringValue}
          onChange={onChange}
          maxHeight={richTextMaxHeight}
        />
      ) : field.type === "text" ? (
        <Textarea
          id={`module-field-${field.name}`}
          rows={4}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={`module-field-${field.name}`}
          type={field.type === "number" ? "number" : "text"}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
