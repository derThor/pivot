"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  Globe,
  Info,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { toast } from "sonner";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { PaginationControls } from "@/components/pagination-controls";
import { SystemMessage } from "@/components/ui/system-message";
import { WebsiteCheckDetailsDialog } from "@/components/website-check-details-dialog";
import { WebsiteDialog } from "@/components/website-dialog";
import { WEBSITE_STATUS_BADGE } from "@/lib/website-status";
import type { WebsiteCheckAllResult, WebsiteListItem } from "@/lib/api-server";

// Nutzervorgabe, 2026-08-26: "zuletzt geprüft text weg, gerade eben oder
// datum" + "stunden als zeit auch, am nächsten tag datum" – am selben Tag
// die Uhrzeit (auch bei mehreren Stunden Differenz, keine "vor X
// Std."-Relativangabe), ab dem nächsten Tag das Datum.
function formatCheckTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (now.getTime() - date.getTime() < 60_000) return "gerade eben";
  if (date.toDateString() === now.toDateString()) {
    return `${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
  }
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Nutzer-Bugreport, 2026-08-26: "hier ist http drin, dennoch wird bei
// öffnen die live seite aufgerufen" – der "Öffnen"-Button nutzte immer
// die Live-Domain, obwohl eine Test-URL (z.B. "http://localhost:3010/")
// hinterlegt war. Test-URL hat Vorrang, Live-Domain nur als Fallback.
function getOpenUrl(website: Pick<WebsiteListItem, "domain" | "testUrl">) {
  if (website.testUrl) {
    return `${website.testUrl.replace(/\/+$/, "")}/login`;
  }
  return `https://${website.domain}/login`;
}

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
  const [dialogTarget, setDialogTarget] = useState<WebsiteListItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<WebsiteListItem | null>(
    null,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [wakingId, setWakingId] = useState<string | null>(null);
  // ID statt ganzem Objekt (Nutzervorgabe, 2026-08-26: "Erneut prüfen"-
  // Button direkt im Popup) – so zeigt das Popup nach einer erneuten
  // Prüfung automatisch die frischen `items` an, statt an der alten
  // Objekt-Referenz von vor dem `router.refresh()` festzuhängen.
  const [checkDetailsId, setCheckDetailsId] = useState<string | null>(null);
  const checkDetailsTarget = items.find((w) => w.id === checkDetailsId) ?? null;

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
            className="border-border"
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
          const badge = WEBSITE_STATUS_BADGE[website.status];
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
                  <Badge className={badge.className}>{badge.label}</Badge>
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
              </div>
              {/* Nutzervorgabe, 2026-08-24: "Status ausgeben, der gerade
               * ist" – Momentaufnahme vom letzten "Wecken"/"Prüfen", bewusst
               * mit Zeitstempel, statt einen dauerhaft aktuellen Live-Status
               * vorzutäuschen ("mit dem Hinweis, dass es verzögert ist").
               * Nutzervorgabe, 2026-08-25: "in einem Alert-Format, orientiere
               * dich an unserem Standard" – app-weite `SystemMessage` statt
               * eigenem Icon+Text-Aufbau, siehe knowledge-base-Regel
               * "SystemMessage-Farben sind kanonisch". Update 2026-08-25:
               * "machst in der Kachel selber nur einen Alert, das Prüfung OK
               * oder nicht OK ... dann ein Info-Icon, wo man ein Popup
               * aufrufen kann mit der eigentlichen Prüfung" – die einzelnen
               * Teilergebnisse (`lastCheckChecks`, inkl. Versionsabgleich)
               * stecken nur noch im Popup, siehe
               * website-check-details-dialog.tsx. */}
              {website.lastWakeupAt ? (
                <div className="relative">
                  <SystemMessage
                    variant={website.lastWakeupOk ? "success" : "warning"}
                    title={
                      website.lastWakeupOk
                        ? "Alles in Ordnung"
                        : "Mit Hinweisen"
                    }
                    titleClassName="text-sm"
                    meta={formatCheckTime(website.lastWakeupAt)}
                    metaClassName="text-sm"
                    className="pr-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Prüfdetails anzeigen"
                    aria-haspopup="dialog"
                    className="absolute top-1/2 right-3 -translate-y-1/2"
                    onClick={() => setCheckDetailsId(website.id)}
                  >
                    <Info className="size-[18px]" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <SystemMessage
                    variant="neutral"
                    title="Noch nie geprüft"
                    titleClassName="text-sm"
                    className="pr-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Prüfdetails anzeigen"
                    aria-haspopup="dialog"
                    className="absolute top-1/2 right-3 -translate-y-1/2"
                    onClick={() => setCheckDetailsId(website.id)}
                  >
                    <Info className="size-[18px]" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 rounded-md border-border"
                  render={
                    <a
                      href={getOpenUrl(website)}
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
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 rounded-md border-border"
                  disabled={wakingId === website.id}
                  onClick={() => handleWakeup(website)}
                >
                  {wakingId === website.id ? "Prüft…" : "Prüfen"}
                </Button>
              </div>
            </div>
          );
        })}
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

      <WebsiteCheckDetailsDialog
        target={checkDetailsTarget}
        onOpenChange={(open) => !open && setCheckDetailsId(null)}
        onRecheck={handleWakeup}
        isRechecking={wakingId === checkDetailsTarget?.id}
      />
    </div>
  );
}
