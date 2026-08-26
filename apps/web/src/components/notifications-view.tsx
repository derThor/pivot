"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  Lock,
  Shield,
  Trash2,
  UserCog,
  type LucideIcon,
} from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { StatCard } from "@/components/stat-card";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, formatRelativeTime, truncateMiddle } from "@/lib/utils";
import type { AppNotification, NotificationCategory } from "@/lib/api-server";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  system: "System",
  security: "Sicherheit",
  privacy: "Datenschutz",
  accounts: "Konten",
};

const CATEGORY_ICONS: Record<NotificationCategory, LucideIcon> = {
  system: Clock,
  security: Lock,
  privacy: Shield,
  accounts: UserCog,
};

// Nutzervorgabe, 2026-08-26: nur noch die feste Badge-Palette (siehe
// ui/badge.tsx) – keine Ad-hoc-Tailwind-Töne mehr. "security" und
// "dringend" (siehe weiter unten) bewusst "red" (Nutzervorgabe: "bei
// dringend und Sicherheit rot nehmen").
const CATEGORY_ICON_BOX: Record<NotificationCategory, string> = {
  system: "badge--blue",
  security: "badge--red",
  privacy: "badge--amber",
  accounts: "badge--slate",
};

const CATEGORY_BADGE: Record<NotificationCategory, string> = {
  system: "badge--blue border-0",
  security: "badge--red border-0",
  privacy: "badge--amber border-0",
  accounts: "badge--slate border-0",
};

