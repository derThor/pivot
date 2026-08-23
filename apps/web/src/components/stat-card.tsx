/** Kachel für Kennzahlen-Übersichten (Papierkorb, Datenschutz, Seiten-
 * Übersicht, …) – ein einziges Muster statt es je Seite zu duplizieren. */
export function StatCard({
  label,
  value,
  sublabel,
  valueClassName,
}: {
  label: string;
  value: string;
  sublabel: string;
  /** Für farbige Zahlen, z.B. grün für "Veröffentlicht" (Nutzervorgabe,
   * 2026-08-18, 1:1 nach Bildvorlage der Seiten-Übersicht). */
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${valueClassName ?? ""}`}>
        {value}
      </p>
      <p className="text-sm text-muted-foreground">{sublabel}</p>
    </div>
  );
}
