"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastEdited } from "@/components/app-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

/** Administration → Module → [key] (Korrektur 2026-08-29: ursprünglich
 * fälschlich unter Einstellungen → Module gebaut, siehe Kommentar dort –
 * steuert das Verhalten des Moduls gegenüber neuen Mandanten, nicht
 * Masters eigene Nutzung, gehört deshalb hierher statt zu Masters
 * eigener Freischaltung). Einziges interaktive Element auf einer sonst
 * rein lesenden Seite. */
export function ModuleAutoInstallToggle({
  moduleKey,
  autoInstallForNewMandants,
}: {
  moduleKey: string;
  autoInstallForNewMandants: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function patch(checked: boolean) {
    setPending(true);
    try {
      const res = await fetch(`/api/module-settings/${moduleKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoInstallForNewMandants: checked }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toastEdited(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            Bei neuen Mandanten vorinstallieren
          </p>
          <p className="text-xs text-muted-foreground">
            Wird beim Anlegen eines neuen Mandanten automatisch gebucht.
          </p>
        </div>
        <Switch
          checked={autoInstallForNewMandants}
          disabled={pending}
          onCheckedChange={patch}
        />
      </CardContent>
    </Card>
  );
}
