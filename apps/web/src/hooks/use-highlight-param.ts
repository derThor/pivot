"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Liest `?highlight=<id>&q=<begriff>` aus der URL (gesetzt von der
 * globalen Suche beim Klick auf einen Treffer), scrollt das passende
 * Element (`id={`${prefix}-${id}`}`) ins Blickfeld und liefert dessen ID
 * zurück, damit der Aufrufer den Suchbegriff im Treffer-Text farblich
 * hervorheben kann (siehe `HighlightText`). Die Markierung bleibt aktiv,
 * bis irgendwo auf der Seite geklickt wird.
 */
export function useHighlightParam(prefix: string) {
  const searchParams = useSearchParams();
  const targetId = searchParams.get("highlight");
  const query = searchParams.get("q");

  // Render-Zeit-Anpassung statt setState im Effekt (vermeidet
  // react-hooks/set-state-in-effect): sobald sich die URL ändert,
  // übernimmt activeId den neuen Zielwert sofort.
  const [activeId, setActiveId] = useState(targetId);
  const [syncedTargetId, setSyncedTargetId] = useState(targetId);
  if (targetId !== syncedTargetId) {
    setSyncedTargetId(targetId);
    setActiveId(targetId);
  }

  useEffect(() => {
    if (!activeId) return;
    document
      .getElementById(`${prefix}-${activeId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });

    function clear() {
      setActiveId(null);
    }
    // Erster Klick irgendwo auf der Seite hebt die Markierung wieder auf
    // (capture-Phase, damit ein gestopptes Bubbling in einem verschachtelten
    // Handler das Löschen nicht verhindert).
    document.addEventListener("click", clear, { capture: true, once: true });
    return () =>
      document.removeEventListener("click", clear, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return { activeId, query };
}
