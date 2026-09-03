"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, RotateCcw } from "lucide-react";

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
import { SegmentedPicker } from "@/components/segmented-picker";
import type { WebsiteListItem, WebsiteStatus } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const STATUS_OPTIONS: { value: WebsiteStatus; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "development", label: "Entwicklung" },
  { value: "locked", label: "Gesperrt" },
];

// Mandantenfähigkeit, 2026-08-27: "Projekt anlegen" gibt es nicht mehr –
// eine neue Website entsteht nur noch über ihren Mandanten (siehe
// mandant-dialog.tsx/mandant-detail-view.tsx). Dieser Dialog ist deshalb
// bewusst reiner Bearbeiten-Dialog, kein Anlegen-Modus mehr.
export function WebsiteDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: WebsiteListItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const open = target !== null;
  const [name, setName] = useState(target?.name ?? "");
  const [domain, setDomain] = useState(target?.domain ?? "");
  const [status, setStatus] = useState<WebsiteStatus>(
    target?.status ?? "development",
  );
  const [testUrl, setTestUrl] = useState(target?.testUrl ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState<"apiKey" | null>(null);
  // Nach "Neu erzeugen": der brandneue Klartext-Key (der bestehende,
  // bereits gespeicherte Key läuft über `existingApiKey` unten – beide
  // sind gleichwertig abrufbar, siehe WebsitesService).
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [revealApiKey, setRevealApiKey] = useState(false);
  // Bestehender, bereits gespeicherter Key (Nutzervorgabe, 2026-08-24:
  // "ich will mir den Key immer mit Icon anzeigen lassen") – wird erst bei
  // Klick auf das Augen-Icon vom Server entschlüsselt und abgerufen, nicht
  // schon beim Öffnen des Dialogs.
  const [existingApiKey, setExistingApiKey] = useState<string | null>(null);
  const [existingRevealed, setExistingRevealed] = useState(false);
  const [isLoadingExistingKey, setIsLoadingExistingKey] = useState(false);

  // Render-Zeit-Sync statt Effekt (gleiches Muster wie `syncedRoleId` in
  // roles-explorer.tsx): der Dialog bleibt dauerhaft gemountet, nur `target`
  // wechselt bei jedem Klick auf "Bearbeiten" – ohne diesen Sync blieben die
  // Felder auf ihren Werten vom allerersten Mount stehen.
  const [syncedTargetId, setSyncedTargetId] = useState(target?.id ?? null);
  if ((target?.id ?? null) !== syncedTargetId) {
    setSyncedTargetId(target?.id ?? null);
    setName(target?.name ?? "");
    setDomain(target?.domain ?? "");
    setStatus(target?.status ?? "development");
    setTestUrl(target?.testUrl ?? "");
    setNameError(null);
    setDomainError(null);
    setSubmitError(null);
    setNewApiKey(null);
    setRevealApiKey(false);
    setExistingApiKey(null);
    setExistingRevealed(false);
  }

  function reset() {
    setName(target?.name ?? "");
    setDomain(target?.domain ?? "");
    setStatus(target?.status ?? "development");
    setTestUrl(target?.testUrl ?? "");
    setNameError(null);
    setDomainError(null);
    setSubmitError(null);
    setNewApiKey(null);
    setRevealApiKey(false);
    setExistingApiKey(null);
    setExistingRevealed(false);
  }

  async function handleRegenerate() {
    if (!target) return;
    setIsRegenerating(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        bff(`/api/websites/${target.id}/regenerate-key`),
        {
          method: "POST",
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.message ?? "API-Key konnte nicht erzeugt werden.");
        return;
      }
      setNewApiKey(data.apiKey as string);
      setRevealApiKey(false);
      toastEdited("Neuer API-Key erzeugt.");
    } catch {
      setSubmitError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleRevealExisting() {
    if (!target) return;
    if (existingApiKey) {
      setExistingRevealed((v) => !v);
      return;
    }
    setIsLoadingExistingKey(true);
    setSubmitError(null);
    try {
      const res = await fetch(bff(`/api/websites/${target.id}/api-key`));
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.message ?? "API-Key konnte nicht geladen werden.");
        return;
      }
      setExistingApiKey(data.apiKey as string);
      setExistingRevealed(true);
    } catch {
      setSubmitError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsLoadingExistingKey(false);
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleCopy(field: "apiKey", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied((c) => (c === field ? null : c)), 2000);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    let hasError = false;
    if (!name.trim()) {
      setNameError("Bitte einen Namen angeben.");
      hasError = true;
    }
    if (!domain.trim()) {
      setDomainError("Bitte eine Domain angeben.");
      hasError = true;
    }
    if (hasError) return;
    setNameError(null);
    setDomainError(null);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(bff(`/api/websites/${target.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domain,
          status,
          testUrl: testUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      toastEdited(`„${name}“ wurde aktualisiert.`);
      handleOpenChange(false);
      onSaved();
      router.refresh();
    } catch {
      setSubmitError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Webseite bearbeiten</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website-name" required>
              Name
            </Label>
            <Input
              id="website-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              placeholder="z.B. strasev.de"
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website-domain" required>
              Domain
            </Label>
            <Input
              id="website-domain"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                if (domainError) setDomainError(null);
              }}
              aria-invalid={domainError ? true : undefined}
              placeholder="z.B. strasev.de"
            />
            {domainError && (
              <p className="text-sm text-destructive">{domainError}</p>
            )}
          </div>
          <SegmentedPicker
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website-test-url">Test-URL</Label>
            <Input
              id="website-test-url"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder={`https://${domain || "..."}/`}
            />
            <p className="text-xs text-muted-foreground">
              Nur für lokale Test-Installationen: überschreibt die
              Live-Überwachung, falls die Domain nicht wirklich auf diese
              Installation zeigt (z.B. „http://localhost:3010“). Bei echten
              Kunden leer lassen.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>API-Key</Label>
            {newApiKey ? (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  type={revealApiKey ? "text" : "password"}
                  value={newApiKey}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={
                    revealApiKey ? "API-Key verbergen" : "API-Key anzeigen"
                  }
                  onClick={() => setRevealApiKey((v) => !v)}
                >
                  {revealApiKey ? <EyeOff /> : <Eye />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="API-Key kopieren"
                  onClick={() => handleCopy("apiKey", newApiKey)}
                >
                  {copied === "apiKey" ? <Check /> : <Copy />}
                </Button>
              </div>
            ) : existingApiKey ? (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  type={existingRevealed ? "text" : "password"}
                  value={existingApiKey}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={
                    existingRevealed ? "API-Key verbergen" : "API-Key anzeigen"
                  }
                  onClick={handleRevealExisting}
                >
                  {existingRevealed ? <EyeOff /> : <Eye />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="API-Key kopieren"
                  onClick={() => handleCopy("apiKey", existingApiKey)}
                >
                  {copied === "apiKey" ? <Check /> : <Copy />}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="border-button-border"
                disabled={isLoadingExistingKey}
                onClick={handleRevealExisting}
              >
                <Eye />
                {isLoadingExistingKey ? "Wird geladen…" : "API-Key anzeigen"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="border-button-border"
              disabled={isRegenerating}
              onClick={handleRegenerate}
            >
              <RotateCcw />
              {isRegenerating ? "Wird erzeugt…" : "API-Key neu erzeugen"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {newApiKey
                ? "Dieser Wert wird nur jetzt einmal angezeigt. Hinterlege ihn außerhalb dieser App in der Umgebungskonfiguration der Slave-Installation."
                : "Beim Neu-Erzeugen wird der bisherige Key sofort ungültig."}
            </p>
          </div>
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-button-border"
              onClick={() => handleOpenChange(false)}
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
