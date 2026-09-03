import Link from "next/link";

import { SiteLogo } from "@/components/site-logo";

import type { SiteNavigation, SiteNavigationItem } from "@/lib/api";

/** Klassen je Darstellung eines Menüpunkts (`NavigationItem.appearance`).
 * Die beiden Knopf-Varianten stehen rechts vom eigentlichen Menü – im
 * Entwurf sind das "Anmelden" und "Demo buchen". */
const APPEARANCE_CLASS = {
  LINK: "text-[14.5px] font-medium text-muted-foreground hover:text-accent-link",
  TEXT_BUTTON: "px-3.5 py-2 text-[14.5px] font-semibold hover:text-accent-link",
  ACCENT_BUTTON:
    "rounded-full bg-accent px-5 py-2.5 text-[14.5px] font-bold text-accent-ink hover:bg-accent-strong",
} as const;

function NavLink({ item }: { item: SiteNavigationItem }) {
  const className = APPEARANCE_CLASS[item.appearance] ?? APPEARANCE_CLASS.LINK;
  // Externe Ziele ohne href gibt es nicht (der Menü-Endpunkt filtert
  // Einträge ohne erreichbares Ziel bereits weg), der Fallback ist reine
  // Absicherung gegen einen leeren Link.
  const href = item.href ?? "/";
  const external = href.startsWith("http");

  if (external || item.openInNewTab) {
    return (
      <a
        href={href}
        className={className}
        {...(item.openInNewTab && {
          target: "_blank",
          rel: "noopener noreferrer",
        })}
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {item.label}
    </Link>
  );
}

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
}: {
  siteTitle: string | null;
  navigation: SiteNavigation | null;
}) {
  const items = navigation?.items ?? [];
  const links = items.filter((item) => item.appearance === "LINK");
  const actions = items.filter((item) => item.appearance !== "LINK");
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[var(--content-width,1180px)] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3.5 sm:px-8">
        <Link href="/" className="mr-auto flex items-center">
          <SiteLogo variant="light" siteTitle={siteTitle} priority />
        </Link>

        {links.length > 0 && (
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {links.map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </nav>
        )}

        {actions.length > 0 && (
          <div className="flex items-center gap-3">
            {actions.map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
