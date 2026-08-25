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
export function LicenseDevelopmentToast() {
  const pathname = usePathname();

  useEffect(() => {
    toastWarning(
      "Entwicklungsinstanz – ungeprüft",
      "Diese Installation läuft im Entwicklungsmodus und ist bewusst von der Lizenzprüfung ausgenommen.",
      { id: TOAST_ID, duration: Infinity },
    );
  }, [pathname]);

  return null;
}
