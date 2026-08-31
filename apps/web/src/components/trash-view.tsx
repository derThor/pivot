"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock,
  ClipboardList,
  FileText,
  FolderTree,
  HelpCircle,
  Image as ImageIcon,
  Images,
  Lock,
  RotateCcw,
  Search,
  Settings2,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { Input } from "@/components/ui/input";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { StatCard } from "@/components/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSelection } from "@/hooks/use-selection";
import { cn, formatBytes, truncateMiddle } from "@/lib/utils";
import type { TrashItem, TrashStats, TrashType } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const TYPE_FILTERS: { value: TrashType | null; label: string }[] = [
  { value: null, label: "Alle" },
  { value: "content", label: "Seiten" },
  { value: "media", label: "Medien" },
  { value: "categories", label: "Kategorien" },
  { value: "tags", label: "Tags" },
  { value: "gallery", label: "Galerien" },
  { value: "faq", label: "FAQs" },
  { value: "forms", label: "Formulare" },
];

const TYPE_LABELS: Record<TrashType, string> = {
  content: "Seite",
  media: "Medium",
  categories: "Kategorie",
  tags: "Tag",
  gallery: "Galerie",
  faq: "FAQ",
  forms: "Formular",
};

// Farbschema pro Typ (Icon-Box + Badge neben dem Titel) – eigene, in sich
// konsistente Palette, da es dafür noch keine app-weite Konvention gab
// (anders als z.B. Content-Status-Badges).
const TYPE_STYLES: Record<
  TrashType,
  { icon: typeof FileText; className: string }
