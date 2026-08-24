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
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  /** "dark" = dunkle, hervorgehobene aktive Pille (Nutzervorgabe,
   * 2026-08-18, 1:1 nach Bildvorlage des Status-Felds im Content-Editor)
   * statt der sonst üblichen weißen aktiven Pille. */
  variant?: "light" | "dark";
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
      )}
      <div className="flex gap-1 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-1">
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
                  ? variant === "dark"
                    ? "bg-[#132033] text-white"
                    : "bg-white text-foreground shadow-sm"
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
