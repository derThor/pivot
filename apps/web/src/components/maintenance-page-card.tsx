"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bff } from "@/lib/bff";

/** Wartungsseiten-Inhalt für DIESE Installation (Nutzervorgabe, 2026-08-24:
 * "alle anderen Einstellungen unter Webseite" – zog Titel/Text aus dem
 * Master/Client-Umschalt-Popup unter Einstellungen hierher um). Bewusst
 * NICHT hinter `MasterOnlyGuard` (der auf dieser Seite nur die Mandanten-
 * Verwaltung schützt) – diese Karte muss auch auf einer Client-
 * Installation erreichbar bleiben, da genau dort die Wartungsseite
 * angezeigt wird, wenn der Master sie sperrt. */
export function MaintenancePageCard({
  title,
  message,
}: {
  title: string | null;
  message: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: title ?? "",
    message: message ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    form.title !== (title ?? "") || form.message !== (message ?? "");

  async function handleSave() {
    setIsSaving(true);
    try {
      // Eigene Route statt /api/settings (Nutzer-Bugreport, 2026-08-25):
      // bleibt auch bei bereits gesperrter Client-Installation erreichbar,
      // siehe LicenseEnforcementGuard.
      const res = await fetch(bff("/api/settings/maintenance-page"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenancePageTitle: form.title || null,
          maintenancePageMessage: form.message || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(
          data?.message ?? "Wartungsseite konnte nicht gespeichert werden.",
        );
        return;
      }
      toastEdited("Wartungsseite gespeichert.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Wartungsseite</CardTitle>
        <p className="text-sm text-muted-foreground">
          Inhalt der Seite, die öffentliche Besucher sehen, sobald diese
          Installation als Client gesperrt ist.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maintenance-title">Titel</Label>
          <Input
            id="maintenance-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Wartungsarbeiten"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maintenance-message">Text</Label>
          <Textarea
            id="maintenance-message"
            rows={3}
            value={form.message}
            onChange={(e) =>
              setForm((f) => ({ ...f, message: e.target.value }))
            }
            placeholder="Diese Seite ist derzeit nicht erreichbar. Bitte versuche es später erneut."
          />
        </div>
        <Button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={handleSave}
          className="self-start"
        >
          {isSaving ? "Speichert…" : "Speichern"}
        </Button>
      </CardContent>
    </Card>
  );
}
