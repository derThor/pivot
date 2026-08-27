"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastCreated } from "@/components/app-toast";
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

/** "+ Mandant anlegen" (Nutzervorgabe, 2026-08-27: "bei den Mandanten
 * gehört immer eine Webseite oder mehrere dazu") – ein Mandant entsteht
 * immer zusammen mit seiner ersten Website, nie leer. Weitere Websites
 * kommen später über "Domain hinzufügen" auf der Mandant-Detailseite
 * dazu (siehe mandant-detail-view.tsx). */
export function MandantDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setName("");
    setDomain("");
    setNameError(null);
    setDomainError(null);
    setSubmitError(null);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
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
      const res = await fetch("/api/mandanten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSubmitError(data?.message ?? "Konnte nicht angelegt werden.");
        return;
      }
      toastCreated(`„${name}“ wurde angelegt.`);
      handleOpenChange(false);
      router.refresh();
    } catch {
      setSubmitError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mandant anlegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mandant-name" required>
              Bezeichnung
            </Label>
            <Input
              id="mandant-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              placeholder="z.B. StraSev Steuerberatung"
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mandant-domain" required>
              Hauptdomain
            </Label>
            <Input
              id="mandant-domain"
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
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => handleOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Wird angelegt…" : "Mandant anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
