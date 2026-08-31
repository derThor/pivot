"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useHighlightParam } from "@/hooks/use-highlight-param";
import type { PreviewLinkWithContent } from "@/lib/api-server";
import { truncateMiddle } from "@/lib/utils";
import { bff } from "@/lib/bff";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function previewUrl(token: string) {
  return `${window.location.origin}/preview/${token}`;
}

// Zeigt nie den vollen Token in der Tabelle (Sicherheits-Gewohnheit wie
// bei API-Keys üblich, 1:1 nach Bildvorlage) – erste 4 + letzte 3 Zeichen
// reichen zum Wiedererkennen, ohne den vollständigen Token auf den
// Bildschirm zu bringen.
function maskToken(token: string) {
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}…${token.slice(-3)}`;
}

export function PreviewLinksTable({
  items,
}: {
  items: PreviewLinkWithContent[];
}) {
  const router = useRouter();
  const { activeId, query: highlightQuery } =
    useHighlightParam("preview-link-row");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editOpenId, setEditOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<PreviewLinkWithContent | null>(null);

  async function handleCopy(link: PreviewLinkWithContent) {
    await navigator.clipboard.writeText(previewUrl(link.token));
    setCopiedId(link.id);
    setTimeout(
      () => setCopiedId((current) => (current === link.id ? null : current)),
      2000,
    );
  }

  async function handleRevoke() {
    if (!deleteTarget) return;
    await fetch(
      bff(
        `/api/content/${deleteTarget.content.id}/preview-links/${deleteTarget.id}`,
      ),
      {
        method: "DELETE",
      },
    );
    toastDeleted(
      `Vorschau-Link für „${deleteTarget.content.title}“ wurde widerrufen.`,
    );
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-[10px] bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1),0_-1px_2px_0_rgba(0,0,0,0.05)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titel</TableHead>
            <TableHead>Token</TableHead>
            <TableHead>Läuft ab</TableHead>
            <TableHead>Status</TableHead>
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
            items.map((link) => {
              const isExpired = new Date(link.expiresAt) < new Date();
              return (
                <TableRow key={link.id} id={`preview-link-row-${link.id}`}>
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
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {maskToken(link.token)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormatter.format(new Date(link.expiresAt))}
                  </TableCell>
                  <TableCell>
                    {isExpired ? (
                      <Badge variant="secondary">Abgelaufen</Badge>
                    ) : (
                      <Badge className="badge--green border-0">Aktiv</Badge>
                    )}
                  </TableCell>
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
                            className="rounded-lg border-border"
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
              );
            })
          )}
        </TableBody>
      </Table>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Vorschau-Link für „${truncateMiddle(deleteTarget?.content.title ?? "")}“ widerrufen?`}
        description="Der Link funktioniert danach nicht mehr. Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Widerrufen"
        confirmingLabel="Widerruft…"
        onConfirm={handleRevoke}
      />
    </div>
  );
}
