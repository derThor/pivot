"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ImagePickerDialog } from "@/components/image-picker-dialog";
import { toImageValue } from "@/components/block-field-output";
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
          onSelect={(url) => {
            onChange({ ...img, url });
            setPickerOpen(false);
          }}
        />
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
