"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SystemMessage } from "@/components/ui/system-message";
import {
  listLocalDrafts,
  notifyLocalDraftsChanged,
  onLocalDraftsChanged,
  type LocalDraftEntry,
} from "@/lib/local-drafts";

/** Rein client-seitig (siehe lib/local-drafts.ts) – anders als die übrigen
 * Systemmeldungen auf dieser Seite (Wartungsmodus, Speicherkontingent,
 * Webhooks, alle Server-weit) betreffen lokale Entwürfe nur diesen einen
 * Browser. Deshalb der explizite Hinweistext an jedem Eintrag statt einer
 * einzigen Sammel-Meldung. */
export function LocalDraftsSection() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<LocalDraftEntry[] | null>(null);

  useEffect(() => {
    function sync() {
      setDrafts(listLocalDrafts());
    }
    sync();
    return onLocalDraftsChanged(sync);
  }, []);

  function discard(key: string) {
    localStorage.removeItem(key);
    notifyLocalDraftsChanged();
    setDrafts(listLocalDrafts());
  }

  if (drafts === null || drafts.length === 0) return null;

  return (
    <>
      {drafts.map((draft) => (
        <SystemMessage
          key={draft.key}
          variant="warning"
          title={`Nicht gespeicherter Entwurf: ${draft.title}`}
          description={`Gespeichert am ${new Date(draft.savedAt).toLocaleString("de-DE")} – nur in diesem Browser sichtbar, nicht bei anderen Nutzern.`}
          actions={
            <>
              {draft.contentId && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(`/dashboard/content/${draft.contentId}/edit`)
                  }
                >
                  Öffnen
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => discard(draft.key)}
              >
                Verwerfen
              </Button>
            </>
          }
        />
      ))}
    </>
  );
}
