"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, ChevronRight, Diamond, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { PaginationControls } from "@/components/pagination-controls";
import { StatCard } from "@/components/stat-card";
import { MandantDialog } from "@/components/mandant-dialog";
import { resolveImageSrc } from "@/lib/media";
import type { MandantListItem, MandantStats } from "@/lib/api-server";

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
}: {
  items: MandantListItem[];
  meta: { page: number; pageCount: number };
  stats: MandantStats;
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
            className="border-border"
            render={<Link href="/dashboard/websites" />}
          >
            Zu den Websites
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
          label="Websites"
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
          return (
            <Link
              key={mandant.id}
              href={`/dashboard/mandanten/${mandant.id}`}
              className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                className="relative flex items-center gap-3 p-4"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #3c4d24 0%, #16202b 55%, #0a0e16 100%)",
                }}
              >
                {mandant.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Logo kommt aus Nutzer-Upload (beliebige externe/lokale URL), kein next/image-Optimierungsfall.
                  <img
                    src={resolveImageSrc(mandant.logoUrl)}
                    alt=""
                    className="h-10 w-24 shrink-0 rounded-lg bg-primary object-contain px-3 py-1"
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Building2 className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">
                    {mandant.name}
                  </p>
                  <p className="truncate text-sm text-white/70">
                    {primaryWebsite?.domain}
                  </p>
                  {location && (
                    <p className="truncate text-xs text-white/60">{location}</p>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-white/60" />
              </div>

              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={badge.className}>{badge.label}</Badge>
                  <Badge className="badge--slate border-0">
                    {mandant.websites.length}{" "}
                    {mandant.websites.length === 1 ? "Website" : "Websites"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span />
                  {mandant.modules.some((entry) => entry.enabled) ? (
                    <div className="flex items-center gap-1.5">
                      {mandant.modules
                        .filter((entry) => entry.enabled)
                        .map((entry) => {
                          const config = MODULE_ICONS[entry.moduleKey];
                          if (!config) return null;
                          const Icon = config.icon;
                          return (
                            <span
                              key={entry.moduleKey}
                              className={`flex size-6 shrink-0 items-center justify-center rounded-md ${config.className}`}
                            >
                              <Icon className="size-3.5" />
                            </span>
                          );
                        })}
                    </div>
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
