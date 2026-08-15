"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileText,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";

import { toastDeleted } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { NavigationItemDialog } from "@/components/navigation-item-dialog";
import { cn } from "@/lib/utils";
import type { ContentListItem, NavigationItemNode } from "@/lib/api-server";

function flatten(nodes: NavigationItemNode[]): NavigationItemNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

export function NavigationItemsEditor({
  navigationId,
  items,
  contentItems,
}: {
  navigationId: string;
  items: NavigationItemNode[];
  contentItems: ContentListItem[];
}) {
  const router = useRouter();
  const all = flatten(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NavigationItemNode | null>(
    null,
  );

  async function persistReorder(
    reorderItems: { id: string; parentId: string | null; sortOrder: number }[],
  ) {
    await fetch(`/api/navigations/${navigationId}/items/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: reorderItems }),
    });
    router.refresh();
  }

  async function handleDropOnto(targetId: string) {
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const target = all.find((node) => node.id === targetId);
    if (!target) return;
    await persistReorder([
      { id: draggedId, parentId: targetId, sortOrder: target.children.length },
    ]);
    setDraggedId(null);
  }

  async function handleDropOnRoot() {
    setIsRootDragOver(false);
    if (!draggedId) return;
    await persistReorder([{ id: draggedId, parentId: null, sortOrder: items.length }]);
    setDraggedId(null);
  }

  async function moveWithinSiblings(node: NavigationItemNode, direction: -1 | 1) {
    const siblings = node.parentId
      ? (all.find((n) => n.id === node.parentId)?.children ?? [])
      : items;
    const index = siblings.findIndex((s) => s.id === node.id);
    const swapWith = siblings[index + direction];
    if (!swapWith) return;
    await persistReorder([
      { id: node.id, parentId: node.parentId, sortOrder: swapWith.sortOrder },
      { id: swapWith.id, parentId: swapWith.parentId, sortOrder: node.sortOrder },
    ]);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/navigations/${navigationId}/items/${deleteTarget.id}`, {
      method: "DELETE",
    });
    toastDeleted(`Menüpunkt „${deleteTarget.label}“ wurde gelöscht.`);
    router.refresh();
  }

  function renderNode(node: NavigationItemNode, depth: number) {
    return (
      <div key={node.id}>
        <div
          draggable
          onDragStart={() => setDraggedId(node.id)}
          onDragEnd={() => {
            setDraggedId(null);
            setDragOverId(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(node.id);
          }}
          onDragLeave={() =>
            setDragOverId((current) => (current === node.id ? null : current))
          }
          onDrop={(e) => {
            e.preventDefault();
            void handleDropOnto(node.id);
          }}
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-card transition-colors",
            dragOverId === node.id &&
              draggedId !== node.id &&
              "border-orange-400 bg-orange-50 dark:bg-orange-500/10",
          )}
          style={{ marginLeft: depth * 28 }}
        >
          <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
          {node.content ? (
            <FileText className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{node.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {node.content ? `/${node.content.slug}` : node.externalUrl}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${node.label} nach oben verschieben`}
              onClick={() => moveWithinSiblings(node, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${node.label} nach unten verschieben`}
              onClick={() => moveWithinSiblings(node, 1)}
            >
              <ArrowDown />
            </Button>
            <NavigationItemDialog
              navigationId={navigationId}
              contentItems={contentItems}
              parentId={node.id}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Untereintrag zu ${node.label} hinzufügen`}
                >
                  <Plus />
                </Button>
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${node.label} löschen`}
              onClick={() => setDeleteTarget(node)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
        {node.children.length > 0 && (
          <div className="mt-1 flex flex-col gap-1">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsRootDragOver(true);
        }}
        onDragLeave={() => setIsRootDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          void handleDropOnRoot();
        }}
        className={cn(
          "rounded-lg border border-dashed px-3 py-2 text-center text-xs text-muted-foreground transition-colors",
          isRootDragOver && "border-orange-400 bg-orange-50 dark:bg-orange-500/10",
        )}
      >
        Hierher ziehen, um auf die oberste Ebene zu verschieben
      </div>
      <div className="flex flex-col gap-1">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Einträge vorhanden.
          </p>
        ) : (
          items.map((node) => renderNode(node, 0))
        )}
      </div>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Menüpunkt „${deleteTarget?.label}“ löschen?`}
        description="Untereinträge dieses Punkts werden dabei nicht gelöscht, sondern rücken auf die oberste Ebene."
        onConfirm={handleDelete}
      />
    </div>
  );
}
