"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { slugify } from "@/lib/utils";
import type { TaxonomyItem } from "@/lib/api-server";

export function TaxonomyItemDialog({
  apiPath,
  withDescription,
  item,
  newLabel,
  entitySingular,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  apiPath: "categories" | "tags";
  withDescription?: boolean;
  item?: TaxonomyItem;
  newLabel: string;
  entitySingular: string;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(item);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [name, setName] = useState(item?.name ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Render-Zeit-Sync statt Effekt (gleiches Muster wie `syncedRoleId` in
  // roles-explorer.tsx): der Dialog ist EINE einzige, wiederverwendete
  // Instanz für alle Zeilen (siehe tags-manager.tsx/taxonomy-manager.tsx),
  // `useState(item?.name ?? "")` initialisiert deshalb nur beim allerersten
  // Mount – ohne diesen Sync blieben beim Wechsel auf ein anderes Element
  // die Formularwerte des zuvor bearbeiteten Elements stehen.
  const [syncedItemId, setSyncedItemId] = useState(item?.id);
  if (item?.id !== syncedItemId) {
    setSyncedItemId(item?.id);
    setName(item?.name ?? "");
    setSlug(item?.slug ?? "");
    setDescription(item?.description ?? "");
    setSlugTouched(Boolean(item));
    setError(null);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function resetForm() {
    setName(item?.name ?? "");
    setSlug(item?.slug ?? "");
    setDescription(item?.description ?? "");
    setSlugTouched(isEditing);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(
        isEditing ? `/api/${apiPath}/${item!.id}` : `/api/${apiPath}`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            slug,
            ...(withDescription && { description: description || undefined }),
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }

      setOpen(false);
      if (!isEditing) {
        setName("");
        setSlug("");
        setDescription("");
        setSlugTouched(false);
      }
      if (isEditing) toastEdited();
      else toastCreated(`„${name}“ wurde angelegt.`);
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
        if (!next) resetForm();
      }}
    >
      {!hideTrigger && (
        <DialogTrigger
          render={
            isEditing ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${item!.name} bearbeiten`}
              />
            ) : (
              <Button />
            )
          }
        >
          {isEditing ? (
            <Pencil />
          ) : (
            <>
              <Plus />
              {newLabel}
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `${entitySingular} bearbeiten` : newLabel}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${apiPath}-name`} required>Name</Label>
            <Input
              id={`${apiPath}-name`}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${apiPath}-slug`} required>Slug</Label>
            <Input
              id={`${apiPath}-slug`}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              required
            />
          </div>
          {withDescription && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${apiPath}-description`}>Beschreibung</Label>
              <Textarea
                id={`${apiPath}-description`}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-[#D4D4D4]"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichert…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
