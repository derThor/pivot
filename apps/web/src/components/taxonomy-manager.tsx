"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { slugify } from "@/lib/utils";
import type { TaxonomyItem } from "@/lib/api-server";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

export function TaxonomyManager({
  title,
  apiPath,
  items,
}: {
  title: string;
  apiPath: "categories" | "tags";
  items: TaxonomyItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/${apiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht angelegt werden.");
        return;
      }

      setName("");
      setSlug("");
      setSlugTouched(false);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/${apiPath}/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />
          <Input
            placeholder="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
          />
          <Button type="submit" disabled={isSubmitting} className="shrink-0">
            <Plus />
            Anlegen
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Einträge vorhanden.
            </p>
          ) : (
            items.map((item) => (
              <Badge key={item.id} variant="secondary" className="gap-1 pr-1">
                {item.name}
                <ConfirmDeleteDialog
                  trigger={
                    <button
                      type="button"
                      className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                      aria-label={`${item.name} löschen`}
                    >
                      <X className="size-3" />
                    </button>
                  }
                  title={`„${item.name}“ löschen?`}
                  description="Diese Aktion kann nicht rückgängig gemacht werden."
                  onConfirm={() => handleDelete(item.id)}
                />
              </Badge>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
