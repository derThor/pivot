import Link from "next/link";

import { cn } from "@pivot/blocks";
import type { SiteNavigation, SiteNavigationItem } from "@/lib/api";

/** Klassen je Darstellung eines Menüpunkts (`NavigationItem.appearance`).
 * Die beiden Knopf-Varianten stehen im Entwurf rechts vom eigentlichen
 * Menü – "Anmelden" und "Demo buchen". */
const APPEARANCE_CLASS = {
  LINK: "pv-nav-link text-[14.5px] font-medium text-muted-foreground hover:text-accent-link",
  TEXT_BUTTON:
    "pv-nav-button px-3.5 py-2 text-[14.5px] font-semibold hover:text-accent-link",
  ACCENT_BUTTON:
    "pv-nav-button rounded-full bg-accent px-5 py-2.5 text-[14.5px] font-bold text-accent-ink hover:bg-accent-strong",
} as const;

export function NavLink({ item }: { item: SiteNavigationItem }) {
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

/**
 * Eine Menüleiste – benutzt vom eingebauten Kopfbereich UND vom
 * Menü-Baustein in einem Template-Bereich (2026-09-05). Vorher stand das
 * doppelt: als der Baustein dazukam, wäre es die zweite Kopie geworden.
 *
 * Knopf-Punkte (`TEXT_BUTTON`/`ACCENT_BUTTON`) stehen als Gruppe hinter
 * den einfachen Links, so wie im Entwurf.
 */
export function NavMenu({
  navigation,
  className,
}: {
  navigation: SiteNavigation | null;
  className?: string;
}) {
  const items = navigation?.items ?? [];
  if (items.length === 0) return null;
  const links = items.filter((item) => item.appearance === "LINK");
  const actions = items.filter((item) => item.appearance !== "LINK");

  return (
    <div
      className={cn(
        "pv-nav flex flex-wrap items-center gap-x-6 gap-y-2",
        className,
      )}
    >
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
  );
}
