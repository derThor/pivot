"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Diamond,
  Globe,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MandantHeaderShell,
  STATUS_ACCENT,
  initialsOf,
} from "@/components/mandant-header";
import { MandantLogoField } from "@/components/mandant-logo-field";
import { SegmentedPicker } from "@/components/segmented-picker";
import { Switch } from "@/components/ui/switch";
import { SystemMessage } from "@/components/ui/system-message";
import { Textarea } from "@/components/ui/textarea";
import type { MandantListItem, ModuleCatalogEntry } from "@/lib/api-server";
import { bff } from "@/lib/bff";

// Nutzervorgabe, 2026-08-27: "Aktiv in Pivot grün, Inaktiv in orange und
// Gesperrt in rot" – wiederverwendet dieselben `badge--*`-Farbklassen wie
// der Status-Badge oben in der Kopfzeile.
const STATUS_OPTIONS: {
  value: MandantListItem["status"];
  label: string;
  activeClassName: string;
}[] = [
  { value: "active", label: "Aktiv", activeClassName: "badge--green" },
  { value: "inactive", label: "Inaktiv", activeClassName: "badge--amber" },
  { value: "locked", label: "Gesperrt", activeClassName: "badge--red" },
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

// Die erste Karte liegt komplett auf dem dunklen Kopf-Motiv (Nutzervorgabe,
// 2026-09-01, nach Bildvorlage) – Label und Eingabefelder brauchen dort
// eigene Farben, die App-Standardwerte (dunkler Text auf hellem Grund)
// wären unlesbar. Bewusst zwei Konstanten statt einer neuen `dark`-Variante
// an `Input`/`Label`: es ist die einzige Stelle in der App mit einem
// dauerhaft dunklen Formulargrund, und die Komponenten sind sonst
// theme-gesteuert.
const DARK_LABEL =
  "text-xs font-semibold tracking-wide text-white/60 uppercase";
const DARK_INPUT =
  "border-white/15 bg-white/5 text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:ring-white/20";

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
  logoFolderId,
}: {
  mandant: MandantListItem;
  moduleCatalog: ModuleCatalogEntry[];
  logoFolderId: string | null;
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
  const [deleteWebsiteTarget, setDeleteWebsiteTarget] = useState<
    MandantListItem["websites"][number] | null
  >(null);

  const [pendingModuleKey, setPendingModuleKey] = useState<string | null>(null);
  const [pendingFeatureKey, setPendingFeatureKey] = useState<string | null>(
    null,
  );
  const [removeModuleTarget, setRemoveModuleTarget] = useState<string | null>(
    null,
  );
  // Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): "unter Mandanten
  // und da dann das Modul auswählen soll alles eingestellt werden" – Klick
  // auf ein gebuchtes Modul mit Unter-Features klappt dessen Reiter-Regler
  // auf.
  const [expandedModuleKey, setExpandedModuleKey] = useState<string | null>(
    null,
  );
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);

  const addedModuleKeys = new Set(mandant.modules.map((m) => m.moduleKey));
  const availableModules = moduleCatalog.filter(
    (module) => !addedModuleKeys.has(module.key),
  );
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
      const res = await fetch(bff(`/api/mandanten/${mandant.id}`), {
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
      const res = await fetch(bff(`/api/mandanten/${mandant.id}/websites`), {
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

  // Nutzervorgabe, 2026-08-27: "webseiten dürfen nur noch über Mandanten
  // entfernt werden" – die Löschen-Aktion zog von der Webseite-Seite
  // hierher um, ruft aber denselben bestehenden Endpunkt auf
  // (`DELETE /websites/:id`, unverändert).
  async function handleDeleteWebsite() {
    if (!deleteWebsiteTarget) return;
    const res = await fetch(bff(`/api/websites/${deleteWebsiteTarget.id}`), {
      method: "DELETE",
    });
    if (!res.ok) return;
    toastDeleted(`„${deleteWebsiteTarget.domain}“ wurde entfernt.`);
    router.refresh();
  }

  // Nutzervorgabe, 2026-08-27: "Module ... soll mit Button hinzugefügt
  // werden. wenn dann hinzugefügt wurde, soll aktivierbar und
  // deaktivierbar mit Schieberegler ... laufen. Module sollen auch
  // entfernt werden können" – drei getrennte Aktionen statt der
  // früheren Ersetze-alles-PATCH.
  async function handleAddModule(moduleKey: string) {
    setPendingModuleKey(moduleKey);
    try {
      const res = await fetch(bff(`/api/mandanten/${mandant.id}/modules`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toastEdited(data?.message ?? "Modul konnte nicht hinzugefügt werden.");
        return;
      }
      setModuleDialogOpen(false);
      router.refresh();
    } finally {
      setPendingModuleKey(null);
    }
  }

  async function handleToggleModule(moduleKey: string, enabled: boolean) {
    setPendingModuleKey(moduleKey);
    try {
      const res = await fetch(
        bff(`/api/mandanten/${mandant.id}/modules/${moduleKey}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
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

  async function handleToggleFeature(
    moduleKey: string,
    featureKey: string,
    enabled: boolean,
  ) {
    setPendingFeatureKey(featureKey);
    try {
      const res = await fetch(
        bff(
          `/api/mandanten/${mandant.id}/modules/${moduleKey}/features/${featureKey}`,
        ),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toastEdited(data?.message ?? "Reiter konnte nicht geändert werden.");
        return;
      }
      router.refresh();
    } finally {
      setPendingFeatureKey(null);
    }
  }

  async function handleRemoveModule() {
    if (!removeModuleTarget) return;
    const res = await fetch(
      bff(`/api/mandanten/${mandant.id}/modules/${removeModuleTarget}`),
      { method: "DELETE" },
    );
    if (!res.ok) return;
    toastDeleted("Modul wurde entfernt.");
    router.refresh();
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
            className="border-button-border"
            render={<Link href="/dashboard/websites" />}
          >
            Webseite öffnen
          </Button>
          <Button type="button" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </div>

      {/* Zweispaltig ab lg (Nutzervorgabe, 2026-09-01: "mandanten detail
          zu 2 spaltig, so das websites und module rechts als sidebar
          sind") – Stammdaten und Firmenangaben links, die beiden
          Verwaltungs-Karten rechts. Breitenverhältnis nach der
          app-weiten Konvention (`grid-cols-3` + `col-span-2`, siehe
          Mein Konto). `items-start` ist Pflicht, sonst zieht die
          höhere Spalte die andere auf ihre Höhe.  */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Ganze Karte auf dem dunklen Kopf-Motiv (Nutzervorgabe,
            2026-09-01, nach Bildvorlage: "stell unter mandanten detailseite
            die erste kachel so dar") – vorher lag nur der Kopf auf dem
            Motiv und darunter kam eine normale weiße `CardContent`-Fläche.
            Die Formularfelder tragen deshalb hier eigene Klassen für den
            dunklen Grund; `MandantHeaderShell` bringt Rundung, Motiv, Scrim
            und Statusstreifen mit. Der Streifen folgt dem im Formular
            GEWÄHLTEN Status, nicht dem gespeicherten: die Umschaltung
            darunter wird so sofort oben sichtbar, auch bevor gespeichert
            wurde. */}
          <MandantHeaderShell
            status={status}
            className="rounded-xl p-6 pb-8 shadow-sm"
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
                <MandantLogoField
                  mandantId={mandant.id}
                  currentUrl={mandant.logoUrl}
                  folderId={logoFolderId}
                  initials={initialsOf(mandant.name)}
                  accentColor={STATUS_ACCENT[status]}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xl leading-[1.15] font-bold text-white">
                      {mandant.name}
                    </p>
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
                  {/* Domain, Ort und Website-Zahl in einer Monospace-Zeile
                    (Bildvorlage) statt wie bisher untereinander – die drei
                    Angaben sind kurz und gehören zusammen. `flex-wrap`
                    fängt schmale Breiten ab. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-white/55">
                    {primaryDomain && (
                      <span className="truncate">{primaryDomain}</span>
                    )}
                    {location && <span className="truncate">{location}</span>}
                    <span>
                      {mandant.websites.length}{" "}
                      {mandant.websites.length === 1 ? "Webseite" : "Webseiten"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mandant-name" className={DARK_LABEL} required>
                    Bezeichnung
                  </Label>
                  <Input
                    id="mandant-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={DARK_INPUT}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mandant-domain" className={DARK_LABEL}>
                    Hauptdomain
                  </Label>
                  <Input
                    id="mandant-domain"
                    value={primaryDomain}
                    readOnly
                    className={DARK_INPUT}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <SegmentedPicker
                  label="Mitgliedschaft"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={setStatus}
                  variant="onDark"
                />
                <p className="text-xs text-white/55">
                  {STATUS_DESCRIPTION[status]}
                </p>
              </div>
              {/* Sperrvermerk in beiden Themes dunkel (Nutzerentscheidung,
                  2026-09-01, nach einem Hin und Her: erst fest dunkel,
                  dann theme-abhängig hell, jetzt wieder fest dunkel) – die
                  Box liegt auf dem immer dunklen Kartengrund, eine helle
                  Fläche riss dort ein Loch. Werte wie die Dark-Seite der
                  `warning`-Variante in `ui/system-message.tsx`; bewusst
                  ohne `dark:`-Präfix, weil der Untergrund hier eben nicht
                  dem Theme folgt. Bitte nicht erneut auf die Light-Werte
                  umstellen. */}
              {status === "locked" && (
                <div className="flex flex-col gap-2 rounded-lg border border-[#6b5220] bg-[#3d2f10] p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#f8e6bd]">
                    <Lock className="size-4" />
                    Sperrvermerk
                  </p>
                  <Textarea
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    placeholder="z.B. Beitrag für Q3/2026 offen — Zugang bis Zahlungseingang gesperrt."
                    className={DARK_INPUT}
                  />
                </div>
              )}
              {saveError && (
                <p className="text-sm text-[#fb9c9c]">{saveError}</p>
              )}
            </div>
          </MandantHeaderShell>

          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Firmenangaben</CardTitle>
              <p className="text-sm text-muted-foreground">
                Speisen Impressum, Datenschutzhinweise und Systemmails dieses
                Mandanten.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SystemMessage
                variant={requiredFilled ? "success" : "warning"}
                title={
                  requiredFilled
                    ? "Pflichtangaben vollständig."
                    : "Pflichtangaben unvollständig."
                }
                icon={false}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mandant-legal-name" required>
                    Firmierung
                  </Label>
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
                  <Label htmlFor="mandant-street" required>
                    Straße und Hausnummer
                  </Label>
                  <Input
                    id="mandant-street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mandant-postal-code" required>
                    PLZ
                  </Label>
                  <Input
                    id="mandant-postal-code"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mandant-city" required>
                    Ort
                  </Label>
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
                  <Label htmlFor="mandant-email" required>
                    E-Mail
                  </Label>
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
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Webseiten</CardTitle>
              <p className="text-sm text-muted-foreground">
                Domains, die dieser Mandant betreibt. Inhalte und Module gelten
                je Domain.
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
                          {index === 0 ? "Hauptdomain" : "Webseite"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-button-border"
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`„${website.domain}“ löschen`}
                        onClick={() => setDeleteWebsiteTarget(website)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <form
                onSubmit={handleAddWebsite}
                className="flex flex-col gap-1.5"
              >
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
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>Module</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Gilt für alle Webseiten dieses Mandanten gleichermaßen.
                  </p>
                </div>
                <Dialog
                  open={moduleDialogOpen}
                  onOpenChange={setModuleDialogOpen}
                >
                  <DialogTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-button-border"
                        disabled={availableModules.length === 0}
                      />
                    }
                  >
                    <Plus />
                    Modul hinzufügen
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Modul hinzufügen</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                      {availableModules.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Alle Module bereits hinzugefügt.
                        </p>
                      ) : (
                        availableModules.map((module) => {
                          const Icon = MODULE_ICONS[module.key] ?? Diamond;
                          return (
                            <button
                              key={module.key}
                              type="button"
                              disabled={pendingModuleKey === module.key}
                              onClick={() => handleAddModule(module.key)}
                              className="flex items-center gap-3 rounded-lg border border-border bg-muted p-3 text-left transition-colors hover:bg-muted/70 disabled:cursor-default disabled:opacity-60"
                            >
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-foreground shadow-sm">
                                <Icon className="size-4.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium">
                                    {module.label}
                                  </p>
                                  <Badge className="badge--slate border-0">
                                    {CATEGORY_LABEL[module.category]}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {module.description}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {mandant.modules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Module hinzugefügt.
                </p>
              ) : (
                mandant.modules.map((entry) => {
                  const catalogEntry = moduleCatalog.find(
                    (m) => m.key === entry.moduleKey,
                  );
                  if (!catalogEntry) return null;
                  const Icon = MODULE_ICONS[entry.moduleKey] ?? Diamond;
                  const hasFeatures = (catalogEntry.features?.length ?? 0) > 0;
                  const isExpanded = expandedModuleKey === entry.moduleKey;
                  return (
                    <div
                      key={entry.moduleKey}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={!hasFeatures || !entry.enabled}
                          onClick={() =>
                            setExpandedModuleKey(
                              isExpanded ? null : entry.moduleKey,
                            )
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-foreground shadow-sm">
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">
                                {catalogEntry.label}
                              </p>
                              <Badge className="badge--slate border-0">
                                {CATEGORY_LABEL[catalogEntry.category]}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {entry.enabled
                                ? `Für ${mandant.websites.length} ${mandant.websites.length === 1 ? "Webseite" : "Webseiten"} aktiv`
                                : "Deaktiviert"}
                            </p>
                          </div>
                          {hasFeatures && entry.enabled && (
                            <ChevronRight
                              className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            />
                          )}
                        </button>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Switch
                            checked={entry.enabled}
                            disabled={pendingModuleKey === entry.moduleKey}
                            onCheckedChange={(checked) =>
                              handleToggleModule(entry.moduleKey, checked)
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${catalogEntry.label} entfernen`}
                            onClick={() =>
                              setRemoveModuleTarget(entry.moduleKey)
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      {isExpanded && hasFeatures && entry.enabled && (
                        <div className="flex flex-col gap-1.5 border-t border-border pt-3 pl-11">
                          {catalogEntry.features!.map((feature) => (
                            <div
                              key={feature.key}
                              className="flex items-center justify-between gap-3 rounded-md bg-card p-2.5"
                            >
                              <p className="text-sm">{feature.label}</p>
                              <Switch
                                checked={entry.enabledFeatures.includes(
                                  feature.key,
                                )}
                                disabled={pendingFeatureKey === feature.key}
                                onCheckedChange={(checked) =>
                                  handleToggleFeature(
                                    entry.moduleKey,
                                    feature.key,
                                    checked,
                                  )
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteWebsiteTarget !== null}
        onOpenChange={(open) => !open && setDeleteWebsiteTarget(null)}
        title={`„${deleteWebsiteTarget?.domain}“ löschen?`}
        description="Die Webseite wird endgültig aus diesem Mandanten entfernt. Die Installation selbst bleibt unberührt, meldet sich aber nicht mehr erfolgreich bei diesem Master."
        onConfirm={handleDeleteWebsite}
      />

      <ConfirmDeleteDialog
        open={removeModuleTarget !== null}
        onOpenChange={(open) => !open && setRemoveModuleTarget(null)}
        title="Modul entfernen?"
        description="Das Modul wird für diesen Mandanten vollständig entfernt (nicht nur deaktiviert) und müsste danach erneut hinzugefügt werden."
        onConfirm={handleRemoveModule}
      />
    </div>
  );
}
