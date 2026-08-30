/** Echte, aus den beiden Daten-Snapshots berechnete Änderungsbeschreibung
 * für eine Versionszeile (Nutzervorgabe, 2026-08-30, 1:1 nach Bildvorlage
 * "Versionen") – keine erfundenen Texte, nur eine Zusammenfassung dessen,
 * was sich zwischen zwei `Content.data`-Ständen tatsächlich geändert hat.
 * Gemeinsam genutzt von der Sidebar-Kurzbeschreibung und der
 * "Änderungen"-Tab-Aufschlüsselung in content-versions-explorer.tsx. */

export type FieldChangeKind = "added" | "removed" | "changed";

export interface FieldChange {
  field: string;
  kind: FieldChangeKind;
  oldValue: unknown;
  newValue: unknown;
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function stringifyValue(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Wie `stringifyValue`, aber eingerückt – nur für die zeilenbasierte
 * Diff-Darstellung im "Änderungen"-Tab, nicht für den Gleichheitsvergleich
 * oben (dort würde reine Formatierung sonst einen falschen Unterschied
 * vortäuschen). */
export function stringifyForDisplay(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

/** Vergleicht zwei Daten-Stände feldweise – `fieldNames` sollte die
 * Vereinigung aller Schlüssel beider Seiten sein, damit ein komplett neues
 * oder komplett entferntes Feld nicht übersehen wird. */
export function computeFieldChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  fieldNames: string[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fieldNames) {
    const oldValue = oldData[field];
    const newValue = newData[field];
    if (stringifyValue(oldValue) === stringifyValue(newValue)) continue;
    const kind: FieldChangeKind = isEmpty(oldValue)
      ? "added"
      : isEmpty(newValue)
        ? "removed"
        : "changed";
    changes.push({ field, kind, oldValue, newValue });
  }
  return changes;
}

const KIND_VERB: Record<FieldChangeKind, string> = {
  added: "hinzugefügt",
  removed: "entfernt",
  changed: "geändert",
};

/** Einzeilige Kurzfassung für die Sidebar-Karte, z.B. "Titel geändert,
 * Bild-Baustein hinzugefügt". Lange Ergebnisse werden per CSS `truncate`
 * an der Aufrufstelle abgeschnitten, nicht hier manuell gekürzt. */
export function summarizeFieldChanges(changes: FieldChange[]): string {
  if (changes.length === 0) return "Keine inhaltlichen Änderungen.";
  const parts = changes.map((c) => `${c.field} ${KIND_VERB[c.kind]}`);
  if (parts.length === 1) return `${parts[0]}.`;
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(", ");
  return `${rest} und ${last}.`;
}