> = {
  content: { icon: FileText, className: "badge--blue" },
  media: { icon: ImageIcon, className: "badge--slate" },
  categories: { icon: FolderTree, className: "badge--green" },
  tags: { icon: TagIcon, className: "badge--ink" },
  gallery: { icon: Images, className: "badge--lime" },
  faq: { icon: HelpCircle, className: "badge--amber" },
  forms: { icon: ClipboardList, className: "badge--slate" },
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function TrashView({
  items,
  stats,
  activeType,
  activeQuery,
}: {
  items: TrashItem[];
  stats: TrashStats;
  activeType: TrashType | null;
  activeQuery: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(activeQuery);
  const {
    selected,
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
    count,
  } = useSelection(items.map((item) => `${item.type}:${item.id}`));

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/dashboard/trash?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    updateParams({ q: value || null });
  }

  async function handleRestore(item: TrashItem) {
    await fetch(bff(`/api/trash/${item.type}/${item.id}/restore`), {
      method: "POST",
    });
    toastEdited(`„${item.title}“ wurde wiederhergestellt.`);
    router.refresh();
  }

  async function handlePermanentDelete(item: TrashItem) {
    await fetch(bff(`/api/trash/${item.type}/${item.id}`), {
      method: "DELETE",
    });
    toastDeleted(`„${item.title}“ wurde endgültig gelöscht.`);
    router.refresh();
  }

  async function handleBulkDelete() {
    const targets = items.filter((item) =>
      selected.has(`${item.type}:${item.id}`),
    );
    await Promise.all(
      targets.map((item) =>
        fetch(bff(`/api/trash/${item.type}/${item.id}`), { method: "DELETE" }),
      ),
    );
    clear();
    toastDeleted(
      targets.length === 1
        ? "1 Eintrag wurde endgültig gelöscht."
        : `${targets.length} Einträge wurden endgültig gelöscht.`,
    );
    router.refresh();
  }

  async function handleEmptyTrash() {
    await fetch(bff("/api/trash"), { method: "DELETE" });
    toastDeleted("Papierkorb wurde geleert.");
    router.refresh();
  }

  async function handleRestoreExpiring() {
    await fetch(bff("/api/trash/restore-expiring"), { method: "POST" });
    toastEdited("Bald ablaufende Einträge wurden wiederhergestellt.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Papierkorb</h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
            render={<Link href="/dashboard/privacy" />}
          >
            <Settings2 className="size-4" />
            Aufbewahrung ändern
          </Button>
          <ConfirmDeleteDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                disabled={stats.total === 0}
              >
                <Trash2 className="size-4" />
                Papierkorb leeren
              </Button>
            }
            title="Papierkorb vollständig leeren?"
            description="Alle Einträge im Papierkorb werden endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
            onConfirm={handleEmptyTrash}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Im Papierkorb"
          value={String(stats.total)}
          sublabel={`${stats.typesCount} ${stats.typesCount === 1 ? "Inhaltstyp" : "Inhaltstypen"}`}
        />
        <StatCard
          label="Verfällt in 7 Tagen"
          value={String(stats.expiringSoonCount)}
          sublabel="danach nicht mehr wiederherstellbar"
        />
        <StatCard
          label="Belegter Speicher"
          value={formatBytes(stats.storageBytes)}
          sublabel="nur Medien-Dateien"
        />
        <StatCard
          label="Aufbewahrung"
          value={`${stats.retentionDays} Tage`}
          sublabel="aus Datenschutz-Einstellungen"
        />
      </div>

      {stats.expiringSoonCount > 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
          <span className="flex size-9 shrink-0 items-center justify-center badge--amber rounded-full">
            <Clock className="size-[18px]" />
          </span>
          <p className="flex-1 text-sm">
            <span className="font-semibold text-pivot-navy">
              {stats.expiringSoonCount}{" "}
              {stats.expiringSoonCount === 1
                ? "Eintrag verfällt"
                : "Einträge verfallen"}{" "}
              in den nächsten 7 Tagen.
            </span>{" "}
            <span className="text-muted-foreground">
              Danach sind sie nicht wiederherstellbar.
            </span>
          </p>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={handleRestoreExpiring}
          >
            Alle wiederherstellen
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-secondary p-1">
          {TYPE_FILTERS.map((filter) => {
            const active = activeType === filter.value;
            const filterCount = filter.value
              ? (stats.countsByType[filter.value] ?? 0)
              : stats.total;
            return (
              <button
                key={filter.value ?? "all"}
                type="button"
                onClick={() => updateParams({ type: filter.value })}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
                <span className="text-xs text-muted-foreground">
                  {filterCount}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 sm:flex-none">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Im Papierkorb suchen"
            className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SelectionToolbar
          count={count}
          entityLabelPlural="Einträge"
          actionLabel="Endgültig löschen"
          confirmTitle={`${count} Einträge endgültig löschen?`}
          confirmDescription="Diese Aktion kann nicht rückgängig gemacht werden."
          onDelete={handleBulkDelete}
          onClear={clear}
        />
        <div className="overflow-hidden rounded-xl bg-card shadow-sm">
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
                <TableHead>Gelöscht von</TableHead>
                <TableHead className="text-right">Verfällt</TableHead>
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
                    Papierkorb ist leer.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const key = `${item.type}:${item.id}`;
                  const pct = item.expired
                    ? 0
                    : Math.max(
                        0,
                        Math.min(
                          100,
                          (item.daysLeft / stats.retentionDays) * 100,
                        ),
                      );
                  const style = TYPE_STYLES[item.type];
                  const TypeIcon = style.icon;
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(key)}
                          onCheckedChange={() => toggle(key)}
                          aria-label={`${item.title} auswählen`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                              style.className,
                            )}
                          >
                            <TypeIcon className="size-4" />
                          </span>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                              <span className="font-semibold">
                                {item.title}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded-[5px] px-2 py-0.5 text-[11px] font-medium",
                                  style.className,
                                )}
                              >
                                {TYPE_LABELS[item.type]}
                              </span>
                            </span>
                            {item.subtitle && (
                              <span className="truncate font-mono text-xs text-muted-foreground">
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.deletedBy
                          ? [item.deletedBy.firstName, item.deletedBy.lastName]
                              .filter(Boolean)
                              .join(" ")
                          : "–"}
                        <div className="text-xs text-muted-foreground">
                          {dateFormatter.format(new Date(item.deletedAt))}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-40">
                        {item.expired ? (
                          <div className="flex items-center justify-end gap-1.5 text-sm text-destructive">
                            <Lock className="size-3.5" />
                            Gesperrt
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-medium">
                              {item.daysLeft === 0
                                ? "heute"
                                : `in ${item.daysLeft} T.`}
                            </span>
                            <div className="h-1.5 w-full rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  item.daysLeft <= 7
                                    ? "bg-amber-500"
                                    : "bg-primary",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 gap-1.5 rounded-lg border-button-border px-3 py-0"
                            disabled={item.expired}
                            title={
                              item.expired
                                ? "Aufbewahrungsfrist abgelaufen – nicht mehr wiederherstellbar."
                                : undefined
                            }
                            onClick={() => handleRestore(item)}
                          >
                            <RotateCcw />
                            Zurück
                          </Button>
                          <ConfirmDeleteDialog
                            trigger={
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="rounded-lg"
                                aria-label="Endgültig löschen"
                              >
                                <Trash2 />
                              </Button>
                            }
                            title={`„${truncateMiddle(item.title)}“ endgültig löschen?`}
                            description="Diese Aktion kann nicht rückgängig gemacht werden."
                            onConfirm={() => handlePermanentDelete(item)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
