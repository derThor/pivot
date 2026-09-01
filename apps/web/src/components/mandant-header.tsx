import { cn } from "@/lib/utils";
import type { MandantListItem } from "@/lib/api-server";

// Kachel-/Seitenkopf eines Mandanten (Nutzervorgabe, 2026-09-01, CSS 1:1
// mitgeliefert) – bewusst feste Hex-Werte statt Theme-Tokens: der Kopf ist
// in beiden Themes dunkel, die Farben stammen unverändert aus der Vorlage.
export const HEADER_BG = "#132033";
export const HEADER_ACCENT = "#bce64d";

/** Farbe der Initialen in der Logo-Kachel – folgt dem Status, damit sie
 * dieselbe Aussage trägt wie der Statusstreifen (Nutzervorgabe,
 * 2026-09-01: "nimm bei aktiv das logo grün wie auf dem bild"). Bewusst
 * eine eigene Map neben `STATUS_BAR_COLOR`: der Streifen ist eine Fläche
 * und verträgt das blasse `white/45` für "inaktiv", Text in derselben
 * Deckkraft wäre dagegen kaum lesbar. */
export const STATUS_ACCENT: Record<MandantListItem["status"], string> = {
  active: HEADER_ACCENT,
  locked: "#f6cf7e",
  inactive: "rgba(255, 255, 255, 0.75)",
};

const STATUS_BAR_COLOR: Record<MandantListItem["status"], string> = {
  active: HEADER_ACCENT,
  locked: "#f6cf7e",
  // 0.45 statt der 0.22 aus der Vorlage (Nutzervorgabe, 2026-09-01:
  // "inaktiv balken in light heller machen") – bei 0.22 war der Streifen
  // auf dem dunklen Kopf kaum vom Hintergrund zu unterscheiden. Bewusst
  // in beiden Themes derselbe Wert: der Kopf ist immer gleich dunkel,
  // eine theme-abhängige Fassung hätte hier keinen Bezugspunkt.
  inactive: "rgba(255, 255, 255, 0.45)",
};

// Die Abdunkelung von links (damit Logo und Name über dem Motiv lesbar
// bleiben) steht als `.mandant-header-scrim` in globals.css, weil Light-
// und Dark-Modus dort unterschiedliche Verläufe bekommen – ein
// `style`-Attribut könnte keine `dark:`-Variante tragen.

/** Bögen-Motiv im Kopf. Als Inline-SVG statt als Bilddatei
 * (`tenant_cover_2.png` aus der Vorlage): keine Asset-Datei, die
 * mitgepflegt und ausgeliefert werden muss, scharf auf jeder
 * Pixeldichte und in jeder Breite. Soll später doch ein echtes
 * Foto/Rendering rein, tritt hier ein `<img>` an seine Stelle –
 * Scrim, Statusstreifen und Hover-Zoom bleiben gleich. */
function TenantCover({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 320 116"
      // Die untere rechte Ecke ist der Ankerpunkt, weil dort das Zentrum
      // der Ringe liegt – mit dem sonst üblichen `xMidYMid` würde sie bei
      // breiteren Kacheln aus dem Bild geschnitten und die engen inneren
      // Bögen verschwänden.
      preserveAspectRatio="xMaxYMax slice"
    >
      {/* Zentrum auf der UNTEREN rechten Ecke, nicht rechts auf halber
          Höhe: dadurch schneidet der Kopf aus jedem Ring den oberen
          Viertelkreis heraus und die Linien sind sichtbar rund
          ("halb rund", Nutzervorgabe 2026-09-01) – bei einem Zentrum auf
          halber Höhe laufen sie dagegen flach nach links aus. Die grünen
          Linien tragen das Motiv, die weißen liegen als feine
          Zwischenringe dazwischen. */}
      {[30, 52, 76, 102, 130, 160, 192, 226, 262].map((r, i) => (
        <circle
          key={r}
          cx={300}
          cy={116}
          r={r}
          fill="none"
          strokeWidth={i % 2 === 0 ? 1.2 : 0.8}
          stroke={
            i % 2 === 0
              ? `rgba(188, 230, 77, ${0.5 - i * 0.03})`
              : `rgba(255, 255, 255, ${0.12 - i * 0.008})`
          }
        />
      ))}
    </svg>
  );
}

/** "Kanzlei Nord" → "KN". Ein einzelnes Wort liefert die ersten beiden
 * Buchstaben, damit die Kachel nie mit nur einem Zeichen dasteht. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Dunkler Kopf mit Bögen-Motiv, Scrim und Statusstreifen – gemeinsam
 * genutzt von der Mandanten-Übersicht (Kachel) und der Detailseite, damit
 * die beiden nicht auseinanderlaufen. Innenabstände kommen über
 * `className` von außen, weil die Kachel enger sitzt (`px-4 pt-9 pb-5`)
 * als der Seitenkopf (`p-6`).
 *
 * Der Hover-Zoom hängt an einem `group` weiter oben: auf der Übersicht
 * trägt die ganze Kachel diese Klasse (wie `.tenant-card:hover` in der
 * Vorlage), auf der Detailseite gibt es keine – dort bleibt das Motiv
 * still stehen, was für eine nicht anklickbare Fläche auch richtig ist. */
export function MandantHeaderShell({
  status,
  className,
  children,
}: {
  status: MandantListItem["status"];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: HEADER_BG }}
    >
      <TenantCover
        className={cn(
          "absolute inset-0 size-full transition-transform duration-500 group-hover:scale-[1.04]",
          // Gesperrt/inaktiv: das Motiv tritt zurück, damit der Kopf auf
          // einen Blick gedämpfter wirkt (Vorlage).
          status !== "active" && "opacity-[0.78]",
        )}
      />
      <div className="mandant-header-scrim absolute inset-0" />
      <div className="relative">{children}</div>
      {/* 6px statt der 3px aus der Vorlage (Nutzervorgabe, 2026-09-01:
          "die linien, die den status anzeigen sollen höher sein") – der
          Streifen ist der einzige Statusträger im Kopf und war als
          Haarlinie zu leicht zu übersehen. */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1.5"
        style={{ background: STATUS_BAR_COLOR[status] }}
      />
    </div>
  );
}
