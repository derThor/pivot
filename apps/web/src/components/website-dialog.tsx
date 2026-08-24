"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, RotateCcw } from "lucide-react";

import { toastCreated, toastEdited } from "@/components/app-toast";
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

const STATUS_OPTIONS: { value: WebsiteStatus; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "development", label: "Entwicklung" },
  { value: "locked", label: "Gesperrt" },
];

// Validierungsfehler direkt unter dem betroffenen Feld statt als
// Sammel-Meldung unten im Formular (App-Konvention, siehe gallery-dialog.tsx)
// – `nameError`/`domainError` getrennt von `submitError` (Server-/
// Netzwerkfehler, die zu keinem einzelnen Feld gehören).
export function WebsiteDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: WebsiteListItem | null | "new";
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const open = target !== null;
  const isEdit = target !== null && target !== "new";
  const [name, setName] = useState(isEdit ? target.name : "");
  const [domain, setDomain] = useState(isEdit ? target.domain : "");
  const [status, setStatus] = useState<WebsiteStatus>(
    isEdit ? target.status : "development",
  );
  const [testUrl, setTestUrl] = useState(isEdit ? (target.testUrl ?? "") : "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Nach dem Anlegen: API-Key + öffentlicher Schlüssel werden nur dieses
  // eine Mal angezeigt (siehe WebsitesService.create() – der Klartext-Key
  // wird danach nie wieder ausgeliefert, nur noch sein Hash gespeichert).
  const [credentials, setCredentials] = useState<{
    apiKey: string;
    publicKey: string;
  } | null>(null);
  const [copied, setCopied] = useState<"apiKey" | "publicKey" | null>(null);
  // Bearbeiten-Modus, nach "Neu erzeugen": der brandneue Klartext-Key
  // (der bestehende, bereits gespeicherte Key läuft über `existingApiKey`
  // unten – beide sind jetzt gleichwertig abrufbar, siehe WebsitesService).
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  // Frisch erzeugte Klartext-Keys (Anlegen oder "Neu erzeugen") sind
  // standardmäßig maskiert, per Augen-Icon einblendbar.
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
  // Felder auf ihren Werten vom allerersten Mount stehen (Bugreport: "Wenn
  // ich auf bearbeiten gehe, sind die Inputs nicht mehr befüllt").
  const targetKey =
    target === null ? null : target === "new" ? "new" : target.id;
  const [syncedTargetKey, setSyncedTargetKey] = useState(targetKey);
  if (targetKey !== syncedTargetKey) {
    setSyncedTargetKey(targetKey);
    setName(isEdit ? target.name : "");
    setDomain(isEdit ? target.domain : "");
    setStatus(isEdit ? target.status : "development");
    setTestUrl(isEdit ? (target.testUrl ?? "") : "");
    setNameError(null);
    setDomainError(null);
    setSubmitError(null);
    setCredentials(null);
    setNewApiKey(null);
    setRevealApiKey(false);
    setExistingApiKey(null);
    setExistingRevealed(false);
  }

  function reset() {
    setName(isEdit ? target.name : "");
    setDomain(isEdit ? target.domain : "");
    setStatus(isEdit ? target.status : "development");
    setTestUrl(isEdit ? (target.testUrl ?? "") : "");
    setNameError(null);
    setDomainError(null);
    setSubmitError(null);
    setCredentials(null);
    setNewApiKey(null);
    setRevealApiKey(false);
    setExistingApiKey(null);
    setExistingRevealed(false);
  }

  async function handleRegenerate() {
    if (!isEdit) return;
    setIsRegenerating(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/websites/${target.id}/regenerate-key`, {
        method: "POST",
      });
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
    if (!isEdit) return;
    if (existingApiKey) {
      setExistingRevealed((v) => !v);
      return;
    }
    setIsLoadingExistingKey(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/websites/${target.id}/api-key`);
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

  async function handleCopy(field: "apiKey" | "publicKey", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied((c) => (c === field ? null : c)), 2000);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
      const res = await fetch(
        isEdit ? `/api/websites/${target.id}` : "/api/websites",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? { name, domain, status, testUrl: testUrl.trim() || null }
              : { name, domain },
          ),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      if (isEdit) {
        toastEdited(`„${name}“ wurde aktualisiert.`);
        handleOpenChange(false);
        onSaved();
        router.refresh();
        return;
      }
      toastCreated(`„${name}“ wurde angelegt.`);
      const keyRes = await fetch("/api/websites/public-key");
      const keyData = await keyRes.json().catch(() => null);
      setCredentials({
        apiKey: data.apiKey as string,
        publicKey: keyData?.publicKey ?? "",
      });
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
          <DialogTitle>
            {credentials
              ? "Zugangsdaten für die Slave-Installation"
              : isEdit
                ? "Website bearbeiten"
                : "Website verbinden"}
          </DialogTitle>
        </DialogHeader>

        {credentials ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Diese Werte werden nur jetzt einmal angezeigt. Hinterlege sie
              außerhalb dieser App in der Umgebungskonfiguration der
              Slave-Installation.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label>API-Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  type={revealApiKey ? "text" : "password"}
                  value={credentials.apiKey}
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
                  onClick={() => handleCopy("apiKey", credentials.apiKey)}
                >
                  {copied === "apiKey" ? <Check /> : <Copy />}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Öffentlicher Schlüssel des Masters</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={credentials.publicKey}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Öffentlichen Schlüssel kopieren"
                  onClick={() => handleCopy("publicKey", credentials.publicKey)}
                >
                  {copied === "publicKey" ? <Check /> : <Copy />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Fertig
              </Button>
            </DialogFooter>
          </div>
        ) : (
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
            {isEdit && (
              <SegmentedPicker
                label="Status"
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
              />
            )}
            {isEdit && (
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
            )}
            {isEdit && (
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
                        existingRevealed
                          ? "API-Key verbergen"
                          : "API-Key anzeigen"
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
                    className="border-[#D4D4D4]"
                    disabled={isLoadingExistingKey}
                    onClick={handleRevealExisting}
                  >
                    <Eye />
                    {isLoadingExistingKey
                      ? "Wird geladen…"
                      : "API-Key anzeigen"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#D4D4D4]"
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
            )}
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-[#D4D4D4]"
                onClick={() => handleOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Speichert…"
                  : isEdit
                    ? "Speichern"
                    : "Verbinden"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
