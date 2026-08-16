"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { toastCreated } from "@/components/app-toast";
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
import type { ContentListItem } from "@/lib/api-server";

const expiryOptions: Record<string, string> = {
  "24": "1 Tag",
  "168": "7 Tage",
  "720": "30 Tage",
};

/** "+ Link erstellen" auf der globalen Vorschau-Links-Übersicht
 * (Nutzervorgabe, 2026-08-16, 1:1 nach Bildvorlage) – anders als
 * `PreviewLinksDialog` (pro Inhalt, kennt seine `contentId` schon aus dem
 * Kontext) braucht dieser hier zusätzlich eine Inhalts-Auswahl, da die
 * globale Liste inhaltsübergreifend ist. Nutzt denselben
 * content-scoped `POST /content/:id/preview-links`-Endpoint. */
export function CreatePreviewLinkDialog({
  contentItems,
}: {
  contentItems: ContentListItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contentId, setContentId] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("168");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contentOptions = Object.fromEntries(
    contentItems.map((c) => [c.id, c.title]),
  );

  function resetForm() {
    setContentId("");
    setExpiresInHours("168");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!contentId) {
      setError("Bitte einen Inhalt auswählen.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/content/${contentId}/preview-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInHours: Number(expiresInHours) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Link konnte nicht erstellt werden.");
        return;
      }
      setOpen(false);
      resetForm();
      toastCreated("Der Vorschau-Link wurde erstellt.");
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
      <DialogTrigger render={<Button />}>
        <Plus />
        Link erstellen
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vorschau-Link erstellen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preview-link-content">Inhalt</Label>
            <Select
              value={contentId}
              onValueChange={(value) => setContentId(value ?? "")}
              items={contentOptions}
            >
              <SelectTrigger id="preview-link-content" className="w-full">
                <SelectValue placeholder="Inhalt wählen" />
              </SelectTrigger>
              <SelectContent>
                {contentItems.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preview-link-expiry">Gültigkeitsdauer</Label>
            <Select
              value={expiresInHours}
              onValueChange={(value) => setExpiresInHours(value ?? "168")}
              items={expiryOptions}
            >
              <SelectTrigger id="preview-link-expiry" className="w-full">
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
              {isSubmitting ? "Erstellt…" : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
