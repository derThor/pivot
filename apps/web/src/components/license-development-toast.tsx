"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { toastWarning } from "@/components/app-toast";

const TOAST_ID = "license-development";
// Gleiches Intervall wie middleware.ts' LOCKED_CACHE_TTL_MS – konsistente
// Reaktionszeit für Statuswechsel app-weit.
const POLL_INTERVAL_MS = 30_000;

interface LicenseStateResponse {
  mode?: "master" | "slave";
  status?: string;
  autoLockAt?: string | null;
}

/** Nutzervorgabe, 2026-08-25: statt einer dauerhaften Banner-Leiste ein Toast
 * unten rechts – bewusst OHNE "nicht mehr anzeigen"-Speicherung (weder
 * LocalStorage noch Server). Bleibt dauerhaft sichtbar (`duration: Infinity`,
 * kein automatisches Ausblenden) und wird erst nach dem Wegklicken wieder
 * neu eingeblendet: dieselbe feste `id` sorgt dafür, dass ein erneuter
 * Aufruf bei jeder Navigation (`usePathname()`) einen noch offenen Toast nur
 * aktualisiert statt ihn zu duplizieren.
 *
 * Update 2026-08-25, Nutzer-Bugreport ("Toast kommt nicht sofort und
 * zuverlässig bei Entwicklerstatus"): hing vorher komplett von einem
 * EINMALIGEN Server-Render von dashboard/layout.tsx ab – Next.js re-fetcht
 * das gemeinsame Layout nicht bei jeder Client-seitigen Navigation, ein
 * zwischenzeitlicher Statuswechsel (z.B. vom Master ausgelöst, während die
 * Seite schon offen war) blieb deshalb bis zum nächsten harten Seitenaufruf
 * unsichtbar – "nicht sofort", und je nachdem, ob/wann Next.js zufällig neu
 * rendert, auch "nicht zuverlässig". Holt den Status jetzt aktiv selbst
 * (Mount, jede Navigation, Fenster-Fokus, alle 30s) und blendet den Toast
 * bei Bedarf auch wieder aus (z.B. nach externer Reaktivierung), statt sich
 * auf einen Server-Snapshot zu verlassen. Wird deshalb in
 * dashboard/layout.tsx jetzt unconditional für jede Client-Installation
 * gemountet, nicht mehr nur, wenn der Status beim Seitenaufruf zufällig
 * schon "development" war. */
export function LicenseDevelopmentToast() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      const res = await fetch("/api/license/state", {
        cache: "no-store",
      }).catch(() => null);
      const data = (await res
        ?.json()
        .catch(() => null)) as LicenseStateResponse | null;
      if (cancelled) return;

      if (data?.mode === "slave" && data.status === "development") {
        const deadline = data.autoLockAt
          ? new Date(data.autoLockAt).toLocaleDateString("de-DE", {
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
      } else {
        // Status hat sich zwischenzeitlich geändert (z.B. reaktiviert) –
        // einen noch offenen Toast nicht stehen lassen.
        toast.dismiss(TOAST_ID);
      }
    }

    void checkStatus();
    const interval = setInterval(() => void checkStatus(), POLL_INTERVAL_MS);
    window.addEventListener("focus", checkStatus);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", checkStatus);
    };
  }, [pathname]);

  return null;
}
