import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SystemMessage } from "@/components/ui/system-message";
import type { DeletionRequest } from "@/lib/api-server";

// Gleiches Muster wie CompanyIncompleteBanner/LegalDocumentsBanner
// (Nutzervorgabe, 2026-08-19: "Löschanfragen unter Systembenachrichtigungen
// aufführen") – "offen" zählt wie auf der Datenschutz-Seite selbst
// (open + in_progress, alles außer erledigt/abgelehnt).
export function DeletionRequestsBanner({
  requests,
}: {
  requests: DeletionRequest[] | null;
}) {
  if (!requests) return null;
  const openCount = requests.filter(
    (r) => r.status === "open" || r.status === "in_progress",
  ).length;
  if (openCount === 0) return null;

  return (
    <SystemMessage
      variant="warning"
      title={`${openCount} ${openCount === 1 ? "Betroffenenanfrage ist" : "Betroffenenanfragen sind"} offen.`}
      actions={
        <Button
          size="sm"
          variant="outline"
          className="border-border"
          render={<Link href="/dashboard/privacy?tab=loeschanfragen" />}
        >
          Anfragen ansehen
        </Button>
      }
    />
  );
}
