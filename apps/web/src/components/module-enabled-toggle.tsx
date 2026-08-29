"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
import { cn } from "@/lib/utils";

/** Administration → Module (Kachel-Übersicht) – Nutzervorgabe, 2026-08-29:
 * der Schalter ist ein Kill-Switch für ALLE Mandanten, nicht nur Masters
 * eigene Nutzung. Deaktivieren setzt das Modul überall auf inaktiv,
 * Reaktivieren gibt es nur an Mandanten zurück, die es bereits gebucht
 * hatten (Kaskade läuft serverseitig in `ModuleSettingsService.update`,
 * damit sie unabhängig davon gilt, ob hier oder unter Einstellungen →
 * Module umgeschaltet wird). `stopPropagation`/`preventDefault`, weil die
 * ganze Kachel ein `<Link>` zur Modul-Detailseite ist. */
export function ModuleEnabledToggle({
  moduleKey,
  enabled,
}: {
  moduleKey: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function patch(checked: boolean) {
    setPending(true);
    try {
      const res = await fetch(`/api/module-settings/${moduleKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toastEdited(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? "Modul deaktivieren" : "Modul aktivieren"}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        patch(!enabled);
      }}
      className={cn(
        "relative inline-flex h-[18.4px] w-[32px] shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        enabled ? "bg-primary" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "block size-4 rounded-full bg-white transition-transform",
          enabled ? "translate-x-[calc(100%-2px)]" : "translate-x-0",
        )}
      />
    </button>
  );
}
