"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogoUploadField } from "@/components/logo-upload-field";
import { PageContent } from "@/components/page-content";
import type { AppSettings } from "@/lib/api-server";

const companyFields = [
  { key: "companyName", label: "Firmenname" },
  { key: "companyStreet", label: "Straße und Hausnummer" },
  { key: "companyPostalCode", label: "PLZ" },
  { key: "companyCity", label: "Ort" },
  { key: "companyCountry", label: "Land" },
  { key: "companyRepresentative", label: "Vertretungsberechtigte Person" },
  { key: "companyEmail", label: "E-Mail" },
  { key: "companyPhone", label: "Telefon" },
  { key: "companyRegisterCourt", label: "Registergericht" },
  { key: "companyRegisterNumber", label: "Handelsregisternummer" },
  { key: "companyVatId", label: "USt-IdNr." },
] as const;

type CompanyFieldKey = (typeof companyFields)[number]["key"];

const settingsSchema = z.object({
  allowRegistration: z.boolean(),
  allowPasswordReset: z.boolean(),
  allowEmailChange: z.boolean(),
  requireAdminActivation: z.boolean(),
  autosaveEnabled: z.boolean(),
  mediaResponsiveVariantsEnabled: z.boolean(),
  passwordMinLength: z.number().int().min(4).max(128),
  passwordRequireUppercase: z.boolean(),
  passwordRequireLowercase: z.boolean(),
  passwordRequireNumber: z.boolean(),
  passwordRequireSpecialChar: z.boolean(),
  defaultPageSize: z.number().int().min(1).max(100),
});

