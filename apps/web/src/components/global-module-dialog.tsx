"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ModuleFieldInput } from "@/components/module-field-input";
import type { GlobalModule, ModuleType } from "@/lib/api-server";

// Anlegen UND Bearbeiten in einem Dialog (wie z.B. bei Kategorien/Tags).
// `moduleType` ist fest vorgegeben (FAQ- bzw. Galerie-Bibliothek, siehe
// dashboard/content/faqs bzw. .../galleries) – anders als früher gibt es
// keine freie Modul-Typ-Wahl mehr, jede Liste zeigt genau einen Typ.
// Felder für `values` werden dynamisch aus dem Modul-Typ-Schema erzeugt,
// per `ModuleFieldInput` – dieselbe Komponente, die auch das "Bearbeiten"-
// Popup im Block-Editor nutzt.
export function GlobalModuleDialog({
  moduleType,
  globalModule,
  triggerButtonProps,
  triggerContent,
}: {
  moduleType: ModuleType;
  globalModule?: GlobalModule;
  triggerButtonProps?: React.ComponentProps<typeof Button>;
  triggerContent?: ReactNode;
}) {
  const router = useRouter();
  const isEditing = Boolean(globalModule);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(globalModule?.name ?? "");
  const [values, setValues] = useState<Record<string, unknown>>(
    globalModule?.values ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fields = moduleType.schema.fields.filter((f) => !f.option);

  function reset() {
    setName(globalModule?.name ?? "");
    setValues(globalModule?.values ?? {});
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Bitte einen Namen angeben.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/global-modules/${globalModule!.id}`
        : "/api/global-modules";
      const method = isEditing ? "PATCH" : "POST";
      const body = isEditing
        ? { name, values }
        : { name, moduleTypeId: moduleType.id, values };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(
          errBody?.message ?? "Eintrag konnte nicht gespeichert werden.",
        );
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button {...triggerButtonProps} />}>
        {triggerContent ?? (
          <>
            <Plus />
            Neu anlegen
          </>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEditing
              ? `${moduleType.name} bearbeiten`
              : `${moduleType.name} anlegen`}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 overflow-y-auto"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="global-module-name">Name</Label>
            <Input
              id="global-module-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Interner Name zur Wiedererkennung, z.B. „Versand-FAQ“"
            />
          </div>
          {fields.map((field) => (
            <ModuleFieldInput
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(v) =>
                setValues((prev) => ({ ...prev, [field.name]: v }))
              }
            />
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Speichert…"
              : isEditing
                ? "Änderungen speichern"
                : "Anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
