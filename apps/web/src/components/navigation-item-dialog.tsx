"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContentListItem, NavigationItemNode } from "@/lib/api-server";

const targetTypeOptions: Record<string, string> = {
  content: "Inhalt",
  external: "Externe URL",
};

export function NavigationItemDialog({
  navigationId,
  contentItems,
  parentId = null,
  item,
  trigger,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  navigationId: string;
  contentItems: ContentListItem[];
  parentId?: string | null;
  /** Vorhandener Eintrag zum Bearbeiten (PATCH) statt Anlegen (POST). */
  item?: NavigationItemNode;
  trigger?: React.ReactElement;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(item);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [label, setLabel] = useState(item?.label ?? "");
  const [targetType, setTargetType] = useState(
    item?.externalUrl ? "external" : "content",
  );
  const [contentId, setContentId] = useState(item?.contentId ?? "");
  const [externalUrl, setExternalUrl] = useState(item?.externalUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contentOptions = Object.fromEntries(
    contentItems.map((c) => [c.id, c.title]),
  );

  function resetForm() {
    setLabel(item?.label ?? "");
    setTargetType(item?.externalUrl ? "external" : "content");
    setContentId(item?.contentId ?? "");
    setExternalUrl(item?.externalUrl ?? "");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(
        isEditing
          ? `/api/navigations/${navigationId}/items/${item!.id}`
          : `/api/navigations/${navigationId}/items`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            ...(!isEditing && { parentId }),
            ...(targetType === "content"
              ? { contentId, externalUrl: null }
              : { externalUrl, contentId: null }),
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      setOpen(false);
      if (!isEditing) resetForm();
      if (isEditing) toastEdited();
      else toastCreated(`„${label}“ wurde hinzugefügt.`);
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
      {!hideTrigger && trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Menüpunkt bearbeiten" : "Menüpunkt hinzufügen"}
          </DialogTitle>
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
            <Button
              type="button"
              variant="outline"
              className="border-[#D4D4D4]"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Speichert…"
                : isEditing
                  ? "Speichern"
                  : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
