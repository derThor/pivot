"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { formatName } from "@/lib/utils";
import type { PreviewLink } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const expiryOptions: Record<string, string> = {
  "24": "1 Tag",
  "168": "7 Tage",
  "720": "30 Tage",
};

function previewUrl(token: string) {
  return `${window.location.origin}/preview/${token}`;
}

export function PreviewLinksDialog({ contentId }: { contentId: string }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<PreviewLink[] | null>(null);
  const [expiresInHours, setExpiresInHours] = useState("168");
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingExpiry, setEditingExpiry] = useState("168");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLinks() {
    const res = await fetch(bff(`/api/content/${contentId}/preview-links`));
    const data = await res.json().catch(() => null);
    setLinks(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (open) {
      setError(null);
      setEditingId(null);
      loadLinks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleCreate() {
    setError(null);
    setIsCreating(true);
    try {
      const res = await fetch(bff(`/api/content/${contentId}/preview-links`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInHours: Number(expiresInHours) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? "Link konnte nicht erstellt werden.");
        return;
      }
      await loadLinks();
      await handleCopy(body.id, body.token);
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(linkId: string) {
    await fetch(bff(`/api/content/${contentId}/preview-links/${linkId}`), {
      method: "DELETE",
    });
    await loadLinks();
  }

  async function handleCopy(linkId: string, token: string) {
    await navigator.clipboard.writeText(previewUrl(token));
    setCopiedId(linkId);
    setTimeout(
      () => setCopiedId((current) => (current === linkId ? null : current)),
      2000,
    );
  }

  function startEdit(link: PreviewLink) {
    setError(null);
    setEditingId(link.id);
    setEditingExpiry("168");
  }

  async function handleSaveEdit(linkId: string) {
    setIsSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(
        bff(`/api/content/${contentId}/preview-links/${linkId}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInHours: Number(editingExpiry) }),
        },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? "Link konnte nicht aktualisiert werden.");
        return;
      }
      setEditingId(null);
      await loadLinks();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="bg-card" />}>
        <Link2 />
        Vorschau-Link
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vorschau-Links</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
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
            <Button type="button" disabled={isCreating} onClick={handleCreate}>
              {isCreating ? "Erstellt…" : "Neuen Link erstellen"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Aktive Links</p>
            <p className="text-xs text-muted-foreground">
              Links können jederzeit erneut kopiert oder in ihrer
              Gültigkeitsdauer verlängert werden.
            </p>
            {links === null ? (
              <p className="text-sm text-muted-foreground">Lädt…</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine aktiven Links.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p>
                          Läuft ab:{" "}
                          {new Date(link.expiresAt).toLocaleString("de-DE")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Erstellt von {formatName(link.createdBy)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Link kopieren"
                          onClick={() => handleCopy(link.id, link.token)}
                        >
                          {copiedId === link.id ? <Check /> : <Copy />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Gültigkeitsdauer bearbeiten"
                          onClick={() =>
                            editingId === link.id
                              ? setEditingId(null)
                              : startEdit(link)
                          }
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Link widerrufen"
                          onClick={() => handleRevoke(link.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>

                    {editingId === link.id && (
                      <div className="flex items-end gap-2 border-t pt-2">
                        <div className="flex flex-1 flex-col gap-1">
                          <Label
                            htmlFor={`edit-expiry-${link.id}`}
                            className="text-xs"
                          >
                            Neue Gültigkeitsdauer (ab jetzt)
                          </Label>
                          <Select
                            value={editingExpiry}
                            onValueChange={(value) =>
                              setEditingExpiry(value ?? "168")
                            }
                            items={expiryOptions}
                          >
                            <SelectTrigger
                              id={`edit-expiry-${link.id}`}
                              className="w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(expiryOptions).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label="Speichern"
                          disabled={isSavingEdit}
                          onClick={() => handleSaveEdit(link.id)}
                        >
                          <Check />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Abbrechen"
                          onClick={() => setEditingId(null)}
                        >
                          <X />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
