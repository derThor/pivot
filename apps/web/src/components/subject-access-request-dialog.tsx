"use client";

import { useState } from "react";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatName } from "@/lib/utils";
import type { CurrentUser } from "@/lib/api-server";

/** "Auskunft erstellen" (Art. 15 DSGVO, Betroffenenrechte-Kachel,
 * Nutzervorgabe 2026-08-19): Person auswählen, Bericht mit allen im
 * System zu ihr gespeicherten Daten (Konto/Aktivität/Inhalte/Medien) als
 * CSV herunterladen. Der Download läuft über die Response-Header der
 * BFF-Route (`Content-Disposition: attachment`), kein extra JS nötig –
 * ein simpler Link-Klick reicht. */
export function SubjectAccessRequestDialog({
  open,
  onOpenChange,
  users,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: CurrentUser[];
}) {
  const [userId, setUserId] = useState("");
  const [isSending, setIsSending] = useState(false);
  // Anonymisierte (gelöschte) Konten haben keine personenbezogenen Daten
  // mehr, zu denen sich eine Auskunft erstellen ließe – aus der Auswahl
  // entfernen (Nutzervorgabe, 2026-08-19).
  const sortedUsers = users
    .filter((u) => !u.anonymizedAt)
    .sort((a, b) => formatName(a).localeCompare(formatName(b), "de"));
  const selectedUser = sortedUsers.find((u) => u.id === userId);

  // Versendet an die im Konto hinterlegte Adresse – kein eigenes
  // Empfänger-Feld (Nutzervorgabe, 2026-08-19). Echter Mail-Versand folgt
  // in einem späteren Schritt, aktuell Dev-Stub wie alle System-Mails
  // (siehe MailerService).
  async function handleSend() {
    if (!userId) return;
    setIsSending(true);
    try {
      await fetch(`/api/privacy/subject-access-report/${userId}/send`, {
        method: "POST",
      });
      toastEdited(
        selectedUser
          ? `Auskunft wurde an ${selectedUser.email} versendet.`
          : "Auskunft wurde versendet.",
      );
      onOpenChange(false);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Auskunft erstellen</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Erstellt einen Bericht mit allen im System zu dieser Person
            gespeicherten Daten (Konto, Aktivität, verfasste Inhalte,
            hochgeladene Medien) nach Art. 15 DSGVO.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sar-user" required>Person</Label>
            <Select
              value={userId}
              onValueChange={(value) => setUserId(value ?? "")}
              items={Object.fromEntries(
                sortedUsers.map((u) => [u.id, `${formatName(u)} (${u.email})`]),
              )}
            >
              <SelectTrigger id="sar-user" className="w-full">
                <SelectValue placeholder="Person wählen" />
              </SelectTrigger>
              <SelectContent>
                {sortedUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {formatName(u)} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* 3 Buttons passten nicht in die Standardbreite (`sm:max-w-md`)
         * der DialogFooter-Zeile – "Abbrechen" wurde dabei abgeschnitten
         * statt umzubrechen (Nutzer-Bugreport per Screenshot, 2026-08-19).
         * Fix: Dialog oben auf `sm:max-w-xl` verbreitert (Haupt-Fix für den
         * Normalfall) + hier zusätzlich `flex-wrap` als Sicherheitsnetz,
         * falls die Zeile bei Zoom/langen Übersetzungen doch mal eng wird –
         * dann bricht sie um, statt zu clippen. */}
        <DialogFooter className="flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="border-[#D4D4D4]"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[#D4D4D4]"
            disabled={!userId || isSending}
            onClick={handleSend}
          >
            {isSending ? "Sendet…" : "Auskunft senden"}
          </Button>
          <Button
            type="button"
            disabled={!userId}
            render={
              <a
                href={userId ? `/api/privacy/subject-access-report/${userId}` : undefined}
                onClick={() => onOpenChange(false)}
              />
            }
          >
            Auskunft herunterladen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
