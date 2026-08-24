import type { Metadata } from "next";
import { getLicenseState } from "@/lib/api-server";

// Meta-Tag-Marker, den WebsiteMonitorService (Master-seitige Live-
// Überwachung, siehe knowledge-base/platform/master-slave-licensing.md)
// im HTML sucht, um eine korrekt angezeigte Wartungsseite von einer
// tatsächlich noch live laufenden Installation zu unterscheiden.
export const metadata: Metadata = {
  title: "Wartungsarbeiten",
  other: { "pivot-maintenance": "true" },
};

const DEFAULT_TITLE = "Wartungsarbeiten";
const DEFAULT_MESSAGE =
  "Diese Seite ist derzeit nicht erreichbar. Bitte versuche es später erneut.";

/** Wird von middleware.ts für alle geschützten Routen (Dashboard, Login,
 * Registrierung) angezeigt, sobald diese Installation im Slave-Modus
 * gesperrt ist. Inhalt konfigurierbar unter Einstellungen → Integrationen
 * (Nutzervorgabe: "Wartungsseite konfigurierbar"). */
export default async function LockedPage() {
  const state = await getLicenseState();
  const title =
    (state?.mode === "slave" &&
      state.status === "locked" &&
      state.maintenanceTitle) ||
    DEFAULT_TITLE;
  const message =
    (state?.mode === "slave" &&
      state.status === "locked" &&
      state.maintenanceMessage) ||
    DEFAULT_MESSAGE;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
