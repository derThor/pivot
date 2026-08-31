import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Eigenständige Kopie von apps/web/src/lib/utils.ts' `cn()` – dieses Paket
// darf nicht in die App zurückgreifen (umgekehrte Abhängigkeitsrichtung),
// die Funktion selbst ist trivial genug, dass eine zweite Quelle keine
// Drift-Gefahr birgt.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
