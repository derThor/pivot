"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Diamond, Globe, Lock, ShieldCheck } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedPicker } from "@/components/segmented-picker";
import { Switch } from "@/components/ui/switch";
import { SystemMessage } from "@/components/ui/system-message";
import { Textarea } from "@/components/ui/textarea";
import type { MandantListItem, ModuleCatalogEntry } from "@/lib/api-server";

const STATUS_OPTIONS: { value: MandantListItem["status"]; label: string }[] = [
  { value: "active", label: "Aktiv" },
  { value: "inactive", label: "Inaktiv" },
  { value: "locked", label: "Gesperrt" },
];

const STATUS_DESCRIPTION: Record<MandantListItem["status"], string> = {
  active: "Mandant nutzt das System regulär.",
  inactive: "Mandant ist vorübergehend nicht aktiv, aber nicht gesperrt.",
  // Nutzervorgabe, 2026-08-27: "wenn gesperrt, dann Sperrvermerk" – siehe
  // die zusätzliche Box weiter unten.
  locked: "Zugang gesperrt, Sperrvermerk erforderlich.",
};

const MODULE_ICONS: Record<string, typeof Diamond> = {
  magicline: Diamond,
  datenschutz: ShieldCheck,
};

const CATEGORY_LABEL: Record<ModuleCatalogEntry["category"], string> = {
  integration: "Schnittstelle",
  compliance: "Compliance",
};

/** Mandant-Detailseite (Nutzervorgabe, 2026-08-27, 1:1 nach Mockup):
 * Bezeichnung/Mitgliedschaft, Firmenangaben (speisen künftig Impressum/
 * Systemmails DIESER Installation – aktuell reine Master-Referenzdaten,
 * noch kein automatischer Abgleich mit der Client-Installation), die
 * verbundenen Websites (mit "Domain hinzufügen") und die gebuchten
 * Module. */
