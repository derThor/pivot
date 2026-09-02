"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import { truncateMiddle } from "@/lib/utils";
import { bff } from "@/lib/bff";

export function ContentRowActions({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    await fetch(bff(`/api/content/${id}`), { method: "DELETE" });
    toastDeleted(`„${title}“ wurde gelöscht.`);
    router.refresh();
  }

  return (
    <div className="flex justify-center">
      <RowActionButtons
        onEdit={() => router.push(`/dashboard/content/${id}/edit`)}
        onDelete={() => setDeleteOpen(true)}
        editLabel={`„${title}“ bearbeiten`}
        deleteLabel={`„${title}“ löschen`}
        extra={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg border-button-border"
            // Öffnet die Seite in der öffentlichen Website statt in der
            // Backend-Vorschau (Nutzervorgabe, 2026-09-02). Die BFF-Route
            // stellt dafür einen kurzlebigen Vorschau-Token aus – dessen
            // Ausstellen verlangt `preview-links:create`, damit auch
            // unveröffentlichte Seiten nicht für jeden sichtbar werden.
            //
            // Bewusst ein Link statt `window.open()` nach einem `fetch`:
            // das würde der Popup-Blocker abfangen. Und bewusst ein rohes
            // `<a>` mit `bff()` statt `<Link>` – `<Link>` setzt den
            // `basePath` selbst davor, zusammen mit `bff()` wurde daraus
            // `/admin/admin/api/…` und damit eine 404 (siehe Kommentar in
            // lib/bff.ts, der genau davor warnt).
            render={
              <a
                href={bff(`/api/content/${id}/frontend-preview`)}
                target="_blank"
                rel="noopener"
              />
            }
            aria-label={`„${title}“ im Frontend ansehen`}
          >
            <Eye />
          </Button>
        }
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`„${truncateMiddle(title)}“ löschen?`}
        description="Wird in den Papierkorb verschoben und kann von dort wiederhergestellt werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
