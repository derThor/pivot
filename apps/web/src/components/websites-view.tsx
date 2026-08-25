"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  Globe,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { toast } from "sonner";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { PaginationControls } from "@/components/pagination-controls";
import { SystemMessage } from "@/components/ui/system-message";
import { WebsiteDialog } from "@/components/website-dialog";
import { formatRelativeTime } from "@/lib/utils";
import type {
  WebsiteCheckAllResult,
  WebsiteListItem,
  WebsiteStatus,
} from "@/lib/api-server";

const STATUS_BADGE: Record<
  WebsiteStatus,
  { label: string; className: string }
> = {
  live: { label: "Live", className: "bg-green-100 text-green-700" },
  development: {
    label: "Entwicklung",
    className: "bg-slate-200 text-slate-700",
  },
  locked: { label: "Gesperrt", className: "bg-red-100 text-red-700" },
};

/** Eigene Seite `/dashboard/websites` (Nutzervorgabe, 2026-08-24: "einzelne
 * Kacheln", "Hauptbg weiß weg" – kein umschließender Card-Kasten mehr,
 * Kacheln liegen direkt auf dem Seitenhintergrund) – Layout 1:1 nach
 * `forms-view.tsx`: Titel/Breadcrumb links, Aktions-Button rechts, echte
 * URL-Pagination unten. Statusänderung läuft ausschließlich über den
 * "Bearbeiten"-Dialog, nicht mehr inline auf der Kachel. Master-exklusiv
 * (siehe knowledge-base/platform/master-slave-licensing.md) – die
 * Wartungsseiten-Konfiguration für DIESE Installation liegt separat unter
 * Einstellungen → Wartungsseite, nicht hier. */
export function WebsitesView({
  items,
  meta,
}: {
  items: WebsiteListItem[];
  meta: { page: number; pageCount: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogTarget, setDialogTarget] = useState<
    WebsiteListItem | null | "new"
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<WebsiteListItem | null>(
    null,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [wakingId, setWakingId] = useState<string | null>(null);

  // Nutzer-Feedback, 2026-08-24: "diese Prüfung sagt nichts aus ... alle
  // Webseiten einmal durchlaufen und den Status ausgeben, der gerade ist"
  // – zeigt jetzt eine ehrliche Zusammenfassung (wie viele OK/fehlgeschlagen,
  // mit Namen bei Fehlern) statt einer nichtssagenden Erfolgsmeldung.
  async function handleCheckNow() {
    setIsChecking(true);
    try {
      const res = await fetch("/api/websites/check-now", { method: "POST" });
      const data = (await res
        .json()
        .catch(() => null)) as WebsiteCheckAllResult | null;
      if (!res.ok || !data) {
        toast.error("Prüfung fehlgeschlagen.");
        return;
      }
      const failed = data.results.filter((r) => !r.ok);
      if (failed.length === 0) {
        toastEdited(
          `${data.results.length} Installation(en) geprüft – alle in Ordnung.`,
        );
      } else {
        toast.error(
          `${failed.length} von ${data.results.length} Installation(en) mit Problemen: ` +
            failed.map((r) => `${r.name} (${r.message})`).join(", "),
        );
      }
      router.refresh();
    } finally {
      setIsChecking(false);
    }
  }

  async function handleWakeup(website: WebsiteListItem) {
    setWakingId(website.id);
    try {
      const res = await fetch(`/api/websites/${website.id}/wakeup`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      const message = data?.message ?? "Installation nicht erreichbar.";
      if (data?.ok) {
        toastEdited(message);
      } else {
        toast.error(message);
      }
      router.refresh();
    } finally {
      setWakingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/websites/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    toastDeleted("Website wurde entfernt.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Webseite</h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-[#D4D4D4]"
            disabled={isChecking}
            onClick={handleCheckNow}
          >
            <RotateCcw />
            {isChecking ? "Prüft…" : "Prüfen"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((website) => {
          const badge = STATUS_BADGE[website.status];
          return (
            <div
              key={website.id}
              className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Globe className="size-4.5" />
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`„${website.domain}“ bearbeiten`}
                    onClick={() => setDialogTarget(website)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`„${website.domain}“ löschen`}
                    onClick={() => setDeleteTarget(website)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{website.domain}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {website.lastCheckInAt
                    ? `Zuletzt selbst gemeldet ${formatRelativeTime(website.lastCheckInAt)}`
                    : "Hat sich noch nie selbst gemeldet"}
                </p>
              </div>
              {/* Nutzervorgabe, 2026-08-24: "Status ausgeben, der gerade
               * ist" – Momentaufnahme vom letzten "Wecken"/"Prüfen", bewusst
               * mit Zeitstempel, statt einen dauerhaft aktuellen Live-Status
               * vorzutäuschen ("mit dem Hinweis, dass es verzögert ist").
               * Nutzervorgabe, 2026-08-25: "in einem Alert-Format, orientiere
               * dich an unserem Standard" – app-weite `SystemMessage` statt
               * eigenem Icon+Text-Aufbau, siehe knowledge-base-Regel
               * "SystemMessage-Farben sind kanonisch". */}
              {website.lastWakeupAt && (
                <SystemMessage
                  variant={website.lastWakeupOk ? "success" : "warning"}
                  title={
                    website.lastWakeupOk
                      ? "OK beim letzten Check"
                      : "Hinweis beim letzten Check"
                  }
                  description={`${formatRelativeTime(website.lastWakeupAt)}${website.lastWakeupMessage ? ` – ${website.lastWakeupMessage}` : ""}`}
                />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 border-[#D4D4D4]"
                  render={
                    <a
                      href={`https://${website.domain}/login`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <ExternalLink />
                  Öffnen
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={wakingId === website.id}
                  onClick={() => handleWakeup(website)}
                >
                  {wakingId === website.id ? "Prüft…" : "Prüfen"}
                </Button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setDialogTarget("new")}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#D5D5D5] p-4 py-10 text-center transition-colors hover:border-lime-400"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-lime-700">
            <Plus className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Projekt anlegen</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Neue Website verbinden und als Mandant aufnehmen
            </p>
          </div>
        </button>
      </div>

      <PaginationControls
        page={meta.page}
        pageCount={meta.pageCount}
        buildHref={(p) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("page", String(p));
          return `/dashboard/websites?${params.toString()}`;
        }}
      />

      <WebsiteDialog
        target={dialogTarget}
        onOpenChange={(open) => !open && setDialogTarget(null)}
        onSaved={() => router.refresh()}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`„${deleteTarget?.name}“ löschen?`}
        description="Der Mandant wird endgültig entfernt. Die entfernte Installation selbst bleibt unberührt, meldet sich aber nicht mehr erfolgreich bei diesem Master."
        onConfirm={handleDelete}
      />
    </div>
  );
}