export function MandantDetailView({
  mandant,
  moduleCatalog,
}: {
  mandant: MandantListItem;
  moduleCatalog: ModuleCatalogEntry[];
}) {
  const router = useRouter();
  const [name, setName] = useState(mandant.name);
  const [status, setStatus] = useState(mandant.status);
  const [lockReason, setLockReason] = useState(mandant.lockReason ?? "");
  const [legalName, setLegalName] = useState(mandant.legalName ?? "");
  const [representativeName, setRepresentativeName] = useState(
    mandant.representativeName ?? "",
  );
  const [street, setStreet] = useState(mandant.street ?? "");
  const [postalCode, setPostalCode] = useState(mandant.postalCode ?? "");
  const [city, setCity] = useState(mandant.city ?? "");
  const [country, setCountry] = useState(mandant.country ?? "");
  const [email, setEmail] = useState(mandant.email ?? "");
  const [phone, setPhone] = useState(mandant.phone ?? "");
  const [registerInfo, setRegisterInfo] = useState(mandant.registerInfo ?? "");
  const [vatId, setVatId] = useState(mandant.vatId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newDomain, setNewDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [isAddingWebsite, setIsAddingWebsite] = useState(false);

  const [pendingModuleKey, setPendingModuleKey] = useState<string | null>(null);

  const bookedModuleKeys = new Set(mandant.modules.map((m) => m.moduleKey));
  const primaryDomain = mandant.websites[0]?.domain ?? "";
  const location = [postalCode, city].filter(Boolean).join(" ");
  const requiredFilled =
    legalName.trim() &&
    street.trim() &&
    postalCode.trim() &&
    city.trim() &&
    email.trim();

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/mandanten/${mandant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          status,
          legalName: legalName.trim() || undefined,
          representativeName: representativeName.trim() || undefined,
          street: street.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          registerInfo: registerInfo.trim() || undefined,
          lockReason:
            status === "locked" ? lockReason.trim() || undefined : undefined,
          vatId: vatId.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      toastEdited(`„${name}“ wurde aktualisiert.`);
      router.push("/dashboard/mandanten");
      router.refresh();
    } catch {
      setSaveError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddWebsite(event: React.FormEvent) {
    event.preventDefault();
    if (!newDomain.trim()) {
      setDomainError("Bitte eine Domain angeben.");
      return;
    }
    setDomainError(null);
    setIsAddingWebsite(true);
    try {
      const res = await fetch(`/api/mandanten/${mandant.id}/websites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDomainError(
          data?.message ?? "Domain konnte nicht hinzugefügt werden.",
        );
        return;
      }
      toastEdited(`„${newDomain}“ wurde hinzugefügt.`);
      setNewDomain("");
      router.refresh();
    } catch {
      setDomainError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsAddingWebsite(false);
    }
  }

  async function handleToggleModule(moduleKey: string, enabled: boolean) {
    setPendingModuleKey(moduleKey);
    const nextKeys = enabled
      ? [...bookedModuleKeys, moduleKey]
      : [...bookedModuleKeys].filter((key) => key !== moduleKey);
    try {
      const res = await fetch(`/api/mandanten/${mandant.id}/modules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKeys: nextKeys }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toastEdited(data?.message ?? "Modul konnte nicht geändert werden.");
        return;
      }
      router.refresh();
    } finally {
      setPendingModuleKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mandant.name}
          </h1>
          <DashboardBreadcrumbs overrideLast={mandant.name} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border"
            render={<Link href="/dashboard/websites" />}
          >
            Websites öffnen
          </Button>
          <Button type="button" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </div>

      <Card className="rounded-xl shadow-sm">
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{mandant.name}</p>
                <Badge
                  className={
                    status === "active"
                      ? "badge--green border-0"
                      : status === "locked"
                        ? "badge--red border-0"
                        : "badge--slate border-0"
                  }
                >
                  {STATUS_OPTIONS.find((o) => o.value === status)?.label}
                </Badge>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {primaryDomain}
                {location && `, ${location}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-name">Bezeichnung</Label>
              <Input
                id="mandant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-domain">Hauptdomain</Label>
              <Input id="mandant-domain" value={primaryDomain} readOnly />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <SegmentedPicker
              label="Mitgliedschaft"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
            />
            <p className="text-xs text-muted-foreground">
              {STATUS_DESCRIPTION[status]}
            </p>
          </div>
          {status === "locked" && (
            <div className="flex flex-col gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-4 dark:border-[#6b5220] dark:bg-[#3d2f10]">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#78350f] dark:text-[#f8e6bd]">
                <Lock className="size-4" />
                Sperrvermerk
              </p>
              <Textarea
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="z.B. Beitrag für Q3/2026 offen — Zugang bis Zahlungseingang gesperrt."
                className="bg-card"
              />
            </div>
          )}
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Firmenangaben</CardTitle>
          <p className="text-sm text-muted-foreground">
            Speisen Impressum, Datenschutzhinweise und Systemmails dieses
            Mandanten.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-legal-name">Firmierung</Label>
              <Input
                id="mandant-legal-name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-representative">
                Vertretungsberechtigte Person
              </Label>
              <Input
                id="mandant-representative"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-street">Straße und Hausnummer</Label>
              <Input
                id="mandant-street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-postal-code">PLZ</Label>
              <Input
                id="mandant-postal-code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-city">Ort</Label>
              <Input
                id="mandant-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-country">Land</Label>
              <Input
                id="mandant-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-email">E-Mail</Label>
              <Input
                id="mandant-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-phone">Telefon</Label>
              <Input
                id="mandant-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-register">
                Registergericht &amp; Nummer
              </Label>
              <Input
                id="mandant-register"
                value={registerInfo}
                onChange={(e) => setRegisterInfo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mandant-vat-id">USt-IdNr.</Label>
              <Input
                id="mandant-vat-id"
                value={vatId}
                onChange={(e) => setVatId(e.target.value)}
              />
            </div>
          </div>
          <SystemMessage
            variant={requiredFilled ? "success" : "warning"}
            title={
              requiredFilled
                ? "Pflichtangaben vollständig."
                : "Pflichtangaben unvollständig."
            }
            icon={false}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Websites</CardTitle>
          <p className="text-sm text-muted-foreground">
            Domains, die dieser Mandant betreibt. Inhalte und Module gelten je
            Domain.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {mandant.websites.map((website, index) => (
              <div
                key={website.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Globe className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{website.domain}</p>
                    <p className="text-xs text-muted-foreground">
                      {index === 0 ? "Hauptdomain" : "Website"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border"
                  render={
                    <a
                      href={`https://${website.domain}/login`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  Öffnen
                </Button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddWebsite} className="flex flex-col gap-1.5">
            <Label htmlFor="mandant-new-domain">Domain hinzufügen</Label>
            <div className="flex gap-2">
              <Input
                id="mandant-new-domain"
                value={newDomain}
                onChange={(e) => {
                  setNewDomain(e.target.value);
                  if (domainError) setDomainError(null);
                }}
                placeholder="neue-domain.de"
                aria-invalid={domainError ? true : undefined}
              />
              <Button type="submit" disabled={isAddingWebsite}>
                {isAddingWebsite ? "Wird hinzugefügt…" : "Hinzufügen"}
              </Button>
            </div>
            {domainError && (
              <p className="text-sm text-destructive">{domainError}</p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Module</CardTitle>
          <p className="text-sm text-muted-foreground">
            Gilt für alle Websites dieses Mandanten gleichermaßen.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {moduleCatalog.map((module) => {
            const Icon = MODULE_ICONS[module.key] ?? Diamond;
            const isBooked = bookedModuleKeys.has(module.key);
            return (
              <div
                key={module.key}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-foreground shadow-sm">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{module.label}</p>
                      <Badge className="badge--slate border-0">
                        {CATEGORY_LABEL[module.category]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isBooked
                        ? `Für ${mandant.websites.length} ${mandant.websites.length === 1 ? "Website" : "Websites"} aktiv`
                        : module.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isBooked}
                  disabled={pendingModuleKey === module.key}
                  onCheckedChange={(checked) =>
                    handleToggleModule(module.key, checked)
                  }
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
