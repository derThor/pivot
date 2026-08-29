"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Macht UsersService.delete() rückgängig (Nutzervorgabe, 2026-08-21: "auf
 * gelöscht gesetzte nutzer sollen wiederhergestellt werden können, solange
 * sie nicht anonymisiert wurden") – an beiden Orten einsetzbar, an denen
 * gelöschte Nutzer aufgelistet werden: Benutzer-Seite (Tab "Gelöscht") und
 * Datenschutz (Tab "Benutzer"). Kein Bestätigungsdialog nötig, da die
 * Aktion selbst reversibel ist (macht ein Löschen rückgängig, ist keine
 * neue destruktive Aktion). */
export function UserRestoreButton({
  userId,
  name,
  onRestored,
}: {
  userId: string;
  name: string;
  /** Optionaler Hook für Aufrufer mit eigenem lokalem State (z.B.
   * data-subject-requests-panel-artiges Muster) – zusätzlich zu
   * `router.refresh()`, nicht als Ersatz. */
  onRestored?: () => void;
}) {
  const router = useRouter();
  const [isRestoring, setIsRestoring] = useState(false);

  async function handleRestore() {
    setIsRestoring(true);
    try {
      await fetch(`/api/users/${userId}/restore`, { method: "POST" });
      toastEdited(`„${name}“ wurde wiederhergestellt.`);
      onRestored?.();
      router.refresh();
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg border-border"
            aria-label={`„${name}“ wiederherstellen`}
            disabled={isRestoring}
            onClick={handleRestore}
          />
        }
      >
        <RotateCcw />
      </TooltipTrigger>
      <TooltipContent>Wiederherstellen</TooltipContent>
    </Tooltip>
  );
}
