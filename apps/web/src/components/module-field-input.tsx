"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Image as ImageIcon, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ImagePickerDialog } from "@/components/image-picker-dialog";
import {
  focalObjectPosition,
  toImageValue,
  toRepeaterItems,
  type RepeaterItem,
} from "@/components/block-field-output";
import { resolveImageSrc } from "@/lib/media";
import type { ContentTypeField } from "@/lib/api-server";

export function ModuleFieldInput({
  field,
  value,
  onChange,
}: {
  field: ContentTypeField;
  value: unknown;
  onChange: (value: unknown) => void;
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
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus />
          Eintrag hinzufügen
        </Button>
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
        <RichTextEditor value={stringValue} onChange={onChange} />
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
