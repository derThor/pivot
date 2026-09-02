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

import { toastChecked, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UseFormReturn } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SettingsValues } from "@/components/settings-form";
import { DeploymentModeDialog } from "@/components/deployment-mode-dialog";
import { LicenseApiKeyDialog } from "@/components/license-api-key-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { SegmentedPicker } from "@/components/segmented-picker";
import { SystemMessage } from "@/components/ui/system-message";
import { DEPLOYMENT_MODE_BADGE } from "@/lib/deployment-mode-badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import { WEBSITE_STATUS_BADGE } from "@/lib/website-status";
import { bff } from "@/lib/bff";
import type {
  AppSettings,
  LicenseRecheckResult,
  LicenseState,
  WebsiteListItem,
  WebsiteListResponse,
  WebsiteStatsHistoryResponse,
} from "@/lib/api-server";

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
  development: "Entwicklung",
  unchecked: "Ungeprüft",
  pending: "Karenzzeit",
  locked: "Gesperrt",
};

const MODE_OPTIONS: { value: "master" | "slave"; label: string }[] = [
  { value: "master", label: "Master" },
  { value: "slave", label: "Client" },
];

/** Master/Client-Umschalter direkt in der aufgeklappten Zeile
 * (Nutzervorgabe, 2026-09-01: "wenn man eine zeile anklickt öffnet sich ein
 * bereich … master - client, statt popup") – löste `website-mode-dialog.tsx`
 * ab. Speichert `Website.deploymentMode`, ein rein dokumentarisches Feld
 * ohne technische Wirkung (siehe schema.prisma): der Master hat keinen
 * Push-Mechanismus, um den Modus einer entfernten Installation zu setzen,
 * das stellt jede Installation nur für sich selbst ein.
 *
 * Eigene Komponente statt Inline-JSX, weil jede Zeile ihren eigenen
 * Entwurfszustand braucht – ein gemeinsamer State im Elternteil würde beim
 * Aufklappen einer zweiten Zeile den ungespeicherten Stand der ersten
 * übernehmen. */
