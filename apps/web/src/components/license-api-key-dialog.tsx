"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bff } from "@/lib/bff";

/** Schlüssel-Icon bei "Diese Installation" in `master-client-card.tsx`
 * (Nutzervorgabe, 2026-08-24: "eine Eingabe, wo man den Schlüssel ändern
 * kann") – löst das bisherige rein manuelle Nachtragen ab (`.env`
 * bearbeiten + Neustart), wenn der Master-Admin den Key regeneriert hat.
 * Schreibt-only wie das SMTP-Passwort: der bestehende Key wird nie
 * angezeigt, nur ob überhaupt einer hinterlegt ist – nur der neu
 * eingegebene Wert lässt sich vor dem Speichern einblenden. */
export function LicenseApiKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Render-Zeit-Sync statt Effekt (gleiches Muster wie website-dialog.tsx):
  // bei jedem Öffnen den aktuellen "hat Key?"-Status neu laden, Eingabefeld
  // zurücksetzen.
  const [syncedOpen, setSyncedOpen] = useState(open);
  if (open !== syncedOpen) {
    setSyncedOpen(open);
    if (open) {
      setApiKey("");
      setReveal(false);
      setHasApiKey(null);
      setIsLoading(true);
      fetch(bff("/api/settings/license-client"))
        .then((res) => res.json())
        .then((data) => setHasApiKey(Boolean(data?.hasApiKey)))
        .finally(() => setIsLoading(false));
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(bff("/api/settings/license-client"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) return;
      toastEdited("API-Key gespeichert.");
      onOpenChange(false);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>API-Key</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Der Schlüssel, mit dem sich diese Installation beim Master ausweist.{" "}
            {!isLoading &&
              (hasApiKey
                ? "Aktuell ist ein Key hinterlegt."
                : "Aktuell ist noch kein Key hinterlegt.")}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="license-api-key">Neuer API-Key</Label>
            <div className="flex items-center gap-2">
              <Input
                id="license-api-key"
                type={reveal ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-xs"
                placeholder="Vom Master kopierten Key einfügen"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={reveal ? "Verbergen" : "Anzeigen"}
                onClick={() => setReveal((v) => !v)}
              >
                {reveal ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Leer lassen, um den bestehenden Key zu behalten.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-border"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={!apiKey || isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Speichert…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
