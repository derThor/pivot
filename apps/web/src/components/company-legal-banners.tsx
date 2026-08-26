import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SystemMessage } from "@/components/ui/system-message";
import { companyFields, type CompanyFieldKey } from "@/lib/company-fields";
import type { LegalDocument, PublicSettings } from "@/lib/api-server";

// Gleiches Muster wie UserNotificationBanners: reine Zustands-Banner ohne
// eigene Event-Historie, je Kategorie über AppSettings.notify* ab-/
// anschaltbar. Spiegeln die bereits bestehenden Inline-Warnhinweise auf der
// Firma- bzw. Datenschutz-Seite (Nutzervorgabe, 2026-08-19: "grundsätzlich
// sind solche Meldungen in Systembenachrichtigung zu setzen").
export function CompanyIncompleteBanner({
  settings,
}: {
  settings: Pick<PublicSettings, CompanyFieldKey> | null;
}) {
  if (!settings) return null;
  const missing = companyFields.filter((f) => !settings[f.key]);
  if (missing.length === 0) return null;

  return (
    <SystemMessage
      variant="warning"
      title={`${missing.length} ${missing.length === 1 ? "Firmenfeld fehlt" : "Firmenfelder fehlen"} noch.`}
      description="Diese Daten speisen Impressum, Datenschutzhinweise und Systemmails."
      actions={
        <Button
          size="sm"
          variant="outline"
          className="border-border"
          render={<Link href="/dashboard/company" />}
        >
          Zur Firma-Seite
        </Button>
      }
    />
  );
}

export function LegalDocumentsBanner({
  documents,
}: {
  documents: LegalDocument[] | null;
}) {
  if (!documents) return null;
  const staleCount = documents.filter((d) => d.status === "stale").length;
  const missingCount = documents.filter((d) => d.status === "missing").length;
  const total = staleCount + missingCount;
  if (total === 0) return null;

  return (
    <SystemMessage
      variant="warning"
      title={`${total} ${total === 1 ? "Rechtstext braucht" : "Rechtstexte brauchen"} Aufmerksamkeit.`}
      description={
        missingCount > 0 && staleCount > 0
          ? `${missingCount} ${missingCount === 1 ? "fehlt" : "fehlen"} noch, ${staleCount} ${staleCount === 1 ? "ist" : "sind"} veraltet.`
          : missingCount > 0
            ? `${missingCount} ${missingCount === 1 ? "fehlt" : "fehlen"} noch.`
            : "Firmendaten haben sich seit der letzten Erzeugung geändert."
      }
      actions={
        <Button
          size="sm"
          variant="outline"
          className="border-border"
          render={<Link href="/dashboard/privacy" />}
        >
          Zu den Rechtstexten
        </Button>
      }
    />
  );
}
