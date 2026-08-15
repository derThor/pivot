"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastCreated } from "@/components/app-toast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContentListItem } from "@/lib/api-server";

const targetTypeOptions: Record<string, string> = {
  content: "Inhalt",
  external: "Externe URL",
};

export function NavigationItemDialog({
  navigationId,
  contentItems,
  parentId = null,
  trigger,
}: {
  navigationId: string;
  contentItems: ContentListItem[];
  parentId?: string | null;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [targetType, setTargetType] = useState("content");
  const [contentId, setContentId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contentOptions = Object.fromEntries(
    contentItems.map((c) => [c.id, c.title]),
  );

  function resetForm() {
    setLabel("");
    setTargetType("content");
    setContentId("");
    setExternalUrl("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/navigations/${navigationId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          parentId,
          ...(targetType === "content" ? { contentId } : { externalUrl }),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      setOpen(false);
      resetForm();
      toastCreated(`„${label}“ wurde hinzugefügt.`);
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
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Menüpunkt hinzufügen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-item-label">Label</Label>
            <Input
              id="nav-item-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-item-target-type">Ziel</Label>
            <Select
              value={targetType}
              onValueChange={(value) => setTargetType(value ?? "content")}
              items={targetTypeOptions}
            >
              <SelectTrigger id="nav-item-target-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(targetTypeOptions).map(([value, lbl]) => (
                  <SelectItem key={value} value={value}>
                    {lbl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {targetType === "content" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nav-item-content">Inhalt</Label>
              <Select
                value={contentId}
                onValueChange={(value) => setContentId(value ?? "")}
                items={contentOptions}
              >
                <SelectTrigger id="nav-item-content" className="w-full">
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
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nav-item-url">Externe URL</Label>
              <Input
                id="nav-item-url"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://…"
                required
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichert…" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
