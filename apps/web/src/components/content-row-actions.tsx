"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

export function ContentRowActions({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);

  async function handleDelete() {
    await fetch(`/api/content/${id}`, { method: "DELETE" });
    router.refresh();
  }

  // Erstellt (wie `PreviewLinksDialog`) einen kurzlebigen Vorschau-Link und
  // öffnet ihn direkt in neuem Tab – Wiederverwendung desselben Endpoints,
  // kein Umweg über den Bearbeiten-Dialog nötig.
  async function handleOpenPreview() {
    setIsOpeningPreview(true);
    try {
      const res = await fetch(`/api/content/${id}/preview-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInHours: 24 }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.token) {
        window.open(`/preview/${body.token}`, "_blank");
      }
    } finally {
      setIsOpeningPreview(false);
    }
  }

  return (
    <div className="flex justify-end">
      {/* Ab md: einzelne Icons direkt in der Zeile. */}
      <div className="hidden items-center gap-1 md:flex">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Vorschau von ${title}`}
          disabled={isOpeningPreview}
          onClick={handleOpenPreview}
        >
          <Eye />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${title} bearbeiten`}
          render={<Link href={`/dashboard/content/${id}/edit`} />}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`${title} löschen`}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 />
        </Button>
      </div>

      {/* Unter md: Kebab-Menü, um in schmalen Zeilen Platz zu sparen. */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label={`Aktionen für ${title}`}
              />
            }
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isOpeningPreview} onClick={handleOpenPreview}>
              <Eye />
              Vorschau
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/dashboard/content/${id}/edit`} />}>
              <Pencil />
              Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${title}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
