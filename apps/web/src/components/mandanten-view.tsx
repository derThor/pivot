"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Diamond,
  Globe,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { PaginationControls } from "@/components/pagination-controls";
import { StatCard } from "@/components/stat-card";
import { MandantDialog } from "@/components/mandant-dialog";
import {
  MandantHeaderShell,
  STATUS_ACCENT,
  initialsOf,
} from "@/components/mandant-header";
import { resolveImageSrc } from "@/lib/media";
import type {
  MandantListItem,
  MandantStats,
  ModuleCatalogEntry,
} from "@/lib/api-server";

// Reines Frontend-Mapping (Nutzervorgabe, 2026-08-27, Mockup: kleine
// farbige Icon-Kacheln statt Textlabels je gebuchtem Modul) – der
// Modul-Katalog selbst bleibt serverseitig, hier nur die Optik.
const MODULE_ICONS: Record<
  string,
  { icon: typeof Diamond; className: string }
> = {
  magicline: { icon: Diamond, className: "badge--blue" },
  datenschutz: { icon: ShieldCheck, className: "badge--ink" },
};

const STATUS_BADGE: Record<
  MandantListItem["status"],
  { label: string; className: string }
> = {
  active: { label: "Aktiv", className: "badge--green border-0" },
  inactive: { label: "Inaktiv", className: "badge--slate border-0" },
  locked: { label: "Gesperrt", className: "badge--red border-0" },
};

/** Übersicht "Administration → Mandanten" (Nutzervorgabe, 2026-08-27,
 * 1:1 nach Mockup): Kennzahlen-Kacheln + Kartenraster, ein Mandant kann
 * mehrere Websites haben. Seiten-/Nutzerzahlen aus dem Mockup bewusst
 * NICHT übernommen (Nutzerentscheidung: "weglassen fürs Erste") – der
 * Master hat keinen Einblick in die Inhalte einer Client-Installation. */
