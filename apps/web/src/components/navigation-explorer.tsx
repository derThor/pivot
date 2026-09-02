"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GripVertical,
  House,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  toastDeleted,
  toastEdited,
  toastWarning,
} from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavigationDialog } from "@/components/navigation-dialog";
import { NavigationItemDialog } from "@/components/navigation-item-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, truncateMiddle } from "@/lib/utils";
import { bff } from "@/lib/bff";
import type {
  CategoryListItem,
  ContentListItem,
  NavigationDetail,
  NavigationItemNode,
  NavigationSummary,
} from "@/lib/api-server";

function flatten(nodes: NavigationItemNode[]): NavigationItemNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/** Anzeigepfad in der Menü-Liste. Kategorien zeigen auf ihre Übersichtsseite
 * (`/{slug}`, seit 2026-09-02). */
function entryPath(node: NavigationItemNode): string {
  if (node.content) return `/${node.content.slug}`;
  if (node.category) return `/${node.category.slug}`;
  return node.externalUrl ?? "";
}

/** Menü-Übersicht + Einträge auf einer Seite (Nutzervorgabe, 2026-08-16,
 * 1:1 nach Bildvorlage) – ersetzt die bisherige Zwei-Seiten-Struktur
 * (Tabellen-Liste + eigene Detailseite `/dashboard/navigation/[id]`):
 * links Menü-Umschalter (URL-getrieben per `?menu=`, analog zum
 * Ordner-Muster bei Medien), rechts die Einträge des ausgewählten Menüs
 * direkt sichtbar. Reihenfolge weiterhin per Drag&Drop (Grip-Handle),
 * die bisherigen Auf/Ab-Buttons entfallen (kommen in der Bildvorlage
 * nicht vor, Drag&Drop deckt denselben Bedarf ab). */
