"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastDeleted } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import type { Webhook } from "@/lib/api-server";
import { truncateMiddle } from "@/lib/utils";

const eventLabel: Record<string, string> = {
  "content.published": "Veröffentlicht",
  "content.updated": "Geändert",
};

export function WebhooksManager({ items }: { items: Webhook[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);

  async function handleToggleActive(webhook: Webhook, isActive: boolean) {
    await fetch(`/api/webhooks/${webhook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/webhooks/${deleteTarget.id}`, { method: "DELETE" });
    toastDeleted(`Webhook „${deleteTarget.url}“ wurde gelöscht.`);
    router.refresh();
  }

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>URL</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aktiv</TableHead>
            <TableHead className="text-center">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                Noch keine Webhooks registriert.
              </TableCell>
            </TableRow>
          ) : (
            items.map((webhook) => (
              <TableRow key={webhook.id}>
                <TableCell className="max-w-xs truncate font-medium">
                  {webhook.url}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="secondary">
                        {eventLabel[event] ?? event}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {webhook.lastDeliveryStatus === "failure" ? (
                    <Badge
                      className="badge--ink border-0"
                      title={webhook.lastDeliveryError ?? undefined}
                    >
                      {webhook.consecutiveFailures}×{" "}
                      {webhook.consecutiveFailures === 1
                        ? "fehlgeschlagen"
                        : "fehlgeschlagen in Folge"}
                    </Badge>
                  ) : webhook.lastDeliveryStatus === "success" ? (
                    <Badge className="badge--green border-0">Erfolgreich</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Noch keine Zustellung
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={webhook.isActive}
                    onCheckedChange={(checked) =>
                      handleToggleActive(webhook, checked)
                    }
                  />
                </TableCell>
                <TableCell>
                  <RowActionButtons
                    onDelete={() => setDeleteTarget(webhook)}
                    deleteLabel={`Webhook „${webhook.url}“ löschen`}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Webhook „${truncateMiddle(deleteTarget?.url ?? "")}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