const CATEGORY_DOT: Record<NotificationCategory, string> = {
  system: "bg-[#1d4ed8]",
  security: "bg-[#dc2626]",
  privacy: "bg-[#b45309]",
  accounts: "bg-[#526074]",
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayGroup(iso: string): "heute" | "gestern" | "aelter" {
  const diff = startOfDay(new Date()) - startOfDay(new Date(iso));
  const oneDay = 24 * 60 * 60 * 1000;
  if (diff < oneDay) return "heute";
  if (diff < 2 * oneDay) return "gestern";
  return "aelter";
}

function formatRowTime(iso: string, group: "heute" | "gestern" | "aelter") {
  if (group === "heute") return formatRelativeTime(iso);
  const d = new Date(iso);
  if (group === "gestern") {
    return `gestern, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const GROUP_LABELS: Record<"heute" | "gestern" | "aelter", string> = {
  heute: "Heute",
  gestern: "Gestern",
  aelter: "Älter",
};

/** Benachrichtigungs-Postfach (Nutzervorgabe, 2026-08-21, 1:1 nach
 * Bildvorlage, ersetzt die vorherigen zustandslosen SystemMessage-Banner
 * auf dieser Seite). Nur vier Kategorien mit echter Datengrundlage
 * (System/Sicherheit/Datenschutz/Konten) – "Freigaben" (Freigabe-
 * Workflow), "Kommentare" und "Formulare" (Formular-Einsendungen) gibt es
 * in dieser App nicht als echtes Feature und wurden bewusst nicht
 * nachgebaut (Nutzerentscheidung, 2026-08-21: "weglassen"). Ebenso keine
 * "Zustellung"-Karte (E-Mail/Ruhezeiten) – es gibt keinen echten
 * Mail-Versand für diese Kategorien. */
export function NotificationsView({
  notifications: initialNotifications,
}: {
  notifications: AppNotification[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<
    NotificationCategory | "all"
  >("all");
  const [deleteTarget, setDeleteTarget] = useState<AppNotification | null>(
    null,
  );

  const today = notifications.filter((n) => dayGroup(n.createdAt) === "heute");
  const unread = notifications.filter((n) => !n.isRead);
  const urgentOpen = notifications.filter((n) => n.isUrgent && !n.isResolved);
  const resolvedToday = notifications.filter(
    (n) => n.isResolved && n.resolvedAt && dayGroup(n.resolvedAt) === "heute",
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<NotificationCategory, number> = {
      system: 0,
      security: 0,
      privacy: 0,
      accounts: 0,
    };
    for (const n of notifications) {
      if (n.isResolved) continue;
      counts[n.category]++;
    }
    return counts;
  }, [notifications]);

  // Erledigte Meldungen verschwinden aus der Liste (Nutzer-Bugreport,
  // 2026-08-21: "konto ist entsperrt. warum ist das da nicht drin?" – die
  // Bedingung war bereits automatisch als erledigt markiert worden, blieb
  // aber trotzdem in der Liste stehen, nur ohne Aktions-Button). Zählen
  // weiterhin in "Erledigt heute" (siehe oben), sind aber nicht mehr Teil
  // der Tages-Gruppen.
  const visible = notifications.filter((n) => {
    if (n.isResolved) return false;
    if (onlyUnread && n.isRead) return false;
    if (onlyUrgent && !n.isUrgent) return false;
    if (categoryFilter !== "all" && n.category !== categoryFilter) return false;
    return true;
  });

  const groups: {
    key: "heute" | "gestern" | "aelter";
    items: AppNotification[];
  }[] = (["heute", "gestern", "aelter"] as const)
    .map((key) => ({
      key,
      items: visible.filter((n) => dayGroup(n.createdAt) === key),
    }))
    .filter((g) => g.items.length > 0);

  // `router.refresh()` nach jeder Zustandsänderung: die Glocke im Header
  // ist ein Server Component (`dashboard/layout.tsx`), das bei reiner
  // Client-Navigation nicht neu rendert – ohne den Refresh hinkt der
  // Ungelesen-Zähler dort hinterher (Nutzer-Bugreport, 2026-08-21: "wenn
  // ich gelesen zurücknehme muss die glocke sofort die anzahl
  // auffrischen"), gleiches Muster wie beim Betroffenenanfragen-Panel.
  async function toggleRead(n: AppNotification) {
    const nextRead = !n.isRead;
    setNotifications((prev) =>
      prev.map((row) => (row.id === n.id ? { ...row, isRead: nextRead } : row)),
    );
    await fetch(`/api/notifications/${n.id}/${nextRead ? "read" : "unread"}`, {
      method: "POST",
    });
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    toastDeleted("Benachrichtigung wurde gelöscht.");
    setDeleteTarget(null);
    router.refresh();
  }

  async function handleActionClick(id: string) {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, isRead: true, isResolved: true } : n,
      ),
    );
    await fetch(`/api/notifications/${id}/resolve`, { method: "POST" }).catch(
      () => {},
    );
    router.refresh();
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fetch("/api/notifications/read-all", { method: "POST" });
    toastEdited("Alle Benachrichtigungen wurden als gelesen markiert.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Benachrichtigungen
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border"
            disabled={unread.length === 0}
            onClick={handleMarkAllRead}
          >
            Alle als gelesen
          </Button>
          <Button
            type="button"
            render={<Link href="/dashboard/settings?section=notifications" />}
          >
            Regeln bearbeiten
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ungelesen"
          value={String(unread.length)}
          sublabel={`${unread.filter((n) => n.isUrgent).length} davon dringend`}
        />
        <StatCard
          label="Dringend"
          value={String(urgentOpen.length)}
          sublabel="unerledigt"
        />
        <StatCard
          label="Heute eingegangen"
          value={String(today.length)}
          sublabel={
            today[0] ? `letzte ${formatRelativeTime(today[0].createdAt)}` : "–"
          }
        />
        <StatCard
          label="Erledigt heute"
          value={String(resolvedToday.length)}
          sublabel="von dir bearbeitet"
        />
      </div>

      {urgentOpen.length > 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="size-[18px]" />
            </span>
            <p className="text-sm">
              <span className="font-semibold text-pivot-navy">
                {urgentOpen.length} Meldung{urgentOpen.length === 1 ? "" : "en"}{" "}
                mit Frist oder Sicherheitsbezug.
              </span>{" "}
              <span className="text-muted-foreground">
                Diese sollten heute erledigt werden.
              </span>
            </p>
          </div>
          <Button
            type="button"
            variant={onlyUrgent ? "default" : "outline"}
            size="sm"
            className={onlyUrgent ? undefined : "border-border"}
            onClick={() => setOnlyUrgent((v) => !v)}
          >
            {onlyUrgent ? "Alle zeigen" : "Nur diese zeigen"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[1fr_280px] lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <label className="inline-flex w-fit items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm shadow-sm">
            <Switch checked={onlyUnread} onCheckedChange={setOnlyUnread} />
            Nur ungelesen
          </label>

          {groups.length === 0 ? (
            <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-sm">
              Keine Benachrichtigungen.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-1">
                  <p className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {GROUP_LABELS[group.key]}
                  </p>
                  <span className="h-px min-w-4 flex-1 bg-muted-foreground/20" />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
                <div className="flex flex-col overflow-hidden rounded-xl bg-card shadow-sm">
                  {group.items.map((n) => {
                    const Icon = CATEGORY_ICONS[n.category];
                    const time = formatRowTime(n.createdAt, group.key);
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 border-l-4 border-t border-t-border p-4 transition-colors first:border-t-0",
                          !n.isRead &&
                            n.isUrgent &&
                            "border-l-red-500 bg-red-50/40 dark:bg-red-950/40",
                          !n.isRead &&
                            !n.isUrgent &&
                            "border-l-primary bg-primary/10",
                          n.isRead && "border-l-transparent",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => !n.isRead && toggleRead(n)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-lg",
                              CATEGORY_ICON_BOX[n.category],
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 font-medium">
                              <span className="truncate">{n.title}</span>
                              {!n.isRead && (
                                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {n.description}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <Badge className={CATEGORY_BADGE[n.category]}>
                                {CATEGORY_LABELS[n.category]}
                              </Badge>
                              {n.isUrgent && (
                                <Badge className="badge--red border-0">
                                  dringend
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {n.actorName ?? "System"} · {time}
                              </span>
                            </div>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          {n.actionUrl && n.actionLabel && !n.isResolved && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-border"
                              onClick={() => handleActionClick(n.id)}
                              render={<Link href={n.actionUrl} />}
                            >
                              {n.actionLabel}
                            </Button>
                          )}
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  className="border-border"
                                  aria-label={
                                    n.isRead
                                      ? "Als ungelesen markieren"
                                      : "Als gelesen markieren"
                                  }
                                  onClick={() => toggleRead(n)}
                                />
                              }
                            >
                              {n.isRead ? (
                                <Check className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              {n.isRead
                                ? "Als ungelesen markieren"
                                : "Als gelesen markieren"}
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="rounded-lg border-border text-destructive hover:bg-destructive/5"
                            aria-label={`„${n.title}“ löschen`}
                            onClick={() => setDeleteTarget(n)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Kategorien
            </p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                  categoryFilter === "all"
                    ? "bg-primary/15 font-medium"
                    : "hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-muted-foreground/40" />
                  Alle Kategorien
                </span>
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground"
                >
                  {notifications.length}
                </Badge>
              </button>
              {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                      categoryFilter === cat
                        ? "bg-primary/15 font-medium"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("size-2 rounded-full", CATEGORY_DOT[cat])}
                      />
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-muted text-muted-foreground"
                    >
                      {categoryCounts[cat]}
                    </Badge>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`„${truncateMiddle(deleteTarget?.title ?? "")}“ löschen?`}
        description="Solange die zugrunde liegende Bedingung noch zutrifft, kann die Meldung beim nächsten Laden erneut auftauchen."
        onConfirm={handleDelete}
      />
    </div>
  );
}
