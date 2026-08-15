"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
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
import type { ContentTypeField } from "@/lib/api-server";

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
        <Label>
          {field.name}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
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
        <Label>
          {field.name}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
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
              // eslint-disable-next-line jsx-a11y/media-has-caption
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
        <Label>
          {field.name}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
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
      <Label htmlFor={`module-field-${field.name}`}>
        {field.name}
        {field.required && <span className="text-destructive"> *</span>}
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
