// Gemeinsame Basis für alles, was mit dem lokalen (localStorage-)
// Entwurfs-Autosave aus `content-editor-form.tsx` interagiert, ohne selbst
// der Content-Editor zu sein: Glocken-Badge und Systemnachrichten-Seite
// (Nutzervorgabe, 2026-08-16 – "es gibt nicht gespeicherte Entwürfe, wird
// aber nicht bei der Glocke angezeigt"). Bewusst als eigenes Modul statt in
// `content-editor-form.tsx` belassen, damit Header/Systemnachrichten-Seite
// nicht die große Editor-Komponente importieren müssen.
export const DRAFT_STORAGE_PREFIX = "pivot:content-draft:";

// Feuert im selben Tab, wenn sich ein Entwurf ändert (angelegt/gespeichert/
// verworfen) – der native `storage`-Event feuert nur in ANDEREN Tabs, hier
// sitzen Header und Content-Editor aber im selben Tab nebeneinander im
// Dashboard-Layout.
const DRAFTS_CHANGED_EVENT = "pivot:local-drafts-changed";

export function notifyLocalDraftsChanged() {
  window.dispatchEvent(new Event(DRAFTS_CHANGED_EVENT));
}

export function onLocalDraftsChanged(handler: () => void) {
  window.addEventListener(DRAFTS_CHANGED_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(DRAFTS_CHANGED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export interface LocalDraftEntry {
  key: string;
  /** `null` = Entwurf eines noch nicht angelegten ("neuer Inhalt")
   * Inhalts, kein direkt anspringbarer Bearbeiten-Link vorhanden. */
  contentId: string | null;
  title: string;
  savedAt: string;
}

/** Scannt `localStorage` nach allen Entwürfen – rein client-seitig, da
 * `localStorage` serverseitig (Server Components) nicht lesbar ist und
 * ausschließlich in diesem Browser existiert (siehe Hinweistext an den
 * Aufrufstellen). Kaputte/fremde Einträge werden übersprungen statt die
 * ganze Liste scheitern zu lassen. */
export function listLocalDrafts(): LocalDraftEntry[] {
  if (typeof window === "undefined") return [];
  const entries: LocalDraftEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(DRAFT_STORAGE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const snapshot = JSON.parse(raw) as { title?: string; savedAt?: string };
      const idPart = key.slice(DRAFT_STORAGE_PREFIX.length);
      entries.push({
        key,
        contentId: idPart.startsWith("new-") ? null : idPart,
        title: snapshot.title?.trim() || "Ohne Titel",
        savedAt: snapshot.savedAt ?? new Date().toISOString(),
      });
    } catch {
      // Kaputter Eintrag – ignorieren, kein kritischer Pfad.
    }
  }
  return entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
