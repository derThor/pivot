"use client";

import { useEffect, useState } from "react";

import { SystemMessage } from "@/components/ui/system-message";
import { listLocalDrafts, onLocalDraftsChanged } from "@/lib/local-drafts";

/** "Alles im grünen Bereich" darf nicht rein serverseitig entschieden
 * werden – lokale Entwürfe (siehe `local-drafts-section.tsx`) sind dem
 * Server unbekannt, ein serverseitig gerendertes "keine Meldungen" wäre
 * sonst falsch, solange noch ein Entwurf im Browser liegt. */
export function SystemMessagesEmptyState({
  hasAnyServerMessage,
}: {
  hasAnyServerMessage: boolean;
}) {
  const [hasLocalDrafts, setHasLocalDrafts] = useState<boolean | null>(null);

  useEffect(() => {
    function sync() {
      setHasLocalDrafts(listLocalDrafts().length > 0);
    }
    sync();
    return onLocalDraftsChanged(sync);
  }, []);

  if (hasAnyServerMessage || hasLocalDrafts === null || hasLocalDrafts) {
    return null;
  }

  return (
    <SystemMessage
      variant="success"
      title="Alles im grünen Bereich"
      description="Aktuell liegen keine aktiven Systemmeldungen vor."
    />
  );
}
