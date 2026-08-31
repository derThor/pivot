"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { bff } from "@/lib/bff";

type SetupStep = "qr" | "recovery-codes";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function TwoFactorSetupCard({
  enabled,
  enabledAt,
  allowTwoFactor,
}: {
  enabled: boolean;
  enabledAt: string | null;
  allowTwoFactor: boolean;
}) {
  const router = useRouter();

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>("qr");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [isDisabling, setIsDisabling] = useState(false);

  const [codesOpen, setCodesOpen] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  if (!allowTwoFactor) {
    return null;
  }

  async function regenerateCodes() {
    setRegenerateError(null);
    setIsRegenerating(true);
    try {
      const res = await fetch(bff("/api/auth/2fa/regenerate-recovery-codes"), {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRegenerateError(
          data?.message ?? "Codes konnten nicht erzeugt werden.",
        );
        return;
      }
      setNewRecoveryCodes(data.recoveryCodes);
      setCodesOpen(true);
    } finally {
      setIsRegenerating(false);
    }
  }

  async function startSetup() {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(bff("/api/auth/2fa/setup"), { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Einrichtung konnte nicht gestartet werden.");
        return;
      }
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setSetupStep("qr");
      setCode("");
      setSetupOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmSetup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(bff("/api/auth/2fa/verify-setup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Code ist ungültig oder abgelaufen.");
        return;
      }
      setRecoveryCodes(data.recoveryCodes);
      setSetupStep("recovery-codes");
    } finally {
      setIsSubmitting(false);
    }
  }

  function finishSetup() {
    setSetupOpen(false);
    toastEdited("Zwei-Faktor-Authentifizierung wurde aktiviert.");
    router.refresh();
  }

  async function confirmDisable(event: React.FormEvent) {
    event.preventDefault();
    setDisableError(null);
    setIsDisabling(true);
    try {
      const res = await fetch(bff("/api/auth/2fa/disable"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDisableError(data?.message ?? "Passwort ist falsch.");
        return;
      }
      setDisableOpen(false);
      setDisablePassword("");
      toastEdited("Zwei-Faktor-Authentifizierung wurde deaktiviert.");
      router.refresh();
    } finally {
      setIsDisabling(false);
    }
  }

  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Zwei-Faktor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {enabled ? (
            <div className="flex items-center justify-between gap-4 rounded-lg bg-[rgba(188,230,77,0.14)] p-4 shadow-[inset_0_0_0_1px_rgba(120,150,60,0.35)]">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 shrink-0 text-accent-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Authenticator-App eingerichtet
                  {enabledAt && ` am ${formatDate(enabledAt)}`}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-[rgba(120,150,60,0.35)] bg-[rgba(188,230,77,0.14)] text-foreground hover:bg-[rgba(188,230,77,0.24)]"
                onClick={startSetup}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Wird vorbereitet…" : "Neu einrichten"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
              <div className="flex items-center gap-3">
                <ShieldOff className="size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Nicht aktiviert</p>
                  <p className="text-sm text-muted-foreground">
                    Noch kein zweiter Faktor eingerichtet.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={startSetup}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Wird vorbereitet…" : "Aktivieren"}
              </Button>
            </div>
          )}

          {enabled && (
            <>
              <button
                type="button"
                className="self-start rounded-[8px] bg-secondary px-3 py-2 text-[12.5px] font-medium text-pivot-g-body shadow-[inset_0_0_0_1px_var(--pivot-line)] transition-colors duration-150 hover:bg-pivot-sub3 disabled:pointer-events-none disabled:opacity-50"
                onClick={regenerateCodes}
                disabled={isRegenerating}
              >
                {isRegenerating ? "Erzeugt…" : "Neue Codes generieren"}
              </button>
              {regenerateError && (
                <p className="text-sm text-destructive">{regenerateError}</p>
              )}
              <button
                type="button"
                className="self-start rounded-xl border border-border bg-transparent px-3 py-2 text-[12.5px] font-medium text-destructive transition-colors duration-150 hover:bg-destructive/5"
                onClick={() => setDisableOpen(true)}
              >
                Zwei-Faktor-Authentifizierung deaktivieren
              </button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md">
          {setupStep === "qr" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Zwei-Faktor-Authentifizierung einrichten
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={confirmSetup} className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Scanne den QR-Code mit deiner Authenticator-App und gib den
                  angezeigten 6-stelligen Code ein, um die Einrichtung zu
                  bestätigen.
                </p>
                {qrCodeDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrCodeDataUrl}
                    alt="QR-Code für die Authenticator-App"
                    className="mx-auto size-48 rounded-lg border border-border"
                  />
                )}
                <div className="flex flex-col gap-1">
                  <Label>Secret (manuelle Eingabe)</Label>
                  <p className="break-all rounded-md bg-muted p-2 font-mono text-xs">
                    {secret}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="setup-code" required>
                    Bestätigungscode
                  </Label>
                  <Input
                    id="setup-code"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    className="text-center text-lg tracking-[0.3em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border"
                    onClick={() => setSetupOpen(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || code.length !== 6}
                  >
                    {isSubmitting ? "Prüft…" : "Bestätigen"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Recovery-Codes speichern</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Bewahre diese Codes sicher auf. Jeder Code funktioniert
                  einmalig als Ersatz für den 6-stelligen Code, falls du keinen
                  Zugriff mehr auf deine Authenticator-App hast. Sie werden dir
                  nur dieses eine Mal angezeigt.
                </p>
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-4 font-mono text-sm">
                  {recoveryCodes.map((rc) => (
                    <span key={rc}>{rc}</span>
                  ))}
                </div>
                <DialogFooter>
                  <Button type="button" onClick={finishSetup}>
                    Ich habe die Codes gespeichert
                  </Button>
                </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={disableOpen}
        onOpenChange={(next) => {
          setDisableOpen(next);
          if (!next) {
            setDisablePassword("");
            setDisableError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Zwei-Faktor-Authentifizierung deaktivieren
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={confirmDisable} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="disable-password" required>
                Passwort bestätigen
              </Label>
              <PasswordInput
                id="disable-password"
                autoFocus
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
            {disableError && (
              <p className="text-sm text-destructive">{disableError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-border"
                onClick={() => setDisableOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isDisabling || disablePassword.length === 0}
              >
                {isDisabling ? "Deaktiviert…" : "Deaktivieren"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={codesOpen} onOpenChange={setCodesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Recovery-Codes</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Bewahre diese Codes sicher auf. Deine bisherigen Codes wurden
              damit ungültig. Sie werden dir nur dieses eine Mal angezeigt.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-4 font-mono text-sm">
              {newRecoveryCodes.map((rc) => (
                <span key={rc}>{rc}</span>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setCodesOpen(false)}>
                Ich habe die Codes gespeichert
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
