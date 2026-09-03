import Image from "next/image";

/** Beide Logo-Fassungen liegen als Asset in diesem Template
 * (`public/brand/`) und nicht in den Einstellungen: das Frontend-Template
 * gehört zum jeweiligen Projekt (Nutzer-Einordnung, 2026-09-03: "wir haben
 * im Frontend ein template, das für jedes Projekt unterschiedlich ist …
 * backend template ui ist immer gleich"). Eine andere Installation bringt
 * hier ihr eigenes Logo mit, statt das fremde über eine Einstellung
 * abwählen zu müssen.
 *
 * Zwei Dateien statt einer umgefärbten: das Logo wechselt zwischen hellem
 * und dunklem Grund nicht nur die Schriftfarbe, sondern dreht Kachel und
 * "p" um (dunkle Kachel mit Lime-p im Header, Lime-Kachel mit dunklem p
 * im Footer). Ein CSS-Filter könnte das nicht leisten, ohne die
 * Lime-Fläche zu zerstören – in der Administration liegt dafür eigens ein
 * Duotone-SVG-Filter (siehe apps/web/src/app/layout.tsx), der hier
 * schlicht nicht nötig ist, weil beide Fassungen als Datei vorliegen. */
const SOURCES = {
  light: "/brand/logo-on-light.png",
  dark: "/brand/logo-on-dark.png",
} as const;

// Seitenverhältnis der Dateien (817 × 336). Die Höhe ist so gewählt, dass
// die Kachel im Logo die 34px des Entwurfs trifft.
const HEIGHT = 38;
const WIDTH = Math.round((HEIGHT * 817) / 336);

export function SiteLogo({
  variant,
  siteTitle,
  priority,
}: {
  variant: keyof typeof SOURCES;
  /** Alternativtext – der Schriftzug steht im Bild, nicht daneben. */
  siteTitle: string | null;
  priority?: boolean;
}) {
  return (
    <Image
      src={SOURCES[variant]}
      alt={siteTitle?.trim() || "Startseite"}
      width={WIDTH}
      height={HEIGHT}
      priority={priority}
      className="h-[38px] w-auto"
    />
  );
}
