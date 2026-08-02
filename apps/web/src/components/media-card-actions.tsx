"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

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
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import type { MediaItem } from "@/lib/api-server";

export function MediaCardActions({ item }: { item: MediaItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alt, setAlt] = useState(item.alt ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveAlt(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/media/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Alt-Text bearbeiten" />}>
          <Pencil />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alt-Text bearbeiten</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveAlt} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`alt-${item.id}`}>Alt-Text</Label>
              <Input
                id={`alt-${item.id}`}
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Speichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`${item.filename} löschen`}>
            <Trash2 />
          </Button>
        }
        title={`„${item.filename}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
