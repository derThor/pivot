"use client";

import { cn } from "@/lib/utils";

/** Vier-Optionen-Auswahl für feste Zahlen-/"nie"-Presets (Mindestlänge,
 * Passwort-Ablauf, Sperre nach Fehlversuchen, Aufbewahrungsfristen – 1:1
 * nach Bildvorlage statt eines freien Zahlenfelds). Ursprünglich in
 * settings-form.tsx, extrahiert (2026-08-18), da die Datenschutz-Seite
 * denselben Picker für die Aufbewahrung-Fristen braucht. */
export function SegmentedPicker<T extends string | number>({
  label,
  options,
  value,
  onChange,
  variant = "light",
}: {
  /** Weggelassen = kein eigenes Label (z.B. wenn schon ein `FormLabel`
   * darüber steht, siehe Status-Feld im Content-Editor). */
  label?: string;
  options: {
    label: string;
    value: T;
    /** Ersetzt die sonst übliche weiße/dunkle aktive Pille durch eine
     * bedeutungstragende Farbe für GENAU diese Option, wenn sie aktiv ist
     * (z.B. Mandant-Mitgliedschaft: Aktiv grün/Inaktiv orange/Gesperrt
     * rot, Nutzervorgabe 2026-08-27) – Klassenname einer der `badge--*`-
     * Farbklassen aus globals.css, damit die Farbe app-weit konsistent
     * und theme-fähig bleibt statt einer neu erfundenen Ad-hoc-Farbe. */
    activeClassName?: string;
  }[];
  value: T;
  onChange: (value: T) => void;
  /** "dark" = dunkle, hervorgehobene aktive Pille (Nutzervorgabe,
   * 2026-08-18, 1:1 nach Bildvorlage des Status-Felds im Content-Editor)
   * statt der sonst üblichen weißen aktiven Pille.
   *
   * "onDark" = der Picker selbst steht auf einer dunklen Fläche
   * (Mandant-Detailkarte, 2026-09-01): Rahmen/Grund und die inaktiven
   * Beschriftungen werden aufgehellt, damit sie dort überhaupt lesbar
   * sind. Die aktive Pille bleibt unverändert – sie trägt über
   * `activeClassName` die Statusfarbe. */
  variant?: "light" | "dark" | "onDark";
}) {
  const onDark = variant === "onDark";
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span
          className={cn(
            "text-xs font-semibold tracking-wide uppercase",
            onDark ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
      )}
      <div
        className={cn(
          "flex flex-wrap gap-1 rounded-lg border p-1",
          onDark ? "border-white/15 bg-white/5" : "border-border bg-muted",
        )}
      >
        {options.map((option) => {
          // Zahl-Optionen ("30 Tage", "12 Monate") immer zweizeilig
          // darstellen (Zahl größer über dem Wort), statt sich auf
          // zufälliges Textumbruch-Verhalten je Bildschirmbreite zu
          // verlassen – Nutzervorgabe, 2026-08-18: "Zahlen immer über
          // Wort, also in 2 Zeilen". Optionen ohne Leerzeichen (z.B.
          // "unbegrenzt", Status-Werte wie "Entwurf") bleiben einzeilig.
          const spaceIndex = option.label.indexOf(" ");
          const [first, second] =
            spaceIndex === -1
              ? [option.label, null]
              : [
                  option.label.slice(0, spaceIndex),
                  option.label.slice(spaceIndex + 1),
                ];
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                value === option.value
                  ? (option.activeClassName ??
                      (variant === "dark"
                        ? "bg-dark-surface text-dark-surface-foreground"
                        : "bg-card text-foreground shadow-sm"))
                  : onDark
                    ? "text-white/60 hover:text-white"
                    : "text-muted-foreground hover:text-foreground",
              )}
            >
              {second ? (
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-base font-semibold">{first}</span>
                  <span className="text-xs font-normal">{second}</span>
                </span>
              ) : (
                first
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
