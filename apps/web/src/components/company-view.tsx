"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Plus } from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SystemMessage } from "@/components/ui/system-message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyLocationDialog } from "@/components/company-location-dialog";
import { RowActionButtons } from "@/components/row-action-buttons";
import { companyFields, type CompanyFieldKey } from "@/lib/company-fields";
import { resolveImageSrc } from "@/lib/media";
import { formatName, truncateMiddle } from "@/lib/utils";
import { bff } from "@/lib/bff";
import type {
  CompanyChange,
  CompanyLocation,
  CompanySettings,
} from "@/lib/api-server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CompanyView({
  settings,
  locations: initialLocations,
  changes,
  logoUrl,
}: {
  settings: CompanySettings;
  locations: CompanyLocation[];
  changes: CompanyChange[];
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"stammdaten" | "standorte">(
    "stammdaten",
  );
  const defaultValues = Object.fromEntries(
    companyFields.map(({ key }) => [key, settings[key] ?? ""]),
  ) as Record<CompanyFieldKey, string>;
  const [values, setValues] = useState(defaultValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState(initialLocations);
  const [dialogTarget, setDialogTarget] = useState<
    CompanyLocation | null | "new"
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyLocation | null>(
    null,
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    locations[0]?.id ?? null,
  );
  const selectedLocation =
    locations.find((l) => l.id === selectedLocationId) ?? locations[0] ?? null;

  const filledCount = companyFields.filter(({ key }) => values[key]).length;
  const completionPercent = Math.round(
    (filledCount / companyFields.length) * 100,
  );

  function handleDiscard() {
    setValues(defaultValues);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(bff("/api/settings/company"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      toastEdited("Die Firmenangaben wurden gespeichert.");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function upsertLocation(location: CompanyLocation) {
    setLocations((prev) => {
      const withoutPrimaryClash = location.isPrimary
        ? prev.map((l) => ({ ...l, isPrimary: false }))
        : prev;
      const exists = withoutPrimaryClash.some((l) => l.id === location.id);
      const next = exists
        ? withoutPrimaryClash.map((l) => (l.id === location.id ? location : l))
        : [...withoutPrimaryClash, location];
      return next.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    });
    setSelectedLocationId(location.id);
  }

  async function handleDeleteLocation() {
    if (!deleteTarget) return;
    await fetch(bff(`/api/company-locations/${deleteTarget.id}`), {
      method: "DELETE",
    });
    setLocations((prev) => prev.filter((l) => l.id !== deleteTarget.id));
    if (selectedLocationId === deleteTarget.id) {
      setSelectedLocationId(null);
    }
    toastDeleted(`„${deleteTarget.name}“ wurde gelöscht.`);
    setDeleteTarget(null);
  }

  const addressLine = [
    values.companyStreet,
    [values.companyPostalCode, values.companyCity].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const registerBadge =
    values.companyRegisterCourt && values.companyRegisterNumber
      ? `${values.companyRegisterCourt} · ${values.companyRegisterNumber}`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Firma</h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
            onClick={handleDiscard}
            disabled={isSubmitting}
          >
            Verwerfen
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-4 rounded-xl bg-card shadow-sm p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Logo kommt aus Nutzer-Upload (beliebige externe/lokale URL), kein next/image-Optimierungsfall.
            <img
              src={resolveImageSrc(logoUrl)}
              alt=""
              className="h-11 w-auto max-w-[160px] shrink-0 object-contain"
            />
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="size-5" />
            </span>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {values.companyName || "Firma noch nicht benannt"}
              </span>
              {registerBadge && (
                <Badge
                  variant="secondary"
                  className="bg-muted text-muted-foreground"
                >
                  {registerBadge}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {addressLine && <span>{addressLine}</span>}
              {values.companyEmail && <span>{values.companyEmail}</span>}
              {values.companyPhone && <span>{values.companyPhone}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">
            {filledCount}/{companyFields.length}
          </div>
          <div className="text-xs text-muted-foreground uppercase">Felder</div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        className="gap-4"
      >
        <TabsList className="!h-auto w-fit justify-start gap-1 !overflow-visible p-1">
          <TabsTrigger
            value="stammdaten"
            className="!h-auto min-h-[52px] flex-none flex-col items-start justify-center gap-0.5 rounded-lg px-4 py-2.5 text-left whitespace-normal"
          >
            <span className="text-sm font-semibold">Stammdaten</span>
            <span className="text-xs font-normal text-muted-foreground">
              Firmierung, Anschrift, Register
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="standorte"
            className="!h-auto min-h-[52px] flex-none flex-col items-start justify-center gap-0.5 rounded-lg px-4 py-2.5 text-left whitespace-normal"
          >
            <span className="text-sm font-semibold">Standorte</span>
            <span className="text-xs font-normal text-muted-foreground">
              {locations.length}{" "}
              {locations.length === 1 ? "Adresse" : "Adressen"}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stammdaten">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <Card className="rounded-xl shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle>Firmenangaben</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Diese Daten speisen Impressum, Datenschutzhinweise und
                  Systemmails.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2">
                {companyFields.map(({ key, label }) => (
                  <div key={key} className="flex flex-col gap-2">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      value={values[key]}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Vollständigkeit
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold">
                      {completionPercent}%
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {filledCount} von {companyFields.length} Feldern
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  {completionPercent === 100 ? (
                    <SystemMessage
                      variant="success"
                      title="Alle Pflichtfelder gefüllt."
                    />
                  ) : (
                    <SystemMessage
                      variant="warning"
                      title={`${companyFields.length - filledCount} ${
                        companyFields.length - filledCount === 1
                          ? "Feld fehlt"
                          : "Felder fehlen"
                      } noch.`}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Letzte Änderungen
                  </p>
                </CardHeader>
                <CardContent>
                  {changes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Noch keine Änderungen erfasst.
                    </p>
                  ) : (
                    <ol className="flex flex-col">
                      {changes.map((change, index) => {
                        const fieldLabel =
                          companyFields.find(
                            (f) => f.key === change.metadata?.field,
                          )?.label ??
                          change.metadata?.field ??
                          "Feld";
                        const verb = change.metadata?.wasEmpty
                          ? "ergänzt"
                          : "aktualisiert";
                        const isLast = index === changes.length - 1;
                        return (
                          <li key={change.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <span
                                className={
                                  index === 0
                                    ? "mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                                    : "mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/30"
                                }
                              />
                              {!isLast && (
                                <span className="w-px flex-1 bg-pivot-line2" />
                              )}
                            </div>
                            <div className={isLast ? "pb-0" : "pb-4"}>
                              <p className="text-sm font-medium">
                                {fieldLabel} {verb}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatName(change.user)} ·{" "}
                                {formatDate(change.createdAt)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="standorte">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <div className="overflow-hidden rounded-xl bg-card shadow-sm lg:col-span-2">
              {locations.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Noch keine Standorte angelegt.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {locations.map((location) => {
                    const isSelected = location.id === selectedLocation?.id;
                    const addressSummary =
                      location.street || location.city
                        ? [location.street, location.city]
                            .filter(Boolean)
                            .join(", ")
                        : "– · verteilt";
                    return (
                      <div
                        key={location.id}
                        className={`flex items-center justify-between gap-4 border-l-4 px-4 py-4 transition-colors ${
                          isSelected
                            ? "border-l-primary bg-primary/15"
                            : "border-l-transparent hover:bg-muted/50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedLocationId(location.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                              isSelected
                                ? "bg-primary/25 text-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            <MapPin className="size-4" />
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {location.name}
                              </span>
                              {location.isPrimary && (
                                <Badge className="bg-primary/25 text-foreground hover:bg-primary/25">
                                  Hauptsitz
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {addressSummary}
                            </span>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          {location.employeeCount != null && (
                            <Badge
                              variant="secondary"
                              className="bg-muted text-muted-foreground"
                            >
                              {location.employeeCount} Personen
                            </Badge>
                          )}
                          <RowActionButtons
                            size="icon-sm"
                            editLabel={`„${location.name}“ bearbeiten`}
                            deleteLabel={`„${location.name}“ löschen`}
                            onEdit={() => setDialogTarget(location)}
                            onDelete={() => setDeleteTarget(location)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="px-4">
                <Separator />
              </div>
              <div className="p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="border-button-border"
                  onClick={() => setDialogTarget("new")}
                >
                  <Plus className="size-4" />
                  Standort hinzufügen
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {selectedLocation ? (
                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Standort
                    </p>
                    <CardTitle>{selectedLocation.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col divide-y divide-border text-sm">
                      {selectedLocation.street && (
                        <div className="flex items-center justify-between py-2 first:pt-0">
                          <span className="text-muted-foreground">
                            Anschrift
                          </span>
                          <span>{selectedLocation.street}</span>
                        </div>
                      )}
                      {(selectedLocation.postalCode ||
                        selectedLocation.city) && (
                        <div className="flex items-center justify-between py-2">
                          <span className="text-muted-foreground">Ort</span>
                          <span>
                            {[
                              selectedLocation.postalCode,
                              selectedLocation.city,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          </span>
                        </div>
                      )}
                      {selectedLocation.phone && (
                        <div className="flex items-center justify-between py-2">
                          <span className="text-muted-foreground">Telefon</span>
                          <span>{selectedLocation.phone}</span>
                        </div>
                      )}
                      {selectedLocation.email && (
                        <div className="flex items-center justify-between py-2">
                          <span className="text-muted-foreground">E-Mail</span>
                          <span>{selectedLocation.email}</span>
                        </div>
                      )}
                      {selectedLocation.employeeCount != null && (
                        <div className="flex items-center justify-between py-2 last:pb-0">
                          <span className="text-muted-foreground">
                            Mitarbeitende
                          </span>
                          <span>{selectedLocation.employeeCount}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => setDialogTarget(selectedLocation)}
                    >
                      Standort bearbeiten
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-xl bg-card shadow-sm p-6 text-sm text-muted-foreground">
                  Wähle links einen Standort aus oder lege einen neuen an.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <CompanyLocationDialog
        target={dialogTarget}
        onOpenChange={(open) => !open && setDialogTarget(null)}
        onSaved={upsertLocation}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`„${truncateMiddle(deleteTarget?.name ?? "")}“ löschen?`}
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDeleteLocation}
      />
    </div>
  );
}
