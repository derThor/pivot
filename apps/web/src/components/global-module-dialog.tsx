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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModuleFieldInput } from "@/components/module-field-input";
import type { GlobalModule, ModuleType } from "@/lib/api-server";

// Anlegen UND Bearbeiten in einem Dialog (wie z.B. bei Kategorien/Tags):
// `globalModule` gesetzt -> Bearbeiten-Modus, Modul-Typ dann nicht mehr
// änderbar (analog zu Content-Type bei `Content`, siehe
// content-editor-form.tsx). Felder für `values` werden dynamisch aus dem
// gewählten Modul-Typ-Schema erzeugt, per `ModuleFieldInput` – dieselbe
// Komponente, die auch das "Bearbeiten"-Popup im Block-Editor nutzt.
export function GlobalModuleDialog({
  moduleTypes,
  globalModule,
  triggerButtonProps,
  triggerContent,
}: {
  moduleTypes: ModuleType[];
  globalModule?: GlobalModule;
  triggerButtonProps?: React.ComponentProps<typeof Button>;
  triggerContent?: ReactNode;
}) {
  const router = useRouter();
  const isEditing = Boolean(globalModule);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(globalModule?.name ?? "");
  const [moduleTypeId, setModuleTypeId] = useState(
    globalModule?.moduleTypeId ?? "",
  );
  const [values, setValues] = useState<Record<string, unknown>>(
    globalModule?.values ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedType = moduleTypes.find((mt) => mt.id === moduleTypeId);
  const fields = selectedType?.schema.fields.filter((f) => !f.option) ?? [];

  function reset() {
    setName(globalModule?.name ?? "");
    setModuleTypeId(globalModule?.moduleTypeId ?? "");
    setValues(globalModule?.values ?? {});
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Bitte einen Namen angeben.");
      return;
    }
    if (!moduleTypeId) {
      setError("Bitte einen Modul-Typ wählen.");
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
        : { name, moduleTypeId, values };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(
          errBody?.message ?? "Globales Modul konnte nicht gespeichert werden.",
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
            Neues globales Modul
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Globales Modul bearbeiten" : "Globales Modul anlegen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="global-module-name">Name</Label>
            <Input
              id="global-module-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Standard-Footer-Banner"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Modul-Typ</Label>
            <Select
              value={moduleTypeId}
              onValueChange={(value) => setModuleTypeId(value ?? "")}
              disabled={isEditing}
              items={Object.fromEntries(
                moduleTypes.map((mt) => [mt.id, mt.name]),
              )}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Modul-Typ wählen" />
              </SelectTrigger>
              <SelectContent>
                {moduleTypes.map((mt) => (
                  <SelectItem key={mt.id} value={mt.id}>
                    {mt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                Der Modul-Typ kann nachträglich nicht geändert werden.
              </p>
            )}
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
