"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { toastWarning } from "@/components/app-toast";

/** Nutzervorgabe, 2026-08-25: statt einer dauerhaften Banner-Leiste ein Toast
 * unten rechts – bewusst OHNE "nicht mehr anzeigen"-Speicherung (weder
 * LocalStorage noch Server): das Weg-Klicken gilt nur für diese eine
 * Einblendung, bei jedem neuen Seitenaufruf/jeder Navigation im Dashboard
 * erscheint der Hinweis erneut (`usePathname()` als Trigger). */
export function LicenseDevelopmentToast() {
  const pathname = usePathname();

  useEffect(() => {
    toastWarning(
      "Entwicklungsinstanz – ungeprüft",
      "Diese Installation läuft im Entwicklungsmodus und ist bewusst von der Lizenzprüfung ausgenommen.",
    );
  }, [pathname]);

  return null;
}
