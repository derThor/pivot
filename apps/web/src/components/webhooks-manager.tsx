"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Webhook } from "@/lib/api-server";

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
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>URL</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Aktiv</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
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
                  <Switch
                    checked={webhook.isActive}
                    onCheckedChange={(checked) =>
                      handleToggleActive(webhook, checked)
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Webhook ${webhook.url} löschen`}
                      onClick={() => setDeleteTarget(webhook)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Webhook „${deleteTarget?.url}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
      />
    </div>
  );
}
