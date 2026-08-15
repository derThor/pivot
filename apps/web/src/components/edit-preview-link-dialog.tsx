"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import type { PreviewLinkWithContent } from "@/lib/api-server";

const expiryOptions: Record<string, string> = {
  "24": "1 Tag",
  "168": "7 Tage",
  "720": "30 Tage",
};

export function EditPreviewLinkDialog({
  link,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  link: PreviewLinkWithContent;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [expiresInHours, setExpiresInHours] = useState("168");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await fetch(
        `/api/content/${link.content.id}/preview-links/${link.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInHours: Number(expiresInHours) }),
        },
      );
      setOpen(false);
      toastEdited("Die Gültigkeitsdauer wurde aktualisiert.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setExpiresInHours("168");
      }}
    >
      {!hideTrigger && (
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Vorschau-Link für „${link.content.title}“ bearbeiten`}
            />
          }
        >
          <Pencil />
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Vorschau-Link bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-preview-link-expiry">
            Neue Gültigkeitsdauer (ab jetzt)
          </Label>
          <Select
            value={expiresInHours}
            onValueChange={(value) => setExpiresInHours(value ?? "168")}
            items={expiryOptions}
          >
            <SelectTrigger id="edit-preview-link-expiry" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(expiryOptions).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Speichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
