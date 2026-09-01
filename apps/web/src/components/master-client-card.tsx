"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Globe,
  KeyRound,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { toast } from "sonner";

import { toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DeploymentModeDialog } from "@/components/deployment-mode-dialog";
import { LicenseApiKeyDialog } from "@/components/license-api-key-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { WebsiteModeDialog } from "@/components/website-mode-dialog";
import { DEPLOYMENT_MODE_BADGE } from "@/lib/deployment-mode-badge";
import { formatRelativeTime } from "@/lib/utils";
import { WEBSITE_STATUS_BADGE } from "@/lib/website-status";
import { bff } from "@/lib/bff";
import type {
  AppSettings,
  LicenseRecheckResult,
  WebsiteListItem,
  WebsiteListResponse,
} from "@/lib/api-server";

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
  development: "Entwicklung",
  unchecked: "Ungeprüft",
  pending: "Karenzzeit",
  locked: "Gesperrt",
};

/** Einstellungen → Master-Client (Nutzervorgabe, 2026-08-24, mehrfach
 * wiederholt: "wenn ich ... eine Seite anklicke, kommt ein Popup, wo man
 * NUR wechseln kann zwischen Master und Client. Mehr nicht."): Überblick
 * über diese Installation + alle unter Administration → Webseite
 * verbundenen Mandanten. Jede Zeile öffnet ein Popup mit ausschließlich
 * dem Master/Client-Umschalter – für "Diese Installation" `
 * DeploymentModeDialog` (schreibt `AppSettings.deploymentMode`), für
 * Mandanten-Zeilen `WebsiteModeDialog` (schreibt `Website.deploymentMode`,
 * rein dokumentarisch – siehe Kommentar dort). Alle anderen
 * Website-Einstellungen (Name/Domain/API-Key/Status) bleiben ausschließlich
 * unter Administration → Webseite (`WebsiteDialog`). Nutzervorgabe: "das
 * darf alles nur auf dem Master erlaubt sein" – auf einer Client-
 * Installation sind die Zeilen rein informativ (kein Klick, kein Popup), da
 * Bearbeiten dort ohnehin serverseitig per `MasterOnlyGuard` blockiert
 * wäre. */
