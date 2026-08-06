"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { diffWords } from "diff";
import { History, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useSelection } from "@/hooks/use-selection";
import { formatName } from "@/lib/utils";
import type { ContentVersion } from "@/lib/api-server";

function stringifyValue(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function FieldDiff({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue: unknown;
  newValue: unknown;
}) {
  const oldStr = stringifyValue(oldValue);
  const newStr = stringifyValue(newValue);
  if (oldStr === newStr) return null;

  const parts = diffWords(oldStr, newStr);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="rounded-md border bg-muted/30 p-2 text-sm break-words whitespace-pre-wrap">
        {parts.map((part, index) => (
          <span
            key={index}
            className={
              part.added
                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                : part.removed
                  ? "bg-destructive/20 text-destructive line-through"
                  : undefined
            }
          >
            {part.value}
          </span>
        ))}
      </p>
    </div>
  );
}

export function ContentVersionsList({
  contentId,
  currentData,
  versions,
  richtextFields = [],
}: {
  contentId: string;
  currentData: Record<string, unknown>;
  versions: ContentVersion[];
  /** Feldnamen, die laut ContentType.schema vom Typ "richtext" sind. */
  richtextFields?: string[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { selected, toggle, toggleAll, clear, allSelected, someSelected, count } =
    useSelection(versions.map((version) => version.id));

  async function handleRollback(versionId: string) {
    await fetch(`/api/content/${contentId}/versions/${versionId}/rollback`, {
      method: "POST",
    });
    router.refresh();
  }

  async function handleDelete(versionId: string) {
    await fetch(`/api/content/${contentId}/versions/${versionId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  async function handleBulkDelete() {
    await Promise.all(
      [...selected].map((versionId) =>
        fetch(`/api/content/${contentId}/versions/${versionId}`, {
          method: "DELETE",
        }),
      ),
    );
    clear();
    router.refresh();
  }

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Versionshistorie vorhanden – sie entsteht ab der ersten
        Bearbeitung dieses Inhalts.
      </p>
    );
  }

  const fieldNames = Array.from(
    new Set([
      ...versions.flatMap((version) => Object.keys(version.data)),
      ...Object.keys(currentData),
    ]),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onCheckedChange={toggleAll}
          aria-label="Alle auswählen"
        />
        <span className="text-sm text-muted-foreground">Alle auswählen</span>
      </div>
      <SelectionToolbar
        count={count}
        entityLabelPlural="Versionen"
        onDelete={handleBulkDelete}
        onClear={clear}
      />
      {versions.map((version) => {
        const isExpanded = expandedId === version.id;
        return (
          <Card key={version.id}>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selected.has(version.id)}
                  onCheckedChange={() => toggle(version.id)}
                  aria-label="Version auswählen"
                />
                <div>
                  <p className="text-sm font-medium">
                    {new Date(version.createdAt).toLocaleString("de-DE")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bearbeitet von {formatName(version.createdBy)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedId(isExpanded ? null : version.id)}
                >
                  {isExpanded ? "Diff verbergen" : "Diff anzeigen"}
                </Button>
                <ConfirmDeleteDialog
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <History />
                      Wiederherstellen
                    </Button>
                  }
                  title="Diese Version wiederherstellen?"
                  description="Der aktuelle Stand wird vorher automatisch als neue Version gesichert – du kannst diese Aktion also selbst wieder rückgängig machen."
                  confirmLabel="Wiederherstellen"
                  confirmingLabel="Stellt wieder her…"
                  variant="default"
                  onConfirm={() => handleRollback(version.id)}
                />
                <ConfirmDeleteDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Version löschen"
                    >
                      <Trash2 />
                    </Button>
                  }
                  title="Diese Version löschen?"
                  description="Diese Aktion kann nicht rückgängig gemacht werden. Der aktuelle Inhalt ist davon nicht betroffen, nur dieser historische Stand verschwindet aus der Versionshistorie."
                  onConfirm={() => handleDelete(version.id)}
                />
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="flex flex-col gap-3">
                {fieldNames.map((field) => (
                  <div key={field} className="flex flex-col gap-2">
                    <FieldDiff
                      label={field}
                      oldValue={version.data[field]}
                      newValue={currentData[field]}
                    />
                    {richtextFields.includes(field) && (
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {field} – Vorschau (Stand dieser Version)
                        </p>
                        <RichTextEditor
                          editable={false}
                          value={
                            typeof version.data[field] === "string"
                              ? (version.data[field] as string)
                              : ""
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
