"use client";

import { useEffect, useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SystemMessage } from "@/components/ui/system-message";
import type { SmtpSettings } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const SECURE_LABELS: Record<string, string> = {
  none: "Keine",
  starttls: "STARTTLS",
  ssl: "SSL/TLS",
};

const EMPTY_FORM = {
  host: "",
  port: "587",
  username: "",
  password: "",
  fromAddress: "",
  fromName: "",
  secure: "starttls",
};

function toForm(settings: SmtpSettings) {
  return {
    host: settings.host ?? "",
    port: settings.port != null ? String(settings.port) : "587",
    username: settings.username ?? "",
    password: "",
    fromAddress: settings.fromAddress ?? "",
    fromName: settings.fromName ?? "",
    secure: settings.secure,
  };
}

/** "Einrichten"-Dialog für den Dienst "E-Mail-Versand (SMTP)"
 * (Einstellungen → Integrationen, Nutzervorgabe, 2026-08-22, 1:1 nach
 * Bildvorlage "Dienste"). Speichern testet die Verbindung serverseitig
 * gleich mit (siehe SettingsService.updateSmtpSettings) – kein
 * separater "Verbindung testen"-Button nötig, nur eine zusätzliche
 * "Testmail senden" für den echten End-to-End-Nachweis. */
export function SmtpSettingsDialog({
  settings,
  open,
  onOpenChange,
  onSaved,
}: {
  settings: SmtpSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (settings: SmtpSettings) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [isSendingTestMail, setIsSendingTestMail] = useState(false);
  const [testMailResult, setTestMailResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toForm(settings));
      setError(null);
      setTestError(null);
      setTestMailResult(null);
      setTestEmailTo("");
    }
  }, [open, settings]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.host.trim() || !form.port.trim()) {
      setError("Bitte Host und Port angeben.");
      return;
    }
    setError(null);
    setTestError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        host: form.host,
        port: Number(form.port),
        username: form.username || null,
        password: form.password || undefined,
        fromAddress: form.fromAddress || null,
        fromName: form.fromName || null,
        secure: form.secure,
      };
      const res = await fetch(bff("/api/settings/smtp"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      onSaved(data as SmtpSettings);
      if (data.testError) {
        setTestError(data.testError);
      } else {
        toastEdited("E-Mail-Versand (SMTP) wurde eingerichtet.");
        onOpenChange(false);
      }
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendTestEmail() {
    if (!testEmailTo.trim()) {
      setTestMailResult({
        ok: false,
        error: "Bitte eine Zieladresse angeben.",
      });
      return;
    }
    setIsSendingTestMail(true);
    setTestMailResult(null);
    try {
      const res = await fetch(bff("/api/settings/smtp/test-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(" ")
          : (data?.message ?? data?.error ?? "Unbekannter Fehler.");
        setTestMailResult({ ok: false, error: message });
      } else {
        setTestMailResult(data ?? { ok: false, error: "Unbekannter Fehler." });
      }
    } catch {
      setTestMailResult({ ok: false, error: "Server nicht erreichbar." });
    } finally {
      setIsSendingTestMail(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>E-Mail-Versand (SMTP) einrichten</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1">
              <Label htmlFor="smtp-host" required>
                Host
              </Label>
              <Input
                id="smtp-host"
                autoFocus
                placeholder="z.B. mail.example.de"
                value={form.host}
                onChange={(e) =>
                  setForm((p) => ({ ...p, host: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="smtp-port" required>
                Port
              </Label>
              <Input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                className="w-24"
                value={form.port}
                onChange={(e) =>
                  setForm((p) => ({ ...p, port: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="smtp-username">Benutzername</Label>
              <Input
                id="smtp-username"
                value={form.username}
                onChange={(e) =>
                  setForm((p) => ({ ...p, username: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="smtp-password">Passwort</Label>
              <Input
                id="smtp-password"
                type="password"
                placeholder={
                  settings.hasPassword ? "•••••• (unverändert lassen)" : ""
                }
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="smtp-from-address">Absenderadresse</Label>
              <Input
                id="smtp-from-address"
                type="email"
                placeholder="z.B. noreply@example.de"
                value={form.fromAddress}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fromAddress: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="smtp-from-name">Absendername</Label>
              <Input
                id="smtp-from-name"
                placeholder="z.B. Pivot CMS"
                value={form.fromName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fromName: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="smtp-secure">Verschlüsselung</Label>
            <Select
              value={form.secure}
              onValueChange={(value) =>
                setForm((p) => ({ ...p, secure: value ?? p.secure }))
              }
              items={SECURE_LABELS}
            >
              <SelectTrigger id="smtp-secure" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SECURE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {testError && (
            <SystemMessage
              variant="error"
              title="Verbindung fehlgeschlagen"
              description={testError}
            />
          )}

          {settings.configured && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
              <Label htmlFor="smtp-test-email">Testmail senden an</Label>
              <div className="flex gap-2">
                <Input
                  id="smtp-test-email"
                  type="email"
                  placeholder="z.B. deine.adresse@web.de"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-button-border"
                  disabled={isSendingTestMail}
                  onClick={handleSendTestEmail}
                >
                  {isSendingTestMail ? "Sendet…" : "Senden"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Eine echte, eigene Adresse eingeben – nicht die Konto-Adresse
                dieses Pivot-Nutzers.
              </p>
              {testMailResult && (
                <SystemMessage
                  variant={testMailResult.ok ? "success" : "error"}
                  title={
                    testMailResult.ok
                      ? "Testmail wurde versendet"
                      : "Testmail fehlgeschlagen"
                  }
                  description={testMailResult.error}
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-button-border"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichert…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