export function MandantenView({
  items,
  meta,
  stats,
  moduleCatalog,
}: {
  items: MandantListItem[];
  meta: { page: number; pageCount: number };
  stats: MandantStats;
  moduleCatalog: ModuleCatalogEntry[];
}) {
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mandanten</h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
            render={<Link href="/dashboard/websites" />}
          >
            <Globe />
            Zu den Webseiten
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            + Mandant anlegen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Mandanten"
          value={String(stats.mandantsTotal)}
          sublabel={`${stats.mandantsActive} aktiv`}
        />
        <StatCard
          label="Webseiten"
          value={String(stats.websitesTotal)}
          sublabel="über alle Mandanten"
        />
        <StatCard
          label="Modulzuweisungen"
          value={String(stats.moduleBookingsTotal)}
          sublabel={`${stats.modulesAvailableCount} Module verfügbar`}
        />
        <StatCard
          label="Gesperrt / Inaktiv"
          value={String(stats.lockedOrInactiveCount)}
          sublabel={`${stats.withLockReasonCount} mit Sperrvermerk`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((mandant) => {
          const primaryWebsite = mandant.websites[0] ?? null;
          const location = [mandant.postalCode, mandant.city]
            .filter(Boolean)
            .join(" ");
          const badge = STATUS_BADGE[mandant.status];
          const enabledModules = mandant.modules.filter(
            (entry) => entry.enabled,
          );
          return (
            <Link
              key={mandant.id}
              href={`/dashboard/mandanten/${mandant.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <MandantHeaderShell
                status={mandant.status}
                className="px-4 pt-9 pb-5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl text-sm leading-none font-bold"
                    style={{
                      background: mandant.logoUrl
                        ? "#fff"
                        : "rgba(255, 255, 255, 0.10)",
                      boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.16)",
                      color: STATUS_ACCENT[mandant.status],
                    }}
                  >
                    {mandant.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Logo kommt aus Nutzer-Upload (beliebige externe/lokale URL), kein next/image-Optimierungsfall.
                      <img
                        src={resolveImageSrc(mandant.logoUrl)}
                        alt=""
                        className="size-full object-contain p-1.5"
                      />
                    ) : (
                      initialsOf(mandant.name)
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15.5px] leading-[1.15] font-bold text-white">
                      {mandant.name}
                    </p>
                    {primaryWebsite?.domain && (
                      <p className="mt-1 truncate font-mono text-[11px] text-white/55">
                        {primaryWebsite.domain}
                      </p>
                    )}
                  </div>
                </div>
              </MandantHeaderShell>

              <div className="flex flex-1 flex-col gap-3 p-4">
                {/* Umbruch ist hier ausdrücklich erlaubt: die Kacheln einer
                    Rasterzeile sind ohnehin gleich hoch (Grid streckt sie,
                    der Kachel-Body ist `flex-1`, die Modulzeile hängt an
                    `mt-auto`) – eine umbrechende Statuszeile schiebt also
                    nur den Innenraum, statt die Kachel aus der Reihe zu
                    heben. Ein erster Versuch mit `flex-nowrap` presste den
                    Sperrvermerk stattdessen auf reine Icon-Breite
                    zusammen (Nutzer-Bugreport, 2026-09-01: "wenn
                    sperrvermerk oder andere texte zu lang, bricht es
                    falsch um"). */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Badge className={`shrink-0 ${badge.className}`}>
                    {badge.label}
                  </Badge>
                  {location && (
                    <span className="flex min-w-0 shrink items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{location}</span>
                    </span>
                  )}
                  {/* Im Kopf steht nur die erste Domain – bei mehreren
                      Webseiten wäre die Kachel sonst stillschweigend
                      unvollständig. */}
                  {mandant.websites.length > 1 && (
                    <Badge className="badge--slate shrink-0 border-0">
                      {mandant.websites.length} Webseiten
                    </Badge>
                  )}
                  {/* Sperrvermerk als kompakter Warnhinweis (Nutzervorgabe,
                      2026-09-01) – Farben exakt die `warning`-Variante aus
                      `ui/system-message.tsx`, nur als einzeiliger Chip
                      statt als volle Box, die die Kachelhöhe sprengen
                      würde. Der vollständige Text hängt im `title`, weil
                      er auf schmalen Kacheln abgeschnitten wird.
                      `basis-48` ist der Kern der Mobil-Korrektur: bleiben
                      neben Badge und Standort keine 12rem übrig, rutscht
                      der Chip in eine eigene Zeile und nimmt dort die
                      volle Breite (`flex-1`), statt sich bis auf sein
                      Icon zusammenpressen zu lassen. */}
                  {mandant.status === "locked" && (
                    <span
                      title={mandant.lockReason ?? undefined}
                      className="flex min-w-0 flex-1 basis-48 items-center gap-1.5 rounded-md border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-xs text-[#78350f] dark:border-[#6b5220] dark:bg-[#3d2f10] dark:text-[#f8e6bd]"
                    >
                      <AlertTriangle className="size-3.5 shrink-0 text-[#b45309] dark:text-[#f6cf7e]" />
                      {/* Ohne hinterlegten Vermerk bleibt der Chip stehen
                          und benennt die Lücke: die Detailseite verlangt
                          bei "Gesperrt" einen Sperrvermerk ("Zugang
                          gesperrt, Sperrvermerk erforderlich"), ein
                          stummes Nichts würde diesen offenen Punkt in der
                          Übersicht verschlucken. */}
                      <span className="truncate">
                        {mandant.lockReason?.trim() || (
                          <span className="italic">
                            Kein Sperrvermerk hinterlegt
                          </span>
                        )}
                      </span>
                    </span>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
                  {enabledModules.length > 0 ? (
                    enabledModules.map((entry) => {
                      const config = MODULE_ICONS[entry.moduleKey];
                      const Icon = config?.icon ?? Diamond;
                      const label =
                        moduleCatalog.find((m) => m.key === entry.moduleKey)
                          ?.label ?? entry.moduleKey;
                      return (
                        <span
                          key={entry.moduleKey}
                          // `shrink-0 max-w-full`: ein Modul rutscht bei
                          // Platzmangel komplett in die nächste Zeile,
                          // statt sein Label anzuschneiden – erst wenn ein
                          // einzelnes Label breiter als die Kachel ist,
                          // greift das `truncate` darunter.
                          className="flex min-w-0 max-w-full shrink-0 items-center gap-2"
                        >
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${config?.className ?? "badge--slate"}`}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="truncate text-sm text-muted-foreground">
                            {label}
                          </span>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Keine Module
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <PaginationControls
        page={meta.page}
        pageCount={meta.pageCount}
        buildHref={(p) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("page", String(p));
          return `/dashboard/mandanten?${params.toString()}`;
        }}
      />

      <MandantDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
