"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { toastWarning } from "@/components/app-toast";

const TOAST_ID = "license-development";

/** Nutzervorgabe, 2026-08-25: statt einer dauerhaften Banner-Leiste ein Toast
 * unten rechts – bewusst OHNE "nicht mehr anzeigen"-Speicherung (weder
 * LocalStorage noch Server). Bleibt dauerhaft sichtbar (`duration: Infinity`,
 * kein automatisches Ausblenden) und wird erst nach dem Wegklicken wieder
 * neu eingeblendet: dieselbe feste `id` sorgt dafür, dass ein erneuter
 * Aufruf bei jeder Navigation (`usePathname()`) einen noch offenen Toast nur
 * aktualisiert statt ihn zu duplizieren. */
export function LicenseDevelopmentToast({
  autoLockAt,
}: {
  autoLockAt?: string | null;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // Nutzervorgabe, 2026-08-25: "baue es so, dass Entwicklermodus immer
    // nach spätestens 3 Tagen gesperrt wird, bis zur Reaktivierung.
    // Schreibe das in den Toast" – zeigt bei bekanntem Ablaufdatum das
    // konkrete Datum, sonst nur den allgemeinen Hinweis (z.B. sehr frische
    // Installation ohne bisherigen Check).
    const deadline = autoLockAt
      ? new Date(autoLockAt).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null;
    toastWarning(
      "Entwicklungsinstanz – ungeprüft",
      `Diese Installation läuft im Entwicklungsmodus. Ohne Reaktivierung wird sie spätestens nach 3 Tagen automatisch gesperrt${deadline ? ` (am ${deadline})` : ""}.`,
      { id: TOAST_ID, duration: Infinity },
    );
  }, [pathname, autoLockAt]);

  return null;
}
