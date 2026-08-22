"use client";

import { useEffect, useState } from "react";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyLocation } from "@/lib/api-server";

const EMPTY_FORM = {
  name: "",
  isPrimary: false,
  street: "",
  postalCode: "",
  city: "",
  phone: "",
  email: "",
  employeeCount: "",
};

function toForm(location: CompanyLocation) {
  return {
    name: location.name,
    isPrimary: location.isPrimary,
    street: location.street ?? "",
    postalCode: location.postalCode ?? "",
    city: location.city ?? "",
    phone: location.phone ?? "",
    email: location.email ?? "",
    employeeCount:
      location.employeeCount != null ? String(location.employeeCount) : "",
  };
}

export function CompanyLocationDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: CompanyLocation | null | "new";
  onOpenChange: (open: boolean) => void;
  onSaved: (location: CompanyLocation) => void;
}) {
  const open = target !== null;
  const isEdit = target !== null && target !== "new";
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (target && target !== "new") {
      setForm(toForm(target));
    } else if (target === "new") {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [target]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Bitte einen Namen für den Standort angeben.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        isPrimary: form.isPrimary,
        street: form.street || undefined,
        postalCode: form.postalCode || undefined,
        city: form.city || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        employeeCount:
          form.employeeCount.trim() ? Number(form.employeeCount) : undefined,
      };
      const res = await fetch(
        isEdit ?
          `/api/company-locations/${(target as CompanyLocation).id}`
        : "/api/company-locations",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      if (isEdit) {
        toastEdited(`„${form.name}“ wurde aktualisiert.`);
      } else {
        toastCreated(`„${form.name}“ wurde angelegt.`);
      }
      onSaved(data as CompanyLocation);
      onOpenChange(false);
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Standort bearbeiten" : "Standort hinzufügen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="location-name" required>Name</Label>
            <Input
              id="location-name"
              autoFocus
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="z.B. Münster (Hauptsitz)"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="location-street">Anschrift</Label>
              <Input
                id="location-street"
                value={form.street}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, street: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="location-phone">Telefon</Label>
              <Input
                id="location-phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="location-postal-code">PLZ</Label>
              <Input
                id="location-postal-code"
                value={form.postalCode}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, postalCode: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="location-city">Ort</Label>
              <Input
                id="location-city"
                value={form.city}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="location-email">E-Mail</Label>
              <Input
                id="location-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="location-employee-count">Mitarbeitende</Label>
              <Input
                id="location-employee-count"
                type="number"
                min={0}
                value={form.employeeCount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    employeeCount: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isPrimary}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isPrimary: checked === true }))
              }
            />
            Als Hauptsitz markieren
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-[#D4D4D4]"
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
