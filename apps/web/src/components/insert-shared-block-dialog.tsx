"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { toastCreated } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModuleFieldInput } from "@/components/module-field-input";
import type { GlobalModule, ModuleType } from "@/lib/api-server";

/** Öffnet sich, wenn im Designer ein FAQ- oder Galerie-Baustein auf die
 * Fläche gezogen wird (siehe block-editor-field.tsx): entweder eine
 * bereits angelegte, zentral gepflegte Instanz auswählen oder direkt eine
 * neue anlegen – beides landet als Referenz im Baustein (live geteilt,
 * Bearbeitung wirkt sich überall aus, wo sie eingebunden ist). Dieselben
 * Einträge lassen sich auch über die "FAQs"-/"Galerien"-Unterseite bei
 * "Seiten" verwalten (siehe global-modules-manager.tsx). */
export function InsertSharedBlockDialog({
  open,
  onOpenChange,
  moduleType,
  items,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleType: ModuleType | null;
  items: GlobalModule[];
  onSelect: (globalModule: GlobalModule) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "create">("list");
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setMode("list");
    setName("");
    setValues({});
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    // Der Dialog wird per Portal gerendert, liegt aber (Content-Editor →
    // BlockEditorField → InsertSharedBlockDialog) innerhalb des äußeren
    // Content-Formulars. React lässt Submit-Events trotz Portal über den
    // React-Baum bubbeln – ohne stopPropagation() würde dieser Submit
    // zusätzlich das äußere Formular auslösen und den ganzen Content-
    // Eintrag speichern (siehe image-picker-dialog.tsx für dasselbe Muster).
    e.stopPropagation();
    if (!moduleType) return;
    if (!name.trim()) {
      setError("Bitte einen Namen angeben.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/global-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, moduleTypeId: moduleType.id, values }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? "Konnte nicht angelegt werden.");
        return;
      }
      toastCreated(`„${name}“ wurde angelegt.`);
      router.refresh();
      onSelect(body as GlobalModule);
      reset();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const fields = moduleType?.schema.fields.filter((f) => !f.option) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg">
        {moduleType && (
          <>
            <DialogHeader className="shrink-0">
              <DialogTitle>
                {mode === "list"
                  ? `${moduleType.name} einfügen`
                  : `${moduleType.name} anlegen`}
              </DialogTitle>
            </DialogHeader>

            {mode === "list" ? (
              <div className="flex flex-col gap-3 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Noch keine vorhandenen Einträge.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelect(item);
                          reset();
                        }}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:border-orange-400"
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Auswählen
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode("create")}
                >
                  <Plus />
                  Neu anlegen
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleCreate}
                className="flex flex-col gap-4 overflow-y-auto"
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="insert-shared-block-name" required>
                    Name
                  </Label>
                  <Input
                    id="insert-shared-block-name"
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
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Speichert…" : "Anlegen & einfügen"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode("list")}
                  >
                    Zurück
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
