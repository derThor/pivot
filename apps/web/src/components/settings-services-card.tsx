"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmtpSettingsDialog } from "@/components/smtp-settings-dialog";
import type { SmtpSettings } from "@/lib/api-server";

/** Einstellungen → Integrationen, Karte "Dienste" (Nutzervorgabe,
 * 2026-08-22: "email versand bauen ... als dienst", 1:1 nach Bildvorlage).
 * Nur "E-Mail-Versand (SMTP)" ist ein echtes Feature dieser App –
 * "Reichweiten-Messung", "Suche" und "Backup-Ziel" aus der Bildvorlage
 * bewusst nicht ergänzt (kein Matomo/Such-Index/Backup-Ziel im Repo, kein
 * erfundener Inhalt). `current` wird nach dem Speichern im Dialog direkt
 * ersetzt, damit Status-Badge/Button ohne Neuladen der Seite aktuell
 * bleiben (gleiches Muster wie beim AV-Vertrag-Button). */
export function SettingsServicesCard({ smtp }: { smtp: SmtpSettings }) {
  const [current, setCurrent] = useState(smtp);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isActive = current.configured && !!current.verifiedAt;
  const subtitle = current.configured
    ? `${current.host} · ${current.verifiedAt ? "verbunden" : "nicht verbunden"}`
    : "Nicht eingerichtet";

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Dienste</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">E-Mail-Versand (SMTP)</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              className={
                isActive ? "badge--green border-0" : "badge--amber border-0"
              }
            >
              {isActive ? "aktiv" : "offen"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-button-border"
              onClick={() => setDialogOpen(true)}
            >
              Einrichten
            </Button>
          </div>
        </div>
      </CardContent>
      <SmtpSettingsDialog
        settings={current}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={setCurrent}
      />
    </Card>
  );
}
