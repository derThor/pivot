"use client";

import { useRouter } from "next/navigation";
import { FolderInput } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HighlightText } from "@/components/highlight-text";
import { MediaCardActions } from "@/components/media-card-actions";
import { MediaPreviewDialog } from "@/components/media-preview-dialog";
import { MoveToFolderDialog } from "@/components/move-to-folder-dialog";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useSelection } from "@/hooks/use-selection";
import { useHighlightParam } from "@/hooks/use-highlight-param";
import { formatBytes } from "@/lib/utils";
import type { MediaFolder, MediaItem } from "@/lib/api-server";

export function MediaGrid({
  items,
  folders = [],
}: {
  items: MediaItem[];
  folders?: MediaFolder[];
}) {
  const router = useRouter();
  const { activeId, query: highlightQuery } = useHighlightParam("media-item");
  const { selected, toggle, toggleAll, clear, allSelected, someSelected, count } =
    useSelection(items.map((item) => item.id));

  async function handleBulkDelete() {
    await Promise.all(
      [...selected].map((id) => fetch(`/api/media/${id}`, { method: "DELETE" })),
    );
    clear();
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
        Noch keine Medien vorhanden.
      </div>
    );
  }

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
        entityLabelPlural="Medien"
        onDelete={handleBulkDelete}
        onClear={clear}
      >
        <MoveToFolderDialog
          trigger={
            <Button type="button" variant="outline" size="sm">
              <FolderInput />
              Verschieben
            </Button>
          }
          folders={folders}
          mediaIds={[...selected]}
          onSuccess={clear}
        />
      </SelectionToolbar>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((item) => (
          <figure
            key={item.id}
            id={`media-item-${item.id}`}
            className="relative flex flex-col gap-2 overflow-hidden rounded-2xl bg-card shadow-card"
          >
            <Checkbox
              checked={selected.has(item.id)}
              onCheckedChange={() => toggle(item.id)}
              aria-label={`${item.filename} auswählen`}
              className="absolute top-2 left-2 z-10 bg-background"
            />
            <MediaPreviewDialog item={item} />
            <figcaption className="flex flex-col gap-1 px-4 pb-4">
              <span className="truncate text-xs font-medium">
                <HighlightText
                  text={item.filename}
                  query={highlightQuery}
                  active={activeId === item.id}
                />
              </span>
              <span className="text-xs text-muted-foreground">
                {formatBytes(item.size)}
              </span>
              <MediaCardActions item={item} folders={folders} />
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