type SettingsValues = z.infer<typeof settingsSchema>;

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex flex-col gap-0.5">
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function SettingsForm({
  settings,
  logoFolderId,
}: {
  settings: AppSettings;
  logoFolderId: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyValues, setCompanyValues] = useState<
    Record<CompanyFieldKey, string>
  >(
    Object.fromEntries(
      companyFields.map(({ key }) => [key, settings[key] ?? ""]),
    ) as Record<CompanyFieldKey, string>,
  );

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      allowRegistration: settings.allowRegistration,
      allowPasswordReset: settings.allowPasswordReset,
      allowEmailChange: settings.allowEmailChange,
      requireAdminActivation: settings.requireAdminActivation,
      autosaveEnabled: settings.autosaveEnabled,
      mediaResponsiveVariantsEnabled: settings.mediaResponsiveVariantsEnabled,
      passwordMinLength: settings.passwordMinLength,
      passwordRequireUppercase: settings.passwordRequireUppercase,
      passwordRequireLowercase: settings.passwordRequireLowercase,
      passwordRequireNumber: settings.passwordRequireNumber,
      passwordRequireSpecialChar: settings.passwordRequireSpecialChar,
      defaultPageSize: settings.defaultPageSize,
    },
  });

  async function onSubmit(values: SettingsValues) {
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, ...companyValues }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.message ?? "Einstellungen konnten nicht gespeichert werden.",
        );
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col"
      >
        <PageContent className="gap-4">
          <Tabs defaultValue="company">
            <TabsList>
              <TabsTrigger value="company">Firma</TabsTrigger>
              <TabsTrigger value="access">Zugriff & Funktionen</TabsTrigger>
              <TabsTrigger value="password-policy">
                Passwort-Richtlinie
              </TabsTrigger>
              <TabsTrigger value="display">Darstellung</TabsTrigger>
            </TabsList>

            <TabsContent value="company">
              <Card className="border-none bg-transparent shadow-none">
                <CardHeader>
                  <CardTitle>Firmenangaben</CardTitle>
                  <CardDescription>
                    Für Impressum und Datenschutzhinweise.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2">
                  {companyFields.map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-2">
                      <Label htmlFor={key}>{label}</Label>
                      <Input
                        id={key}
                        value={companyValues[key]}
                        onChange={(e) =>
                          setCompanyValues((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="mt-6 border-none bg-transparent shadow-none">
                <CardHeader>
                  <CardTitle>Logo</CardTitle>
                  <CardDescription>
                    Aus-/eingeklapptes Logo für die Seitenleiste sowie das Bild
                    neben dem Formular auf der Login- und Registrierungsseite.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-3">
                  <LogoUploadField
                    field="logoExpandedUrl"
                    label="Logo (ausgeklappt)"
                    currentUrl={settings.logoExpandedUrl}
                    folderId={logoFolderId}
                  />
                  <LogoUploadField
                    field="logoCollapsedUrl"
                    label="Logo (eingeklappt)"
                    currentUrl={settings.logoCollapsedUrl}
                    folderId={logoFolderId}
                  />
                  <LogoUploadField
                    field="authImageUrl"
                    label="Anmelde-Bild"
                    currentUrl={settings.authImageUrl}
                    folderId={logoFolderId}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="access">
              <Card className="border-none bg-transparent shadow-none">
                <CardHeader>
                  <CardTitle>Zugriff & Funktionen</CardTitle>
                  <CardDescription>
                    Steuert, welche Selbstbedienungs-Funktionen verfügbar sind.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-10">
                  <FormField
                    control={form.control}
                    name="allowRegistration"
                    render={({ field }) => (
                      <FormItem>
                        <SwitchRow
                          label="Registrierung erlauben"
                          description="Neue Benutzer können sich selbst über /register registrieren."
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allowPasswordReset"
                    render={({ field }) => (
                      <FormItem>
                        <SwitchRow
                          label="Passwort-vergessen erlauben"
                          description="Benutzer können ihr Passwort selbst per E-Mail-Link zurücksetzen."
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allowEmailChange"
                    render={({ field }) => (
                      <FormItem>
                        <SwitchRow
                          label="E-Mail-Änderung erlauben"
                          description="Benutzer und Admins können die E-Mail-Adresse eines Kontos ändern."
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requireAdminActivation"
                    render={({ field }) => (
                      <FormItem>
                        <SwitchRow
                          label="Admin-Freischaltung erforderlich"
                          description="Neu registrierte Benutzer sind zunächst deaktiviert und müssen von einem Admin freigeschaltet werden, bevor sie sich anmelden können. Deaktiviert: neue Benutzer sind sofort aktiv."
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autosaveEnabled"
                    render={({ field }) => (
                      <FormItem>
                        <SwitchRow
                          label="Autosave im Content-Editor"
                          description="Speichert Entwürfe während der Bearbeitung automatisch lokal im Browser und bietet beim erneuten Öffnen an, nicht gespeicherte Änderungen wiederherzustellen."
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mediaResponsiveVariantsEnabled"
                    render={({ field }) => (
                      <FormItem>
                        <SwitchRow
                          label="Automatische Bildvarianten"
                          description="Erzeugt beim Hochladen von Bildern automatisch verkleinerte WebP/AVIF-Varianten für responsive Darstellung. Deaktiviert: Bilder werden nur normalisiert (EXIF entfernt, komprimiert) gespeichert, ohne zusätzliche Größenvarianten."
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="password-policy">
              <Card className="border-none bg-transparent shadow-none">
                <CardHeader>
                  <CardTitle>Passwort-Richtlinie</CardTitle>
                  <CardDescription>
                    Gilt für Registrierung, neue Benutzer, Passwort ändern und
                    Passwort-Reset.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-10">
                  <FormField
                    control={form.control}
                    name="passwordMinLength"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-4">
                          <Label htmlFor="passwordMinLength">
                            Mindestlänge
                          </Label>
                          <FormControl>
                            <Input
                              id="passwordMinLength"
                              type="number"
                              min={4}
                              max={128}
                              className="w-24"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.valueAsNumber)
                              }
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-col gap-10">
                    <FormField
                      control={form.control}
                      name="passwordRequireUppercase"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Großbuchstabe erforderlich"
                            description="Mindestens ein Großbuchstabe (A-Z)."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="passwordRequireLowercase"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Kleinbuchstabe erforderlich"
                            description="Mindestens ein Kleinbuchstabe (a-z)."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="passwordRequireNumber"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Ziffer erforderlich"
                            description="Mindestens eine Ziffer (0-9)."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="passwordRequireSpecialChar"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Sonderzeichen erforderlich"
                            description="Mindestens ein Zeichen, das kein Buchstabe/Ziffer ist."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="display">
              <Card className="border-none bg-transparent shadow-none">
                <CardHeader>
                  <CardTitle>Darstellung</CardTitle>
                  <CardDescription>
                    Gilt für alle Listen-Ansichten im Dashboard (Inhalte,
                    Medien, Kategorien, Tags, Benutzer, Rollen,
                    Versionshistorie).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="defaultPageSize"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-4">
                          <Label htmlFor="defaultPageSize">
                            Einträge pro Seite
                          </Label>
                          <FormControl>
                            <Input
                              id="defaultPageSize"
                              type="number"
                              min={1}
                              max={100}
                              className="w-24"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.valueAsNumber)
                              }
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-muted-foreground">Gespeichert.</p>
          )}
        </PageContent>
        <PageContent plain className="mt-10 items-start">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Speichert…" : "Einstellungen speichern"}
          </Button>
        </PageContent>
      </form>
    </Form>
  );
}
