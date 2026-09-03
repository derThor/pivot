import Image from "next/image";

import {
  brandLogoOnDark,
  brandLogoOnLight,
  type BrandLogo,
} from "@/template/brand";

/** Anzeigehöhe des Logos in beiden Fassungen. Die Breite ergibt sich aus
 * den echten Bildmaßen (siehe template/brand.ts). */
const HEIGHT = 38;

/**
 * Logo der Website – GETEILTER Code. Was gezeigt wird, entscheidet allein
 * `template/brand.ts`, und die Datei gehört dem jeweiligen Projekt.
 *
 * Das ist die Lehre aus zwei Vorfällen (2026-09-03): Bei einem Merge
 * kommen fremde Dateien mit, sobald nur die Gegenseite etwas geändert hat
 * – `merge=ours` greift nur bei beidseitigen Änderungen. Solange diese
 * Datei selbst das Logo festlegte, konnte ein Merge das Aussehen einer
 * Website verändern. Jetzt dürfen fremde Logo-Dateien mitwandern: sie
 * werden nicht referenziert, wenn sie hier nicht eingetragen sind.
 *
 * Ohne eingetragenes Logo steht der Website-Titel als Wortmarke – ein
 * fehlendes Bild wäre schlechter als der Name, den die Installation
 * ohnehin führt.
 */
export function SiteLogo({
  variant,
  siteTitle,
  priority,
}: {
  /** "light" = auf hellem Grund (Kopfbereich), "dark" = auf dunklem. */
  variant: "light" | "dark";
  siteTitle: string | null;
  priority?: boolean;
}) {
  const logo: BrandLogo | null =
    variant === "dark" ? brandLogoOnDark : brandLogoOnLight;
  const title = siteTitle?.trim();

  if (logo) {
    return (
      <Image
        src={logo.src}
        alt={title || "Startseite"}
        width={Math.round((HEIGHT * logo.width) / logo.height)}
        height={HEIGHT}
        priority={priority}
        className="h-[38px] w-auto"
      />
    );
  }

  if (!title) return null;
  return (
    <span
      className={
        variant === "dark"
          ? "text-[19px] font-extrabold text-white"
          : "text-[19px] font-extrabold"
      }
    >
      {title}
    </span>
  );
}