export function NavigationExplorer({
  menus,
  selectedMenuId,
  navigation,
  contentItems,
  categoryItems,
}: {
  menus: NavigationSummary[];
  selectedMenuId: string | null;
  navigation: NavigationDetail | null;
  contentItems: ContentListItem[];
  categoryItems: CategoryListItem[];
}) {
  const router = useRouter();
  const all = navigation ? flatten(navigation.items) : [];
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<
    "before" | "nest" | "after" | null
  >(null);
  const [editItem, setEditItem] = useState<NavigationItemNode | null>(null);
  const [deleteItem, setDeleteItem] = useState<NavigationItemNode | null>(null);
  // Mobil (Nutzervorgabe): die drei Zeilen-Aktionen (Untereintrag
  // hinzufügen/Bearbeiten/Löschen) sprengten bei schmalen Viewports die
  // Karte – dort ein einzelnes "..."-Menü statt der einzeln sichtbaren
  // Icon-Buttons. Braucht eine eigene kontrollierte Dialog-Instanz für
  // "Untereintrag hinzufügen", da der Button dafür sonst seinen eigenen,
  // unkontrollierten Trigger mitbringt (siehe `NavigationItemDialog`
  // unten in `renderNode`).
  const [addChildTarget, setAddChildTarget] =
    useState<NavigationItemNode | null>(null);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [deleteMenuOpen, setDeleteMenuOpen] = useState(false);

  // Geschwister-Liste einer Ebene (oberste Ebene = `navigation.items`,
  // sonst die `children` des jeweiligen Elternknotens).
  function siblingsOf(parentId: string | null): NavigationItemNode[] {
    if (!navigation) return [];
    if (parentId === null) return navigation.items;
    return all.find((n) => n.id === parentId)?.children ?? [];
  }

  async function persistReorder(
    reorderItems: { id: string; parentId: string | null; sortOrder: number }[],
  ) {
    if (!navigation) return;
    await fetch(bff(`/api/navigations/${navigation.id}/items/reorder`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: reorderItems }),
    });
    router.refresh();
  }

  /** Reihenfolge/Ebene per Drag&Drop ändern (Nutzervorgabe, 2026-08-16,
   * zunächst nur "vor/nach dem Ziel" – dann Nutzer-Korrektur "ich kann
   * keine Links mehr verschachteln"): drei Drop-Zonen pro Zeile (wie bei
   * Notion/VS-Code-Explorer) – oberes Viertel = davor einsortieren,
   * mittlerer Bereich = als Unterpunkt verschachteln (Original-
   * Verhalten, per Grip-Drag), unteres Viertel = danach einsortieren.
   * Sendet die komplette neue Geschwister-Liste (nicht nur den
   * verschobenen Punkt) an `reorderItems`, da der Reorder-Endpoint
   * `sortOrder` 1:1 übernimmt, statt automatisch um eingefügte Punkte
   * herum zu verschieben. */
  async function handleDropOnSibling(
    target: NavigationItemNode,
    position: "before" | "after",
  ) {
    setDragOverId(null);
    setDragOverPosition(null);
    if (!draggedId || draggedId === target.id) {
      setDraggedId(null);
      return;
    }
    const draggedNode = all.find((n) => n.id === draggedId);
    if (!draggedNode) {
      setDraggedId(null);
      return;
    }
    const siblings = siblingsOf(target.parentId).filter(
      (n) => n.id !== draggedId,
    );
    const targetIndex = siblings.findIndex((n) => n.id === target.id);
    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    siblings.splice(insertIndex, 0, draggedNode);
    await persistReorder(
      siblings.map((node, index) => ({
        id: node.id,
        parentId: target.parentId,
        sortOrder: index,
      })),
    );
    setDraggedId(null);
  }

  async function handleDropNest(target: NavigationItemNode) {
    setDragOverId(null);
    setDragOverPosition(null);
    if (!draggedId || draggedId === target.id) {
      setDraggedId(null);
      return;
    }
    const draggedNode = all.find((n) => n.id === draggedId);
    if (!draggedNode) {
      setDraggedId(null);
      return;
    }
    const children = target.children.filter((n) => n.id !== draggedId);
    children.push(draggedNode);
    await persistReorder(
      children.map((node, index) => ({
        id: node.id,
        parentId: target.id,
        sortOrder: index,
      })),
    );
    setDraggedId(null);
  }

  /** Startseite der öffentlichen Website setzen/aufheben (Nutzervorgabe,
   * 2026-08-31: "unter Menü auf einem Menüpunkt setzen … nur einmal
   * vergeben"). Die Exklusivität macht der Server – beim Setzen wird der
   * bisherige Punkt automatisch abgewählt, das Neuladen zeigt das Badge
   * danach nur noch an der neuen Stelle. */
  async function handleToggleHomepage(node: NavigationItemNode) {
    if (!navigation) return;
    const next = !node.isHomepage;
    const res = await fetch(
      bff(`/api/navigations/${navigation.id}/items/${node.id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHomepage: next }),
      },
    );
    if (!res.ok) {
      toastWarning(
        "Startseite konnte nicht gesetzt werden.",
        "Nur ein Menüpunkt mit Inhalts-Ziel kann die Startseite sein.",
      );
      return;
    }
    toastEdited(
      next
        ? `„${node.label}“ ist jetzt die Startseite.`
        : `„${node.label}“ ist nicht mehr die Startseite.`,
    );
    router.refresh();
  }

  async function handleDeleteItem() {
    if (!deleteItem || !navigation) return;
    await fetch(
      bff(`/api/navigations/${navigation.id}/items/${deleteItem.id}`),
      {
        method: "DELETE",
      },
    );
    toastDeleted(`Menüpunkt „${deleteItem.label}“ wurde gelöscht.`);
    router.refresh();
  }

  async function handleDeleteMenu() {
    if (!navigation) return;
    await fetch(bff(`/api/navigations/${navigation.id}`), { method: "DELETE" });
    toastDeleted(`Menü „${navigation.name}“ wurde gelöscht.`);
    router.push("/dashboard/navigation");
  }

  function renderNode(node: NavigationItemNode) {
    if (!navigation) return null;
    const isDragOver = dragOverId === node.id && draggedId !== node.id;
    return (
      <div key={node.id} className="flex flex-col gap-1">
        <div
          draggable
          onDragStart={() => setDraggedId(node.id)}
          onDragEnd={() => {
            setDraggedId(null);
            setDragOverId(null);
            setDragOverPosition(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientY - rect.top) / rect.height;
            const position =
              ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "nest";
            setDragOverId(node.id);
            setDragOverPosition(position);
          }}
          onDragLeave={() =>
            setDragOverId((current) => (current === node.id ? null : current))
          }
          onDrop={(e) => {
            e.preventDefault();
            const position = dragOverPosition ?? "nest";
            if (position === "nest") void handleDropNest(node);
            else void handleDropOnSibling(node, position);
          }}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-border bg-muted px-4 py-3 transition-colors",
            isDragOver &&
              dragOverPosition === "before" &&
              "border-t-2 border-t-primary",
            isDragOver &&
              dragOverPosition === "after" &&
              "border-b-2 border-b-primary",
            isDragOver &&
              dragOverPosition === "nest" &&
              "border-primary bg-primary/10 ring-1 ring-primary",
          )}
        >
          <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {node.label}
          </p>
          {node.isHomepage && (
            <Badge
              variant="secondary"
              className="badge--lime border-0"
              title="Startseite der öffentlichen Website"
            >
              Startseite
            </Badge>
          )}
          <span className="hidden min-w-0 shrink truncate text-xs text-muted-foreground sm:inline">
            {entryPath(node)}
          </span>
          {/* Ab `sm` die drei Icon-Buttons wie gehabt, darunter (Nutzervorgabe)
              ein einzelnes "..."-Menü statt der einzeln sichtbaren Buttons –
              die sprengten bei schmalen Viewports zusammen mit Label/Pfad
              die Karte nach rechts hinaus. */}
          <RowActionButtons
            size="icon-sm"
            className="hidden sm:flex"
            onEdit={() => setEditItem(node)}
            onDelete={() => setDeleteItem(node)}
            editLabel={`„${node.label}“ bearbeiten`}
            deleteLabel={`„${node.label}“ löschen`}
            tooltips
            extra={
              <>
                {node.content && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className={cn(
                            "rounded-lg border-button-border",
                            node.isHomepage && "bg-primary/15",
                          )}
                          onClick={() => void handleToggleHomepage(node)}
                          aria-label={
                            node.isHomepage
                              ? `„${node.label}“ ist die Startseite – Markierung entfernen`
                              : `„${node.label}“ als Startseite festlegen`
                          }
                        />
                      }
                    >
                      <House />
                    </TooltipTrigger>
                    <TooltipContent>
                      {node.isHomepage
                        ? "Ist die Startseite – klicken zum Aufheben"
                        : "Als Startseite festlegen"}
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* Nutzt dieselbe kontrollierte Dialog-Instanz wie der
                    mobile "…"-Eintrag (`addChildTarget`) statt eines
                    eigenen Dialog-Triggers – ein Trigger-Button lässt sich
                    sonst nicht zusätzlich in einen Tooltip einhängen. */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="rounded-lg border-button-border"
                        onClick={() => setAddChildTarget(node)}
                        aria-label={`Untereintrag zu „${node.label}“ hinzufügen`}
                      />
                    }
                  >
                    <Plus />
                  </TooltipTrigger>
                  <TooltipContent>Untereintrag hinzufügen</TooltipContent>
                </Tooltip>
              </>
            }
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-lg border-button-border sm:hidden"
                  aria-label={`Aktionen für „${node.label}“`}
                />
              }
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setAddChildTarget(node)}>
                <Plus />
                Untereintrag hinzufügen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditItem(node)}>
                <Pencil />
                Bearbeiten
              </DropdownMenuItem>
              {node.content && (
                <DropdownMenuItem
                  onClick={() => void handleToggleHomepage(node)}
                >
                  <House />
                  {node.isHomepage
                    ? "Startseite aufheben"
                    : "Als Startseite festlegen"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteItem(node)}
              >
                <Trash2 />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {node.children.length > 0 && (
          // Verschachtelte Einträge visuell als eigene Gruppe erkennbar
          // machen (Nutzervorgabe, 2026-08-16: "Verschachtelung sichtbarer
          // machen", dann "die linie muss runter und dann nach rechts zum
          // menüpunkt", dann "wenn kein weiteres menü, dann sollen die
          // striche nicht weiter runter gehen") – echte Baum-Verbindung
          // pro Kind-Zeile statt einer durchgehenden Linie auf dem
          // gemeinsamen Wrapper: die vertikale Linie läuft bei allen außer
          // dem letzten Kind komplett runter (verbindet zum nächsten
          // Geschwister), beim letzten Kind nur bis zur Zeilenmitte (wo der
          // horizontale Abzweig ansetzt) – sonst würde die Linie sichtbar
          // über den letzten Punkt hinaus ins Leere weiterlaufen.
          <div className="ml-5 flex flex-col gap-1 pl-4">
            {node.children.map((child, index) => {
              const isLast = index === node.children.length - 1;
              return (
                <div key={child.id} className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-4 top-0 w-0.5 border-l-2 border-dashed border-muted-foreground/50",
                      isLast ? "h-1/2" : "h-full",
                    )}
                  />
                  <span
                    aria-hidden
                    className="absolute top-1/2 -left-4 h-0.5 w-4 -translate-y-1/2 border-t-2 border-dashed border-muted-foreground/50"
                  />
                  {renderNode(child)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="overflow-hidden rounded-[10px] bg-card shadow-sm lg:w-72 lg:shrink-0 lg:self-start">
        <p className="border-b border-border py-5 pr-4 pl-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Menüs · {menus.length}
        </p>
        <div className="flex flex-col divide-y divide-border">
          {menus.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">
              Noch keine Menüs vorhanden.
            </p>
          ) : (
            menus.map((menu) => {
              const active = menu.id === selectedMenuId;
              return (
                <Link
                  key={menu.id}
                  href={`/dashboard/navigation?menu=${menu.id}`}
                  className={cn(
                    "flex flex-col gap-0.5 border-l-4 px-4 py-5 text-sm transition-colors",
                    active
                      ? "border-l-primary bg-primary/15"
                      : "border-l-transparent hover:bg-muted/50",
                  )}
                >
                  <span className="truncate font-medium">{menu.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {menu._count.items}{" "}
                    {menu._count.items === 1 ? "Eintrag" : "Einträge"}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 rounded-[10px] bg-card p-6 shadow-sm">
        {!navigation ? (
          <p className="text-sm text-muted-foreground">
            Wähle links ein Menü aus oder lege ein neues an.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="min-w-0 truncate text-sm font-semibold">
                {navigation.name}{" "}
                <span className="font-normal text-muted-foreground">
                  · Einträge
                </span>
              </h2>
              <RowActionButtons
                size="icon-sm"
                onEdit={() => setEditMenuOpen(true)}
                onDelete={() => setDeleteMenuOpen(true)}
                editLabel={`Menü „${navigation.name}“ bearbeiten`}
                deleteLabel={`Menü „${navigation.name}“ löschen`}
              />
            </div>

            {/* Kein separates "auf oberste Ebene ziehen"-Drop-Feld mehr
                (Nutzervorgabe, 2026-08-16: "einfach zwischen den äußersten
                menüs ziehen und dann ist es auf erster ebene und
                gleichzeitig sortiert") – das obere/untere Viertel jeder
                Top-Level-Zeile deckt das bereits ab: `handleDropOnSibling`
                übernimmt dort automatisch `target.parentId` (bei
                Top-Level-Zeilen `null`), verschachtelte Punkte lassen sich
                also einfach zwischen zwei oberste-Ebene-Punkte ziehen, um
                gleichzeitig auf die oberste Ebene UND an die richtige
                Position zu wandern. Ein eigenes Ein-/Ausblenden-Element war
                zusätzlich unnötiges Risiko (siehe Reflow-Drag-Abbruch-Bug
                oben). */}
            <div className="flex flex-col gap-1">
              {navigation.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Einträge vorhanden.
                </p>
              ) : (
                navigation.items.map((node) => renderNode(node))
              )}
            </div>

            <NavigationItemDialog
              navigationId={navigation.id}
              contentItems={contentItems}
              categoryItems={categoryItems}
              trigger={
                <button
                  type="button"
                  className="flex w-fit items-center gap-2 rounded-xl border border-dashed border-button-border px-4 py-2.5 text-[12.5px] font-medium text-pivot-g-body transition hover:border-primary hover:text-foreground"
                >
                  <Plus className="size-4" />
                  Eintrag hinzufügen
                </button>
              }
            />
          </div>
        )}

        {navigation && (
          <>
            <NavigationDialog
              navigation={navigation}
              hideTrigger
              open={editMenuOpen}
              onOpenChange={setEditMenuOpen}
            />
            <ConfirmDeleteDialog
              open={deleteMenuOpen}
              onOpenChange={setDeleteMenuOpen}
              title={`Menü „${truncateMiddle(navigation.name)}“ löschen?`}
              description="Alle Einträge dieses Menüs werden mitgelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
              onConfirm={handleDeleteMenu}
            />
          </>
        )}
      </div>

      {navigation && editItem && (
        <NavigationItemDialog
          navigationId={navigation.id}
          contentItems={contentItems}
          categoryItems={categoryItems}
          item={editItem}
          hideTrigger
          open={editItem !== null}
          onOpenChange={(next) => !next && setEditItem(null)}
        />
      )}

      {navigation && addChildTarget && (
        <NavigationItemDialog
          navigationId={navigation.id}
          contentItems={contentItems}
          categoryItems={categoryItems}
          parentId={addChildTarget.id}
          hideTrigger
          open={addChildTarget !== null}
          onOpenChange={(next) => !next && setAddChildTarget(null)}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteItem !== null}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title={`Menüpunkt „${truncateMiddle(deleteItem?.label ?? "")}“ löschen?`}
        description="Untereinträge dieses Punkts werden dabei nicht gelöscht, sondern rücken auf die oberste Ebene."
        onConfirm={handleDeleteItem}
      />
    </div>
  );
}
