"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { formatName } from "@/lib/utils";
import {
  describeSettingsFieldChange,
  SETTINGS_ACTION_LABELS,
} from "@/lib/settings-change-labels";
import type {
  SettingsChangeEntry,
  SettingsChangesResponse,
} from "@/lib/api-server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "Protokoll"-Tab unter Einstellungen (Nutzervorgabe, 2026-08-22: "baue
 * protokolierung", 1:1 nach Bildvorlage) – gleiches Muster wie die
 * "Letzte Änderungen"-Karte auf der Firma-Seite (company-view.tsx),
 * aber mit echter Server-Pagination statt festem Limit=5, da hier über
 * die Zeit deutlich mehr Einträge zusammenkommen können. */
export function SettingsProtocolCard({
  changes,
}: {
  changes: SettingsChangesResponse | null;
}) {
  const router = useRouter();
  const items = changes?.items ?? [];
  const [deleteTarget, setDeleteTarget] = useState<SettingsChangeEntry | null>(
    null,
  );
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/settings/changes/${deleteTarget.id}`, {
      method: "DELETE",
    });
    toastDeleted("Eintrag wurde gelöscht.");
    setDeleteTarget(null);
    router.refresh();
  }

  async function handleDeleteAll() {
    await fetch("/api/settings/changes", { method: "DELETE" });
    toastDeleted("Alle Einträge wurden gelöscht.");
    router.refresh();
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Letzte Änderungen an den Einstellungen</CardTitle>
        <CardAction>
          <ConfirmDeleteDialog
            open={confirmAllOpen}
            onOpenChange={setConfirmAllOpen}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border"
                disabled={items.length === 0}
              >
                Alle löschen
              </Button>
            }
            title={`${changes?.meta.total ?? items.length} Einträge endgültig löschen?`}
            description="Diese Aktion kann nicht rückgängig gemacht werden."
            onConfirm={handleDeleteAll}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Änderungen erfasst.
          </p>
        ) : (
          <ol className="flex flex-col">
            {items.map((change, index) => {
              const field = change.metadata?.field ?? "";
              const title = field
                ? describeSettingsFieldChange(field, change.metadata?.after)
                : (SETTINGS_ACTION_LABELS[change.action] ?? change.action);
              const isLast = index === items.length - 1;
              return (
                <li key={change.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={
                        index === 0
                          ? "mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                          : "mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/30"
                      }
                    />
                    {!isLast && <span className="w-px flex-1 bg-pivot-line2" />}
                  </div>
                  <div
                    className={`flex flex-1 items-start justify-between gap-2 ${isLast ? "pb-0" : "pb-4"}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatName(change.user)} ·{" "}
                        {formatDate(change.createdAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-lg border-border text-destructive hover:bg-destructive/5"
                      aria-label="Eintrag löschen"
                      onClick={() => setDeleteTarget(change)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {changes && (
          <PaginationControls
            page={changes.meta.page}
            pageCount={changes.meta.pageCount}
            buildHref={(p) => `?protocolPage=${p}`}
          />
        )}
      </CardContent>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eintrag endgültig löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </Card>
  );
}
