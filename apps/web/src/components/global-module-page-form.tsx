"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModuleFieldInput } from "@/components/module-field-input";
import type { GlobalModule, ModuleType } from "@/lib/api-server";

/** Eigenständige Anlegen-/Bearbeiten-Seite statt Popup – für Galerien
 * bewusst so (mehr Platz für viele Bilder im Repeater-Feld), siehe
 * dashboard/content/galleries/new/ und /[id]/page.tsx. `globalModule`
 * gesetzt -> Bearbeiten-Modus (PATCH), sonst Anlegen (POST). Im Designer
 * bleibt das Anlegen weiterhin ein Popup (siehe insert-shared-block-dialog.tsx),
 * FAQs bleiben ebenfalls beim Popup (global-module-dialog.tsx). */
export function GlobalModulePageForm({
  moduleType,
  globalModule,
  redirectTo,
}: {
  moduleType: ModuleType;
  globalModule?: GlobalModule;
  redirectTo: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(globalModule);
  const [name, setName] = useState(globalModule?.name ?? "");
  const [values, setValues] = useState<Record<string, unknown>>(
    globalModule?.values ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fields = moduleType.schema.fields.filter((f) => !f.option);

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
        setError(errBody?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="global-module-page-name">Name</Label>
            <Input
              id="global-module-page-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Interner Name zur Wiedererkennung"
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
        </CardContent>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Speichert…"
            : isEditing
              ? "Änderungen speichern"
              : "Anlegen"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={redirectTo} />}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
