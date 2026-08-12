"use client";

import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

export function SelectionToolbar({
  count,
  entityLabelPlural,
  onDelete,
  onClear,
  children,
}: {
  count: number;
  entityLabelPlural: string;
  onDelete: () => void | Promise<void>;
  onClear: () => void;
  /** Zusätzliche Aktions-Buttons vor "Auswahl aufheben"/Löschen (z.B. "Verschieben" bei Medien). */
  children?: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-8 py-3.5">
      <p className="text-sm font-medium">{count} ausgewählt</p>
      <div className="flex gap-2">
        {children}
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X />
          Auswahl aufheben
        </Button>
        <ConfirmDeleteDialog
          trigger={
            <Button type="button" variant="outline" size="sm">
              <Trash2 />
              {entityLabelPlural} löschen
            </Button>
          }
          title={`${count} ${entityLabelPlural} löschen?`}
          description="Diese Aktion kann nicht rückgängig gemacht werden."
          onConfirm={onDelete}
        />
      </div>
    </div>
  );
}
