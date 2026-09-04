import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@pivot/blocks";

import { SiteLogo } from "@/components/site-logo";
import { NavMenu } from "@/components/nav-menu";

import { HeaderHeightSync } from "@/components/header-height-sync";
import type { SiteNavigation } from "@/lib/api";

/** Kopfbereich der öffentlichen Website nach dem Entwurf des Nutzers
 * ("Pivot Landing", 2026-09-02): klebender, halbtransparenter Balken mit
 * Weichzeichner, Logo-Kachel links, Menü mittig, Handlungsaufrufe rechts.
 *
 * Alle Menüpunkte kommen aus der unter Einstellungen → Frontend gewählten
 * Hauptnavigation; welche davon als Knopf erscheinen, entscheidet die
 * Darstellung am Menüpunkt. Ohne gewähltes Menü bleibt der Balken bis auf
 * das Logo leer – bewusst, statt Punkte zu erfinden.
 *
 * Das Logo ist ein Asset dieses Templates, keine Einstellung: das
 * Frontend-Template gehört zum jeweiligen Projekt (Nutzer-Einordnung,
 * 2026-09-03: "wir haben im Frontend ein template, das für jedes Projekt
 * unterschiedlich ist"). Nur die Administration sieht überall gleich aus.
 */
export function SiteHeader({
  siteTitle,
  navigation,
  sticky = true,
  style = "blur",
  children,
}: {
  siteTitle: string | null;
  navigation: SiteNavigation | null;
  /** Beide Werte kommen aus den Einstellungen, die DIESES Template in
   * seinem Manifest deklariert hat (`headerSticky`, `headerStyle`, siehe
   * template/manifest.ts). Die Vorgaben hier entsprechen dem Verhalten
   * von vorher – ohne gespeicherte Werte ändert sich nichts. */
  sticky?: boolean;
  style?: "blur" | "solid";
  /**
   * Inhalt des Bereichs "Kopfbereich" aus dem Designer (Stufe 2,
   * 2026-09-05). Ist er gefüllt, ersetzt er Logo/Menü/Knöpfe – der Rahmen
   * (Kleben, Weichzeichnen, Höhenmessung) bleibt in jedem Fall dieser
   * Komponente, weil Bausteine kein Verhalten haben.
   */
  children?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "z-50 border-b border-border",
        sticky && "sticky top-0",
        // Weichgezeichnet nur dann sinnvoll, wenn der Balken beim Scrollen
        // stehen bleibt – über einem mitlaufenden Balken gibt es nichts
        // durchscheinen zu lassen.
        sticky && style === "blur"
          ? "bg-background/85 backdrop-blur-md"
          : "bg-background",
      )}
    >
      <HeaderHeightSync />
      {children ? (
        // Bausteine aus dem Bereich "Kopfbereich" – sie bestimmen den
        // Aufbau vollständig, deshalb keine eingebaute Bahn drumherum
        // außer der Breitenbegrenzung.
        <div className="mx-auto w-full max-w-[var(--content-width,1180px)] px-6 sm:px-8">
          {children}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[var(--content-width,1180px)] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3.5 sm:px-8">
          <Link href="/" className="mr-auto flex items-center">
            <SiteLogo variant="light" siteTitle={siteTitle} priority />
          </Link>
          <NavMenu navigation={navigation} className="gap-x-8" />
        </div>
      )}
    </header>
  );
}