export function MasterClientCard({
  settings,
  websites,
  statsWebsites,
}: {
  settings: AppSettings;
  websites: WebsiteListResponse;
  /** Dieselbe Liste, aber mit eigener Seite (Query-Param `statsPage`) –
   * die Zählerstände-Karte blättert unabhängig von "Mandanten", sonst
   * würden beide Karten zwangsweise gemeinsam springen. */
  statsWebsites: WebsiteListResponse;
}) {
  const isMaster = settings.deploymentMode === "master";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selfDialogOpen, setSelfDialogOpen] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [websiteDialogTarget, setWebsiteDialogTarget] =
    useState<WebsiteListItem | null>(null);
  const [isRechecking, setIsRechecking] = useState(false);

  async function handleRecheck() {
    setIsRechecking(true);
    try {
      const res = await fetch(bff("/api/license/recheck"), { method: "POST" });
      const data = (await res
        .json()
        .catch(() => null)) as LicenseRecheckResult | null;
      if (!res.ok) return;
      // Nutzer-Bugreport, 2026-08-24: "Key erneuert, dann geprüft, und
      // alles in Ordnung?????" – `lastCheck` ist das ECHTE Ergebnis des
      // gerade eben durchgeführten Versuchs, nicht der (evtl. veraltete)
      // Gesamtstatus. Bei Fehlschlag also klar als Fehler zeigen statt den
      // alten Status schönzureden.
      if (data?.lastCheck?.status === "error") {
        toast.error(`Prüfung fehlgeschlagen: ${data.lastCheck.message}`);
      } else {
        const label =
          data && "status" in data
            ? (STATUS_LABEL[data.status] ?? data.status)
            : "unbekannt";
        toastEdited(`Geprüft – Status: ${label} (soeben bestätigt).`);
      }
      router.refresh();
    } finally {
      setIsRechecking(false);
    }
  }

  // "Diese Installation"-Zeile – Nutzervorgabe, 2026-08-30: "will ich
  // diese Installation über Mandanten ... stehen haben" (nur im Master-
  // Modus, siehe Aufruf unten) – bisher nur die erste Zeile INNERHALB der
  // "Mandanten"-Karte, jetzt eine eigene, davor stehende Karte mit
  // eigener Überschrift statt optisch unter "Mandanten" mitzulaufen.
  const selfRow = (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted p-3">
      <button
        type="button"
        disabled={!isMaster}
        onClick={() => setSelfDialogOpen(true)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors disabled:cursor-default enabled:hover:bg-border"
      >
        <span
          className={
            isMaster
              ? "flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
              : "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          }
        >
          <ShieldCheck className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">Diese Installation</p>
            <Badge
              className={
                DEPLOYMENT_MODE_BADGE[isMaster ? "master" : "slave"].className
              }
            >
              {DEPLOYMENT_MODE_BADGE[isMaster ? "master" : "slave"].label}
            </Badge>
          </div>
          {/* Nutzervorgabe, 2026-08-25: Version dieser Installation
           * unter Einstellungen → Master-Client anzeigen (bisher in der
           * Sidebar, dort auf Nutzerwunsch wieder entfernt) – "immer in
           * einem Badge, überall" statt reinem Fließtext. */}
          {settings.appVersion && (
            <Badge
              variant="secondary"
              className="badge--amber mt-1 w-fit border-0 font-mono"
            >
              Version {settings.appVersion}
            </Badge>
          )}
        </div>
        {isMaster && (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {!isMaster && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="API-Key ändern"
          onClick={() => setApiKeyDialogOpen(true)}
        >
          <KeyRound />
        </Button>
      )}
    </div>
  );

  // Nutzervorgabe, 2026-09-01: "der zählerstand muss zurücksetzbar sein,
  // so dass man dies löschen kann" – und im Nachgang "einzelnen
  // zählerstand je mandanten". Ohne `websiteId` app-weit, mit nur für
  // diese eine Webseite.
  async function handleResetStatsHistory(websiteId?: string) {
    const res = await fetch(
      bff(
        websiteId
          ? `/api/websites/${websiteId}/stats-history`
          : "/api/websites/stats-history",
      ),
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error("Zählerstände konnten nicht zurückgesetzt werden.");
      return;
    }
    const data = (await res.json().catch(() => null)) as {
      deletedReports?: number;
    } | null;
    toastEdited(
      `Zählerstände zurückgesetzt${
        data?.deletedReports
          ? ` – ${data.deletedReports} Einträge gelöscht`
          : ""
      }.`,
    );
    router.refresh();
  }

  if (isMaster) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Diese Installation</CardTitle>
          </CardHeader>
          <CardContent>{selfRow}</CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Mandanten</CardTitle>
            <p className="text-sm text-muted-foreground">
              Neue Projekte unter Administration → Webseite erscheinen hier
              automatisch.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {websites.items.map((website) => {
              const badge = WEBSITE_STATUS_BADGE[website.status];
              return (
                <button
                  key={website.id}
                  type="button"
                  onClick={() => setWebsiteDialogTarget(website)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted p-3 text-left transition-colors hover:bg-border"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Globe className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{website.name}</p>
                      <Badge
                        className={
                          DEPLOYMENT_MODE_BADGE[website.deploymentMode]
                            .className
                        }
                      >
                        {DEPLOYMENT_MODE_BADGE[website.deploymentMode].label}
                      </Badge>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                      {website.domain}
                    </p>
                    {website.lastReportedVersion && (
                      <Badge
                        variant="secondary"
                        className="badge--amber mt-1 w-fit border-0 font-mono"
                      >
                        Version {website.lastReportedVersion}
                      </Badge>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {website.lastCheckInAt
                      ? formatRelativeTime(website.lastCheckInAt)
                      : "Noch nicht geprüft"}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </CardContent>
          {/* Immer sichtbar, auch bei einer einzigen Seite (Nutzervorgabe,
              2026-09-01) – so wie auf den übrigen Listenseiten der App;
              vorher war sie an `pageCount > 1` gebunden und damit im
              Normalfall unsichtbar. */}
          <CardContent className="pt-0">
            <PaginationControls
              page={websites.meta.page}
              pageCount={websites.meta.pageCount}
              buildHref={(p) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("mandantenPage", String(p));
                return `?${params.toString()}`;
              }}
            />
          </CardContent>
        </Card>
        {/* Zählerstände (Nutzervorgabe, 2026-09-01). Bewusst eine eigene
            Karte unter "Mandanten" statt eines Knopfs an jeder Zeile: das
            Zurücksetzen wirkt app-weit, ein Knopf pro Mandant hätte eine
            Genauigkeit vorgetäuscht, die es nicht gibt. */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Gemeldete Zählerstände</CardTitle>
            <p className="text-sm text-muted-foreground">
              Seiten- und Nutzerzahlen melden die Installationen beim Prüfen
              selbst. Der gespeicherte Verlauf dient der Plausibilitätsprüfung –
              Zurücksetzen löscht ihn samt offener Hinweise für alle Webseiten.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* Je Webseite eine Zeile (Nutzervorgabe, 2026-09-01:
                "einzelnen zählerstand je mandanten unter einstellungen
                zurücksetzen button") – ein legitimer Rückgang betrifft in
                der Regel genau eine Installation. Bewusst hier und nicht
                in der Mandanten-Liste darüber: deren Zeilen sind selbst
                `<button>`, ein zweiter Knopf darin wäre ungültiges HTML. */}
            {statsWebsites.items.map((website) => (
              <div
                key={website.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{website.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {website.reportedUserCount !== null
                      ? `${website.reportedPageCount} Seiten · ${website.reportedUserCount} Nutzer`
                      : "Noch nichts gemeldet"}
                    {website.statsAnomalyAt ? " · Hinweis offen" : ""}
                  </p>
                </div>
                <ConfirmDeleteDialog
                  title={`Zählerstand von „${website.name}“ zurücksetzen?`}
                  description="Löscht Verlauf, zuletzt gemeldete Zahlen und einen offenen Hinweis – nur für diese Webseite. Beim nächsten Prüfen füllen sich die Zahlen von selbst wieder."
                  confirmLabel="Zurücksetzen"
                  confirmingLabel="Setzt zurück…"
                  onConfirm={() => handleResetStatsHistory(website.id)}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-button-border"
                    >
                      <RotateCcw />
                      Zurücksetzen
                    </Button>
                  }
                />
              </div>
            ))}

            <PaginationControls
              page={statsWebsites.meta.page}
              pageCount={statsWebsites.meta.pageCount}
              buildHref={(p) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("statsPage", String(p));
                return `?${params.toString()}`;
              }}
            />

            <ConfirmDeleteDialog
              title="Alle Zählerstände zurücksetzen?"
              description="Löscht den gespeicherten Verlauf, die zuletzt gemeldeten Zahlen und offene Hinweise zu unglaubwürdigen Rückgängen – für alle Webseiten. Beim nächsten Prüfen füllen sich die Zahlen von selbst wieder."
              confirmLabel="Zurücksetzen"
              confirmingLabel="Setzt zurück…"
              onConfirm={() => handleResetStatsHistory()}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit border-button-border"
                >
                  <RotateCcw />
                  Alle zurücksetzen
                </Button>
              }
            />
          </CardContent>
        </Card>

        <DeploymentModeDialog
          open={selfDialogOpen}
          onOpenChange={setSelfDialogOpen}
          settings={settings}
        />
        <WebsiteModeDialog
          target={websiteDialogTarget}
          onOpenChange={(open) => !open && setWebsiteDialogTarget(null)}
          onSaved={() => {}}
        />
      </div>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Mandanten</CardTitle>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-button-border"
          disabled={isRechecking}
          onClick={handleRecheck}
        >
          <RotateCcw />
          {isRechecking ? "Prüft…" : "Jetzt prüfen"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {selfRow}

        {websites.items.map((website) => {
          const badge = WEBSITE_STATUS_BADGE[website.status];
          return (
            <div
              key={website.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted p-3 text-left"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Globe className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{website.name}</p>
                  <Badge
                    className={
                      DEPLOYMENT_MODE_BADGE[website.deploymentMode].className
                    }
                  >
                    {DEPLOYMENT_MODE_BADGE[website.deploymentMode].label}
                  </Badge>
                  <Badge className={badge.className}>{badge.label}</Badge>
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {website.domain}
                </p>
                {/* Nutzervorgabe, 2026-08-25: "bei Master auch" – Version
                 * jetzt auch für die verbundenen Mandanten, nicht nur bei
                 * "Diese Installation" – "immer in einem Badge, überall". */}
                {website.lastReportedVersion && (
                  <Badge
                    variant="secondary"
                    className="badge--amber mt-1 w-fit border-0 font-mono"
                  >
                    Version {website.lastReportedVersion}
                  </Badge>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {website.lastCheckInAt
                  ? formatRelativeTime(website.lastCheckInAt)
                  : "Noch nicht geprüft"}
              </span>
            </div>
          );
        })}
      </CardContent>

      <LicenseApiKeyDialog
        open={apiKeyDialogOpen}
        onOpenChange={setApiKeyDialogOpen}
      />
    </Card>
  );
}
