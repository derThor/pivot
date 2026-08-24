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

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeploymentModeDialog } from "@/components/deployment-mode-dialog";
import { LicenseApiKeyDialog } from "@/components/license-api-key-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { WebsiteModeDialog } from "@/components/website-mode-dialog";
import { formatRelativeTime } from "@/lib/utils";
import type {
  AppSettings,
  LicenseState,
  WebsiteListItem,
  WebsiteListResponse,
  WebsiteStatus,
} from "@/lib/api-server";

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
  development: "Entwicklung",
  unchecked: "Ungeprüft",
  pending: "Karenzzeit",
  locked: "Gesperrt",
};

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
}: {
  settings: AppSettings;
  websites: WebsiteListResponse;
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
      const res = await fetch("/api/license/recheck", { method: "POST" });
      const data = (await res.json().catch(() => null)) as LicenseState | null;
      if (!res.ok) return;
      const label =
        data && "status" in data
          ? (STATUS_LABEL[data.status] ?? data.status)
          : "unbekannt";
      toastEdited(`Geprüft – Status: ${label}.`);
      router.refresh();
    } finally {
      setIsRechecking(false);
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader
        className={
          !isMaster ? "flex-row items-center justify-between" : undefined
        }
      >
        <div>
          <CardTitle>Mandanten</CardTitle>
          {isMaster && (
            <p className="text-sm text-muted-foreground">
              Neue Projekte unter Administration → Webseite erscheinen hier
              automatisch.
            </p>
          )}
        </div>
        {!isMaster && (
          <Button
            type="button"
            variant="outline"
            className="border-[#D4D4D4]"
            disabled={isRechecking}
            onClick={handleRecheck}
          >
            <RotateCcw />
            {isRechecking ? "Prüft…" : "Jetzt prüfen"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-xl bg-[#FAFAFA] p-3">
          <button
            type="button"
            disabled={!isMaster}
            onClick={() => setSelfDialogOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors disabled:cursor-default enabled:hover:bg-[#F0F0F0]"
          >
            <span
              className={
                isMaster
                  ? "flex size-10 shrink-0 items-center justify-center rounded-lg bg-lime-100 text-lime-700"
                  : "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              }
            >
              <ShieldCheck className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">Diese Installation</p>
                <span
                  className={
                    isMaster
                      ? "shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                      : "shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700"
                  }
                >
                  {isMaster ? "Master" : "Client"}
                </span>
              </div>
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

        {websites.items.map((website) => {
          const badge = STATUS_BADGE[website.status];
          return (
            <button
              key={website.id}
              type="button"
              disabled={!isMaster}
              onClick={() => setWebsiteDialogTarget(website)}
              className="flex items-center gap-3 rounded-xl bg-[#FAFAFA] p-3 text-left transition-colors disabled:cursor-default enabled:hover:bg-[#F0F0F0]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Globe className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{website.name}</p>
                  <span
                    className={
                      website.deploymentMode === "master"
                        ? "shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                        : "shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700"
                    }
                  >
                    {website.deploymentMode === "master" ? "Master" : "Client"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {website.domain}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {website.lastCheckInAt
                  ? formatRelativeTime(website.lastCheckInAt)
                  : "Noch nicht geprüft"}
              </span>
              {isMaster && (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </CardContent>

      {isMaster && websites.meta.pageCount > 1 && (
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
      )}

      {isMaster && (
        <>
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
        </>
      )}

      {!isMaster && (
        <LicenseApiKeyDialog
          open={apiKeyDialogOpen}
          onOpenChange={setApiKeyDialogOpen}
        />
      )}
    </Card>
  );
}
