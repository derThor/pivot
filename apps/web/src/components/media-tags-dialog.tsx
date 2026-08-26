"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaItem, TaxonomyItem } from "@/lib/api-server";

export function MediaTagsDialog({
  item,
  availableTags,
  open,
  onOpenChange,
}: {
  item: MediaItem;
  availableTags: TaxonomyItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(item.tags.map((tag) => tag.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function toggle(tagId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: [...selected] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      onOpenChange(false);
      toastEdited("Die Tags wurden gespeichert.");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags für „{item.filename}“</DialogTitle>
        </DialogHeader>
        {availableTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Tags vorhanden. Lege welche unter „Tags“ in der
            Navigation an.
          </p>
        ) : (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {availableTags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 text-sm"
                htmlFor={`media-tag-${item.id}-${tag.id}`}
              >
                <Checkbox
                  id={`media-tag-${item.id}-${tag.id}`}
                  checked={selected.has(tag.id)}
                  onCheckedChange={() => toggle(tag.id)}
                />
                {tag.name}
              </label>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-border"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Speichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
