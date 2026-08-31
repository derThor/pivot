"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { bff } from "@/lib/bff";

interface NavigationRef {
  id: string;
  name: string;
  slug: string;
}

export function NavigationDialog({
  navigation,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  navigation?: NavigationRef;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(navigation);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [name, setName] = useState(navigation?.name ?? "");
  const [slug, setSlug] = useState(navigation?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function resetForm() {
    setName(navigation?.name ?? "");
    setSlug(navigation?.slug ?? "");
    setSlugTouched(isEditing);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(
        isEditing
          ? bff(`/api/navigations/${navigation!.id}`)
          : bff("/api/navigations"),
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, slug }),
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
                aria-label={`${navigation!.name} bearbeiten`}
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
              Neues Menü
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Menü bearbeiten" : "Neues Menü"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="navigation-name" required>
              Name
            </Label>
            <Input
              id="navigation-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="z.B. Hauptnavigation"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="navigation-slug" required>
              Slug
            </Label>
            <Input
              id="navigation-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="z.B. hauptnavigation"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border"
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
