"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { bff } from "@/lib/bff";

type Step = "credentials" | "key" | "done";

/** Wiederherstellungs-Popup auf der Wartungsseite (Nutzervorgabe,
 * 2026-08-26): läuft komplett unabhängig vom normalen Login – kein Zugriffs-
 * /Refresh-Token, keine Dashboard-Session, keine Weiterleitung. Zweck: einen
 * versehentlich falsch eingetragenen Lizenz-Key korrigieren können, obwohl
 * der `LicenseEnforcementGuard` im gesperrten Zustand sonst auch den Login
 * selbst blockt (siehe
 * apps/api/src/license-client/license-enforcement.guard.ts). Zwei echte
 * Backend-Schritte: `recovery/verify` prüft Passwort + `settings:update`-
 * Recht und liefert ein 5-Minuten-Token, `recovery/apply-key` nimmt Token +
 * neuen Key entgegen, speichert ihn und löst sofort einen Re-Check aus.
 *
 * Nutzervorgabe, 2026-08-26: "KEIN SCHLÜSSELSYMBOL. SONDERN ÜBER KLICK AUF
 * DAS LOGO" – kein eigenes, sichtbares Icon, das die Existenz dieser
 * Funktion verrät. Stattdessen macht diese Komponente ihr `children` (Logo
 * oder Firmenname aus locked/page.tsx) selbst zum unsichtbaren Klick-
 * Auslöser. Schritt 1 zeigt bewusst NICHTS von "Lizenz"/"Key" – wer keinen
 * Zugriff hat, soll aus dem Popup nicht mal erkennen können, wofür es ist. */
export function LicenseRecoveryDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  function reset() {
    setStep("credentials");
    setEmail("");
    setPassword("");
    setApiKey("");
    setRecoveryToken(null);
    setError(null);
    setResultMessage(null);
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(bff("/api/license/recovery/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      setRecoveryToken(data.recoveryToken);
      setStep("key");
    } finally {
      setPending(false);
    }
  }

  async function handleApplyKey(event: FormEvent) {
    event.preventDefault();
    if (!recoveryToken) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(bff("/api/license/recovery/apply-key"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryToken, apiKey }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.status !== "success") {
        setError(data?.message ?? "Speichern fehlgeschlagen.");
        return;
      }
      setResultMessage(
        data.licenseStatus === "locked"
          ? `Key gespeichert und akzeptiert. Der Master hat diese Installation aber weiterhin gesperrt (${data.message}). Sobald der Master entsperrt, funktioniert alles automatisch wieder.`
          : (data.message ?? "Key gespeichert, Installation ist entsperrt."),
      );
      setStep("done");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="contents">
        {children}
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {step === "credentials" && (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Anmelden</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="recovery-email">E-Mail</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="recovery-password">Passwort</Label>
                <PasswordInput
                  id="recovery-password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Prüft…" : "Bestätigen"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === "key" && (
            <form onSubmit={handleApplyKey} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Lizenz-Key eintragen</DialogTitle>
                <DialogDescription>
                  Der hier eingetragene Key muss exakt mit dem beim Master
                  hinterlegten Key übereinstimmen.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="recovery-api-key">API-Key</Label>
                <Input
                  id="recovery-api-key"
                  autoComplete="off"
                  required
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Speichert…" : "Speichern & prüfen"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === "done" && (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Gespeichert</DialogTitle>
                <DialogDescription>{resultMessage}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={() => window.location.reload()}>
                  Seite neu laden
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
