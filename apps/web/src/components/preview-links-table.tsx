"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { EditPreviewLinkDialog } from "@/components/edit-preview-link-dialog";
import { HighlightText } from "@/components/highlight-text";
import { RowActionButtons } from "@/components/row-action-buttons";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import { useSelection } from "@/hooks/use-selection";
import { formatName } from "@/lib/utils";
import type { PreviewLinkWithContent } from "@/lib/api-server";

function previewUrl(token: string) {
  return `${window.location.origin}/preview/${token}`;
}

export function PreviewLinksTable({
  items,
}: {
  items: PreviewLinkWithContent[];
}) {
  const router = useRouter();
  const { activeId, query: highlightQuery } = useHighlightParam(
    "preview-link-row",
  );
  const { selected, toggle, toggleAll, clear, allSelected, someSelected, count } =
    useSelection(items.map((item) => item.id));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editOpenId, setEditOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PreviewLinkWithContent | null>(
    null,
  );

  const byId = new Map(items.map((item) => [item.id, item]));

  async function handleCopy(link: PreviewLinkWithContent) {
    await navigator.clipboard.writeText(previewUrl(link.token));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId((current) => (current === link.id ? null : current)), 2000);
  }

  async function revokeLink(link: PreviewLinkWithContent) {
    await fetch(`/api/content/${link.content.id}/preview-links/${link.id}`, {
      method: "DELETE",
    });
  }

  async function handleRevoke() {
    if (!deleteTarget) return;
    await revokeLink(deleteTarget);
    toastDeleted(`Vorschau-Link für „${deleteTarget.content.title}“ wurde widerrufen.`);
    router.refresh();
  }

  async function handleBulkDelete() {
    const revokedCount = selected.size;
    await Promise.all(
      [...selected]
        .map((id) => byId.get(id))
        .filter((link): link is PreviewLinkWithContent => Boolean(link))
        .map((link) => revokeLink(link)),
    );
    clear();
    toastDeleted(`${revokedCount} Vorschau-Links wurden widerrufen.`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectionToolbar
        count={count}
        entityLabelPlural="Vorschau-Links"
        onDelete={handleBulkDelete}
        onClear={clear}
      />
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Alle auswählen"
                />
              </TableHead>
              <TableHead>Inhalt</TableHead>
              <TableHead>Läuft ab</TableHead>
              <TableHead>Erstellt von</TableHead>
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
                  Keine aktiven Vorschau-Links.
                </TableCell>
              </TableRow>
            ) : (
              items.map((link) => (
                <TableRow key={link.id} id={`preview-link-row-${link.id}`}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(link.id)}
                      onCheckedChange={() => toggle(link.id)}
                      aria-label={`Vorschau-Link für ${link.content.title} auswählen`}
                    />
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-medium">
                    <Link
                      href={`/dashboard/content/${link.content.id}/edit`}
                      className="hover:underline"
                    >
                      <HighlightText
                        text={link.content.title}
                        query={highlightQuery}
                        active={activeId === link.id}
                      />
                    </Link>
                  </TableCell>
                  <TableCell>
                    {new Date(link.expiresAt).toLocaleString("de-DE")}
                  </TableCell>
                  <TableCell>{formatName(link.createdBy)}</TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <RowActionButtons
                        onEdit={() => setEditOpenId(link.id)}
                        onDelete={() => setDeleteTarget(link)}
                        editLabel={`Vorschau-Link für „${link.content.title}“ bearbeiten`}
                        deleteLabel={`Vorschau-Link für „${link.content.title}“ widerrufen`}
                        extra={
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-lg border-[#D4D4D4]"
                            onClick={() => handleCopy(link)}
                            aria-label={`Link für „${link.content.title}“ kopieren`}
                          >
                            {copiedId === link.id ? <Check /> : <Copy />}
                          </Button>
                        }
                      />
                      <EditPreviewLinkDialog
                        link={link}
                        hideTrigger
                        open={editOpenId === link.id}
                        onOpenChange={(next) =>
                          setEditOpenId(next ? link.id : null)
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Vorschau-Link für „${deleteTarget?.content.title}“ widerrufen?`}
        description="Der Link funktioniert danach nicht mehr. Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Widerrufen"
        confirmingLabel="Widerruft…"
        onConfirm={handleRevoke}
      />
    </div>
  );
}
