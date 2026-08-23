"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadPublishedForms } from "@/components/module-field-input";
import type { FormListItem } from "@/lib/api-server";

/** Öffnet sich, wenn im Designer der "Formular"-Baustein auf die Fläche
 * gezogen wird (siehe block-editor-field.tsx `isFormModuleType`) – gleiches
 * Grundmuster wie `InsertSharedBlockDialog` bei Galerie/FAQ, aber ohne
 * Inline-Anlegen: Formulare haben einen eigenen, vollständigen Editor
 * (`/dashboard/forms/new`), der hier in einem neuen Tab geöffnet wird,
 * damit der aktuelle Seiten-Entwurf nicht verlassen werden muss. */
export function InsertFormBlockDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (formId: string) => void;
}) {
  const [forms, setForms] = useState<FormListItem[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    loadPublishedForms().then((items) => {
      if (active) setForms(items);
    });
    return () => {
      active = false;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Formular einfügen</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {forms === null ? (
            <p className="text-sm text-muted-foreground">
              Formulare werden geladen …
            </p>
          ) : forms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine veröffentlichten Formulare vorhanden.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {forms.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => onSelect(form.id)}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:border-orange-400"
                >
                  <span className="font-medium">{form.name}</span>
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
            render={<Link href="/dashboard/forms/new" target="_blank" />}
          >
            <Plus />
            Formular erstellen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