function WebsiteModePicker({ website }: { website: WebsiteListItem }) {
  const router = useRouter();
  const [mode, setMode] = useState<"master" | "slave">(website.deploymentMode);
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = mode !== website.deploymentMode;

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(bff(`/api/websites/${website.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentMode: mode }),
      });
      if (!res.ok) {
        toast.error("Modus konnte nicht gespeichert werden.");
        return;
      }
      toastEdited("Modus gespeichert.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    // Speichern UNTER dem Umschalter, nicht daneben (Nutzervorgabe,
    // 2026-09-01) – daneben drückte er den Umschalter in schmalen Spalten
    // zusammen und wirkte auf gleicher Höhe wie ein Teil davon.
    <div className="flex flex-col gap-3">
      <SegmentedPicker
        label="Modus"
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
      />
      <Button
        type="button"
        size="sm"
        className="w-fit"
        disabled={!isDirty || isSaving}
        onClick={handleSave}
      >
        {isSaving ? "Speichert…" : "Speichern"}
      </Button>
    </div>
  );
}

/** Einstellungen → Master-Client (Nutzervorgabe, 2026-08-24, mehrfach
 * wiederholt: "wenn ich ... eine Seite anklicke, kommt ein Popup, wo man
 * NUR wechseln kann zwischen Master und Client. Mehr nicht."): Überblick
 * über diese Installation + alle unter Administration → Webseite
 * verbundenen Mandanten. Jede Zeile öffnet ein Popup mit ausschließlich
 * dem Master/Client-Umschalter – für "Diese Installation" `
 * DeploymentModeDialog` (schreibt `AppSettings.deploymentMode`), für
 * Mandanten-Zeilen seit 2026-09-01 ein aufklappbarer Bereich statt eines
 * Popups (schreibt `Website.deploymentMode`,
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
  statsHistory,
  form,
  licenseState,
}: {
  settings: AppSettings;
  /** Nur auf einer Client-Installation ausgewertet: zeigt an, ob der
   * letzte Verbindungsversuch zum Master abgelehnt wurde (2026-09-02). */
  licenseState: LicenseState | null;
  websites: WebsiteListResponse;
  /** Verlauf der gemeldeten Zählerstände über ALLE Websites – die
   * aufgeklappte Zeile filtert sich ihren Teil selbst heraus. */
  statsHistory: WebsiteStatsHistoryResponse;
  /** Das Formular der Einstellungsseite – die Schwellen der
   * Plausibilitätsprüfung hängen bewusst darin und werden vom globalen
   * "Speichern" oben mitgenommen, statt eine eigene Instant-Save-Karte zu
   * bekommen (Nutzervorgabe, 2026-09-01: einstellbar an genau dieser
   * Stelle). */
  form: UseFormReturn<SettingsValues>;
}) {
  const isMaster = settings.deploymentMode === "master";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selfDialogOpen, setSelfDialogOpen] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  // Nur eine Zeile gleichzeitig offen (Nutzervorgabe, 2026-09-01: der
  // Bereich ersetzt das vorherige Popup) – mehrere offene Bereiche würden
  // die Karte unübersichtlich lang machen.
  const [expandedWebsiteId, setExpandedWebsiteId] = useState<string | null>(
    null,
  );
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
        toastChecked(`Status: ${label} (soeben bestätigt).`);
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
              const isExpanded = expandedWebsiteId === website.id;
              // Verlauf dieser Installation aus der gemeinsam geladenen
              // Liste. Bewusst keine eigene Abfrage je Zeile: der Verlauf
              // enthält nur echte Änderungen (siehe recordStatsReport()),
              // ist also von Haus aus kurz.
              const history = statsHistory.items.filter(
                (entry) => entry.website.id === website.id,
              );
              return (
                <div
                  key={website.id}
                  className="rounded-xl border border-border bg-muted"
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpandedWebsiteId(isExpanded ? null : website.id)
                    }
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-border"
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
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90",
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="flex flex-col gap-4 border-t border-border p-3">
                      <WebsiteModePicker website={website} />

                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            Gemeldeter Zählerstand
                          </p>
                          <ConfirmDeleteDialog
                            title={`Zählerstand von „${website.name}“ zurücksetzen?`}
                            description="Löscht Verlauf, zuletzt gemeldete Zahlen und einen offenen Hinweis – nur für diese Webseite. Beim nächsten Prüfen füllen sich die Zahlen von selbst wieder."
                            confirmLabel="Zurücksetzen"
                            confirmingLabel="Setzt zurück…"
                            onConfirm={() =>
                              handleResetStatsHistory(website.id)
                            }
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
                        <p className="text-sm text-muted-foreground">
                          {website.reportedUserCount !== null
                            ? `${website.reportedPageCount} Seiten · ${website.reportedUserCount} Nutzer`
                            : "Noch nichts gemeldet – entsteht beim Prüfen."}
                        </p>
                        {website.statsAnomalyMessage && (
                          <p className="text-sm text-[#b45309] dark:text-[#f6cf7e]">
                            Unglaubwürdiger Rückgang:{" "}
                            {website.statsAnomalyMessage}
                          </p>
                        )}
                      </div>

                      {history.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-sm font-medium">Verlauf</p>
                          {/* Ein Eintrag je ÄNDERUNG, nicht je Prüfung –
                              zwei aufeinanderfolgende Zeilen sind deshalb
                              immer ein echter Sprung. */}
                          {history.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-sm"
                            >
                              <span>
                                <span className="font-semibold">
                                  {entry.pageCount}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  Seiten
                                </span>
                                <span className="px-1.5 text-muted-foreground">
                                  ·
                                </span>
                                <span className="font-semibold">
                                  {entry.userCount}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  Nutzer
                                </span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(entry.firstReportedAt)}
                                {entry.lastReportedAt !==
                                  entry.firstReportedAt &&
                                  ` – bestätigt ${formatRelativeTime(entry.lastReportedAt)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
          {/* Globale Teile der Plausibilitätsprüfung – alles, was NICHT zu
              einer einzelnen Zeile gehört (Nutzervorgabe, 2026-09-01:
              "kann man das nicht zusammenfassen, so dass alles in die
              obere kachel kommt"). Zählerstand, Verlauf und das
              Zurücksetzen je Webseite stecken jetzt im aufgeklappten
              Bereich der jeweiligen Zeile. */}
          <CardContent className="flex flex-col gap-3 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium">Plausibilitätsprüfung</p>
              <p className="text-sm text-muted-foreground">
                Seiten- und Nutzerzahlen melden die Installationen beim Prüfen
                selbst. Ein Rückgang wird nur gemeldet, wenn er beide Werte
                überschreitet.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="statsAnomalyRelativeDropPercent"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3">
                      <Label
                        htmlFor="statsAnomalyRelativeDropPercent"
                        className="text-sm"
                      >
                        Anteil in %
                      </Label>
                      <FormControl>
                        <Input
                          id="statsAnomalyRelativeDropPercent"
                          type="number"
                          min={1}
                          max={99}
                          className="w-20"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="statsAnomalyAbsoluteDrop"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3">
                      <Label
                        htmlFor="statsAnomalyAbsoluteDrop"
                        className="text-sm"
                      >
                        Mindestens
                      </Label>
                      <FormControl>
                        <Input
                          id="statsAnomalyAbsoluteDrop"
                          type="number"
                          min={1}
                          className="w-20"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            </div>
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
        {/* Nutzer-Bugreport, 2026-09-02: "der lizenzschlüssel ist falsch
            aber client hat positives feedback?". Der Client lief mit
            abgelehntem Schlüssel weiter und zeigte nirgends etwas an –
            das Signal (letzter VERSUCH neuer als letzter ERFOLG) gab es
            schon, nur sah es niemand. */}
        {licenseState &&
          "keySuspect" in licenseState &&
          licenseState.keySuspect && (
            <SystemMessage
              variant="error"
              title="Verbindung zur Lizenzverwaltung abgelehnt"
              description={`Der Schlüssel wurde beim letzten Versuch nicht akzeptiert. Letzter erfolgreicher Abgleich: ${
                "lastCheckInAt" in licenseState && licenseState.lastCheckInAt
                  ? new Date(licenseState.lastCheckInAt).toLocaleString("de-DE")
                  : "nie"
              }. Ohne gültigen Schlüssel sperrt sich diese Installation nach Ablauf des Tokens – bei abgelehntem Schlüssel bereits 2 Tage danach statt der sonst üblichen 7.`}
            />
          )}

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
