"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bell,
  Blocks,
  ChevronRight,
  Construction,
  Contrast,
  DatabaseZap,
  Globe,
  History,
  Mail,
  Menu,
  Monitor,
  Palette,
  PanelTop,
  Plug,
  Ruler,
  Shield,
  ShieldCheck,
  Smartphone,
  // "Tablet" kollidiert mit nichts, wird aber umbenannt, damit im JSX
  // klar bleibt, dass es das Icon ist und nicht der Breakpoint-Wert.
  Tablet as TabletIcon,
  Timer,
  Webhook,
  type LucideIcon,
} from "lucide-react";

import {
  toastCleared,
  toastEdited,
  toastWarning,
} from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { SegmentedPicker } from "@/components/segmented-picker";
import { SwitchRow } from "@/components/switch-row";
import { TemplateSettingsFields } from "@/components/template-settings-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { LogoUploadField } from "@/components/logo-upload-field";
import { NotificationSettingsCard } from "@/components/notification-settings-card";
import { SettingsProtocolCard } from "@/components/settings-protocol-card";
import { SettingsExportCard } from "@/components/settings-export-card";
import { WebhookDialog } from "@/components/webhook-dialog";
import { WebhookFailureBanner } from "@/components/webhook-failure-banner";
import { WebhooksManager } from "@/components/webhooks-manager";
import { SettingsServicesCard } from "@/components/settings-services-card";
import { MaintenancePageCard } from "@/components/maintenance-page-card";
import { MasterClientCard } from "@/components/master-client-card";
import { ModuleSettingsCard } from "@/components/module-settings-card";
import { ScheduledJobsCard } from "@/components/scheduled-jobs-card";
import { RecentJobRunsCard } from "@/components/recent-job-runs-card";
import { JobRunRetentionCard } from "@/components/job-run-retention-card";
import { ActivityLogRetentionCard } from "@/components/activity-log-retention-card";
import { MailingSettingsCard } from "@/components/mailing-settings-card";
import { PaginationControls } from "@/components/pagination-controls";
import { cn } from "@/lib/utils";
import { bff } from "@/lib/bff";
import type { TemplateSettingsValues } from "@pivot/blocks";
import type {
  AppSettings,
  JobRunsResponse,
  LicenseState,
  MailShellListItem,
  MailTemplateListItem,
  JobRunStatusFilter,
  ModuleSettingsEntry,
  NavigationSummary,
  ScheduledJobsResponse,
  SettingsChangesResponse,
  SmtpSettings,
  WebhookListResponse,
  WebsiteListResponse,
  WebsiteStatsHistoryResponse,
} from "@/lib/api-server";

// Feste Akzentfarben-Auswahl (1:1 nach Bildvorlage) + freier Farbwähler
// (Nutzervorgabe, 2026-08-17). Lime ist die bestehende Markenfarbe – ein
// Klick darauf setzt `accentColor` zurück auf `null` (Standard) statt den
// Hex-Wert explizit zu speichern.
// Farbvorrat für den Akzent, sortiert nach Farbfamilie (Grün → Türkis →
// Blau → Violett → Rot → Orange/Gelb → Neutrale), damit das Raster nicht
// wie eine Zufallsauswahl wirkt.
//
// Die Anzahl ist eine Gestaltungsentscheidung, kein Zufall: 17 Farben plus
// der Knopf für die eigene Farbe ergeben 18 Felder – auf breiten Kacheln
// zwei Reihen, auf schmalen drei. Damit bleibt die Kachel in der Nähe der
// Logo-Kachel daneben, statt sie zu überragen (Nutzervorgabe, 2026-09-03,
// nach einem Zwischenstand mit 32 Farben: "es soll kein riesen kachel mit
// viel leeraum sein"). Wer erweitert, sollte das im Blick behalten.
//
// [0] ist der Standard: wird er gewählt, speichert das Formular `null`
// statt des Hex-Werts (kein Akzent gesetzt = Vorgabe der Anwendung).
// Diese Sonderrolle hängt am Index, die Reihenfolge ist also nicht
// beliebig – Lime bleibt vorn.
const ACCENT_PRESETS = [
  { label: "Lime (Standard)", hex: "#BCE64D" },
  { label: "Grün", hex: "#7BC96F" },
  { label: "Smaragd", hex: "#2FA36B" },
  { label: "Petrol", hex: "#17A2A2" },
  { label: "Türkis", hex: "#3FC7C7" },
  { label: "Himmelblau", hex: "#7FC5F0" },
  { label: "Blau", hex: "#93B7EE" },
  { label: "Kobalt", hex: "#2F5FD0" },
  { label: "Indigo", hex: "#5B6BE1" },
  { label: "Violett", hex: "#9B7BE8" },
  { label: "Magenta", hex: "#D45BB5" },
  { label: "Pink", hex: "#E87BB0" },
  { label: "Rot", hex: "#E4695E" },
  { label: "Orange", hex: "#E8A33D" },
  { label: "Gelb", hex: "#F2CE4B" },
  { label: "Schiefer", hex: "#6B7A8F" },
  { label: "Navy", hex: "#151E2E" },
] as const;

const settingsSchema = z.object({
  allowRegistration: z.boolean(),
  allowPasswordReset: z.boolean(),
  allowEmailChange: z.boolean(),
  allowAdminEmailChange: z.boolean(),
  requireAdminActivation: z.boolean(),
  autosaveEnabled: z.boolean(),
  mediaResponsiveVariantsEnabled: z.boolean(),
  maintenanceModeEnabled: z.boolean(),
  passwordMinLength: z.number().int().min(4).max(128),
  passwordRequireUppercase: z.boolean(),
  passwordRequireLowercase: z.boolean(),
  passwordRequireNumber: z.boolean(),
  passwordRequireSpecialChar: z.boolean(),
  passwordExpiryDays: z.number().int().min(1).nullable(),
  failedLoginLockoutThreshold: z.number().int().min(1).nullable(),
  passwordBlockLeaked: z.boolean(),
  passwordPreventReuseEnabled: z.boolean(),
  allowTwoFactor: z.boolean(),
  requireTwoFactorForAdmins: z.boolean(),
  requireTwoFactorForAll: z.boolean(),
  requireTwoFactorForPublishers: z.boolean(),
  sessionIdleTimeoutMinutes: z.number().int().min(1).nullable(),
  accentColor: z.string().nullable(),
  tableDensity: z.enum(["compact", "normal", "airy"]),
  sidebarCollapsedByDefault: z.boolean(),
  keyboardShortcutsEnabled: z.boolean(),
  reduceMotion: z.boolean(),
  defaultPageSize: z.number().int().min(1).max(100),
  // Schwellen der Zählerstand-Plausibilitätsprüfung (2026-09-01) – Grenzen
  // wie im Backend-DTO: 0 % würde jede unveränderte Meldung als Einbruch
  // werten, 100 % nur einen Sturz auf exakt null erfassen.
  statsAnomalyRelativeDropPercent: z.number().int().min(1).max(99),
  statsAnomalyAbsoluteDrop: z.number().int().min(1),
  siteTitle: z.string().nullable(),
  siteTagline: z.string().nullable(),
  defaultSeoDescription: z.string().nullable(),
  publicBaseUrl: z.string().nullable(),
  mainNavigationId: z.string().nullable(),
  backendCacheEnabled: z.boolean(),
  backendCacheTtlSeconds: z.number(),
  frontendCacheEnabled: z.boolean(),
  frontendCacheTtlSeconds: z.number(),
  footerNavigationPrimaryId: z.string().nullable(),
  footerNavigationSecondaryId: z.string().nullable(),
  pageSpacingTopMobile: z.number().int().min(0).max(1000).nullable(),
  pageSpacingBottomMobile: z.number().int().min(0).max(1000).nullable(),
  pageSpacingTopTablet: z.number().int().min(0).max(1000).nullable(),
  pageSpacingBottomTablet: z.number().int().min(0).max(1000).nullable(),
  pageSpacingTopDesktop: z.number().int().min(0).max(1000).nullable(),
  pageSpacingBottomDesktop: z.number().int().min(0).max(1000).nullable(),
  pageSpacingOnHomepage: z.boolean(),
  // Bewusst ungeprüft: welche Schlüssel es gibt, weiß nur das Manifest des
  // Templates (siehe TemplateSettingsFields) – eine Prüfung hier wäre eine
  // zweite, immer veraltete Wahrheit.
  templateSettings: z.record(z.string(), z.unknown()).nullable(),
  footerNote: z.string().nullable(),
});

/** Die drei Stufen des globalen Seitenabstands. Der Wert ist zugleich das
 * Namensfragment der sechs Formularfelder (`pageSpacingTop{Mobile}` …),
 * deshalb englisch und großgeschrieben. */
const PAGE_SPACING_TABS = [
  { value: "Mobile" as const, label: "Mobil", icon: Smartphone },
  { value: "Tablet" as const, label: "Tablet", icon: TabletIcon },
  { value: "Desktop" as const, label: "Desktop", icon: Monitor },
];

/** Globaler Abstand oben/unten für ALLE Seiten der öffentlichen Webseite
 * (Nutzervorgabe, 2026-09-03: "soll global gesetzt werden für alle
 * seiten").
 *
 * Bedienung bewusst 1:1 wie im Menüpunkt-Dialog und im Abstände-Dialog des
 * Designers – dieselbe Sache soll sich überall gleich anfühlen. Der
 * Unterschied liegt nur in der Reichweite: hier alle Seiten, dort eine.
 * Ein Wert am Menüpunkt sticht den globalen, Wert für Wert. */
function PageSpacingFields({ control }: { control: Control<SettingsValues> }) {
  const [tab, setTab] =
    useState<(typeof PAGE_SPACING_TABS)[number]["value"]>("Mobile");
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <Label>Abstand der Seite</Label>
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        {PAGE_SPACING_TABS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.value}
              type="button"
              onClick={() => setTab(entry.value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                tab === entry.value
                  ? "border-primary bg-card shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {entry.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {(["Top", "Bottom"] as const).map((side) => (
          <FormField
            key={side}
            control={control}
            name={`pageSpacing${side}${tab}` as const}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2">
                <Label
                  htmlFor={`pageSpacing${side}${tab}`}
                  className="text-sm font-normal text-muted-foreground"
                >
                  {side === "Top" ? "Oben" : "Unten"}
                </Label>
                <FormControl>
                  <Input
                    id={`pageSpacing${side}${tab}`}
                    type="number"
                    min={0}
                    max={1000}
                    placeholder="–"
                    className="h-9 w-20 px-2 text-center text-sm"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      // Leeres Feld heißt "kein globaler Wert" – das ist
                      // etwas anderes als 0 (bündig unter der Kopfzeile),
                      // deshalb null statt einer stillen Umwandlung.
                      const next = Number(e.target.value);
                      field.onChange(
                        e.target.value === "" || !Number.isFinite(next)
                          ? null
                          : next,
                      );
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        ))}
        <span className="text-sm text-muted-foreground">px</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Luft über und unter jeder Seite der Webseite. Leer heißt: Vorgabe des
        Templates – jede Stufe erbt dann die nächstkleinere. Tablet greift ab
        768px, Desktop ab 1024px Bildschirmbreite. Ein am Menüpunkt gesetzter
        Abstand hat Vorrang.
      </p>
    </div>
  );
}

// Exportiert, damit MasterClientCard das Formular typsicher entgegennehmen
// kann (die Zählerstand-Schwellen liegen im selben Formular, siehe dort).
export type SettingsValues = z.infer<typeof settingsSchema>;

type SectionId =
  | "access"
  | "security"
  | "display"
  | "frontend-basics"
  | "frontend-display"
  | "frontend-navigation"
  | "integrations"
  | "webhooks"
  | "notifications"
  | "master-client"
  | "module"
  | "maintenance-page"
  | "caching"
  | "jobs"
  | "mailing"
  | "protocol";

const SECTIONS: {
  id: SectionId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Nur auf einer Master-Installation sinnvoll. Seit 2026-09-03 auf
   * BEREICHS- statt Gruppenebene: die Gruppe "Administration" enthält
   * seitdem auch Benachrichtigungen und Protokoll, und die dürfen auf
   * einer Client-Installation nicht mit verschwinden. */
  masterOnly?: boolean;
}[] = [
  {
    id: "master-client",
    title: "Master-Client",
    subtitle: "Mandanten & Modus",
    icon: ShieldCheck,
  },
  {
    id: "module",
    title: "Module",
    subtitle: "Freischaltung & Reiter",
    icon: Blocks,
    masterOnly: true,
  },
  {
    id: "access",
    title: "Zugriff & Funktionen",
    subtitle: "Module ein- und ausschalten",
    icon: Menu,
  },
  {
    id: "security",
    title: "Sicherheit",
    subtitle: "Passwörter, 2FA, Sitzungen",
    icon: Shield,
  },
  {
    id: "notifications",
    title: "Benachrichtigungen",
    subtitle: "Systembenachrichtigungen",
    icon: Bell,
  },
  {
    // "Backend" im Titel seit 2026-09-05 (Nutzervorgabe): seit Frontend
    // ein eigener Oberpunkt mit einem Bereich "Darstellung" ist, gäbe es
    // die Beschriftung sonst zweimal in derselben Sidebar – einmal für
    // die Verwaltung, einmal für die öffentliche Webseite.
    id: "display",
    title: "Darstellung Backend",
    subtitle: "Logo, Akzentfarbe, Dichte",
    icon: Contrast,
  },
  {
    // Seit 2026-09-05 drei Bereiche statt eines: die eine Frontend-Karte
    // war auf über zehn Felder gewachsen (Nutzervorgabe: "das frontend
    // will ich als eigenen punkt haben. also als oberpunkt", dann die
    // Entscheidung für Unterpunkte).
    id: "frontend-basics",
    title: "Grundlagen & SEO",
    subtitle: "Titel, Favicon, Metadaten",
    icon: Globe,
  },
  {
    id: "frontend-display",
    title: "Darstellung",
    subtitle: "Abstand der Seite",
    icon: Ruler,
  },
  {
    id: "frontend-navigation",
    title: "Kopf- & Fußbereich",
    subtitle: "Menüs & Footer-Zeile",
    icon: PanelTop,
  },
  {
    id: "integrations",
    title: "Integrationen",
    subtitle: "API-Schlüssel, Dienste",
    icon: Plug,
  },
  {
    id: "mailing",
    title: "Mailing",
    subtitle: "Mailvorlagen & Versand",
    icon: Mail,
  },
  {
    id: "webhooks",
    title: "Webhooks",
    subtitle: "Automatisierte Events",
    icon: Webhook,
  },
  {
    id: "maintenance-page",
    title: "Wartungsseite",
    subtitle: "Inhalt bei Sperrung",
    icon: Construction,
  },
  {
    id: "caching",
    title: "Caching",
    subtitle: "Zwischenspeicher",
    icon: DatabaseZap,
  },
  {
    id: "jobs",
    title: "Jobs",
    subtitle: "Geplante Aufgaben",
    icon: Timer,
  },
  {
    id: "protocol",
    title: "Protokoll",
    subtitle: "Änderungen & Export",
    icon: History,
  },
];

const SECTIONS_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));

// Zweistufige Einstellungen-Navigation (Nutzervorgabe, 2026-08-31, 1:1
// nach Bildvorlage): 1. Ebene = Themengruppen, 2. Ebene = die bisherigen
// `SECTIONS`-Einträge, gruppiert. "Master-Client" bleibt bewusst bei
// "Verbindungen" statt bei "Administration" – im Gegensatz zu "Module"
// ist dieser Bereich NICHT `masterOnly` (zeigt auf einer Slave-
// Installation den Lizenz-/API-Key-Status statt der Mandantenliste,
// bleibt also für beide Modi sichtbar).
/** Feste Vorgaben statt eines freien Zahlenfelds – dieselbe Konvention wie
 * bei den Aufbewahrungsfristen (siehe SegmentedPicker). */
const BACKEND_CACHE_TTL_OPTIONS = [
  { value: 10, label: "10 Sekunden" },
  { value: 30, label: "30 Sekunden" },
  { value: 60, label: "1 Minute" },
  { value: 300, label: "5 Minuten" },
];

/** Seit der ereignisgesteuerten Invalidierung (2026-09-03) ist dieser Wert
 * NICHT mehr der Weg, auf dem Änderungen sichtbar werden – das erledigen
 * die Auslöser sofort. Er ist nur noch das Sicherheitsnetz für den Fall,
 * dass ein Auslöser ausgefallen ist.
 *
 * Deshalb sind die Minutenwerte gefallen (Nutzervorgabe: "1 und 5 minute
 * kann weg"): unterhalb einer Stunde bringt ein Netz nichts, was die
 * Auslöser nicht schon getan hätten. Woche und Monat standen kurz zur
 * Debatte und sind bewusst wieder raus (Nutzerentscheidung, 2026-09-03):
 * je länger der Wert, desto länger bliebe eine Seite falsch, wenn ein
 * Auslöser einmal nicht durchkommt – ein Netz mit einem Monat Maschenweite
 * ist keins mehr. */
const FRONTEND_CACHE_TTL_OPTIONS = [
  { value: 900, label: "15 Minuten" },
  { value: 1800, label: "30 Minuten" },
  { value: 3600, label: "1 Stunde" },
  { value: 86400, label: "1 Tag" },
];

const GROUPS: {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  sections: SectionId[];
  // Ein früheres `masterOnly` auf Gruppenebene ist 2026-09-03 entfallen:
  // die Beschränkung sitzt jetzt am einzelnen Bereich (siehe SECTIONS),
  // und eine Gruppe verschwindet automatisch, sobald kein Bereich von ihr
  // übrig bleibt. Zwei Mechanismen für dieselbe Sache wären eine
  // Fehlerquelle gewesen.
}[] = [
  {
    id: "general",
    title: "Allgemein",
    subtitle: "Module & Darstellung",
    icon: Menu,
    // Wartungsseite seit 2026-09-05 hier statt in einer eigenen Gruppe
    // "Betrieb" (Nutzervorgabe): die Gruppe hatte nur diesen einen Bereich
    // und stand damit gleichwertig neben Sicherheit und Verbindungen.
    sections: ["access", "display", "maintenance-page"],
  },
  {
    // Eigener Oberpunkt statt eines Bereichs unter "Allgemein"
    // (Nutzervorgabe, 2026-09-05). Anders als Caching/Jobs/Mailing MIT
    // zweiter Sidebar-Ebene: die öffentliche Webseite hat genug
    // Einstellungen für drei Bereiche, und sie wächst weiter.
    id: "frontend",
    title: "Frontend",
    subtitle: "Öffentliche Webseite",
    icon: Globe,
    sections: ["frontend-basics", "frontend-display", "frontend-navigation"],
  },
  {
    id: "security",
    title: "Sicherheit",
    subtitle: "Zugang & Vorgaben",
    icon: Shield,
    sections: ["security"],
  },
  {
    id: "connections",
    title: "Verbindungen",
    subtitle: "Dienste & Automatisierung",
    icon: Plug,
    sections: ["integrations", "webhooks", "master-client"],
  },
  {
    // Eigene Gruppe statt eines Bereichs unter "Verbindungen"
    // (Nutzerentscheidung, 2026-08-31). Bewusst mit nur EINEM Bereich:
    // Vorlagen und E-Mail-Templates bleiben Reiter innerhalb der Karte,
    // eine zweite Sidebar-Ebene soll es bei Mailing nicht geben.
    id: "mailing",
    title: "Mailing",
    subtitle: "Vorlagen & Templates",
    icon: Mail,
    sections: ["mailing"],
  },
  {
    // Eigener Oberpunkt statt eines Bereichs unter "Betrieb"
    // (Nutzerentscheidung, 2026-09-03) – wie Mailing und Jobs mit nur
    // EINEM Bereich und damit ohne zweite Sidebar-Ebene, siehe
    // showSectionColumn.
    id: "caching",
    title: "Caching",
    subtitle: "Zwischenspeicher",
    icon: DatabaseZap,
    sections: ["caching"],
  },
  {
    // Wie Mailing eine eigene Gruppe mit nur einem Bereich
    // (Nutzervorgabe, 2026-08-31) – dadurch ohne zweite Sidebar-Ebene,
    // siehe showSectionColumn.
    id: "jobs",
    title: "Jobs",
    subtitle: "Geplante Aufgaben",
    icon: Timer,
    sections: ["jobs"],
  },
  {
    id: "administration",
    title: "Administration",
    subtitle: "Module, Meldungen & Protokoll",
    icon: ShieldCheck,
    sections: ["module", "notifications", "protocol"],
  },
];

/** Einheitliche Platzhalter-Karte für Bereiche ohne echte Funktion dahinter
 * (gleiche Konvention wie die Darstellung-/Benachrichtigungen-Tabs auf
 * "Mein Konto") – kein erfundener Inhalt, nur ein ehrlicher Hinweis. */
function PlaceholderCard({ title, note }: { title: string; note: string }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

/** Auswahl einer `Navigation` für Header bzw. Footer der öffentlichen
 * Website (Nutzerentscheidung, 2026-09-02).
 *
 * "Kein Menü" ist ein echter Wert und braucht deshalb einen Platzhalter-
 * Schlüssel: Base UI behandelt den leeren String als "nichts ausgewählt"
 * und würde die Auswahl nicht anzeigen. Nach außen bleibt es `null`. */
const NO_NAVIGATION = "__keine__";

function NavigationSelectField({
  control,
  name,
  label,
  description,
  navigations,
}: {
  control: Control<SettingsValues>;
  name:
    | "mainNavigationId"
    | "footerNavigationPrimaryId"
    | "footerNavigationSecondaryId";
  label: string;
  description: string;
  navigations: NavigationSummary[];
}) {
  const items = {
    [NO_NAVIGATION]: "Kein Menü",
    ...Object.fromEntries(navigations.map((nav) => [nav.id, nav.name])),
  };
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1.5">
          <Label htmlFor={name}>{label}</Label>
          <FormControl>
            <Select
              value={field.value ?? NO_NAVIGATION}
              onValueChange={(value) =>
                field.onChange(value === NO_NAVIGATION ? null : value)
              }
              items={items}
            >
              <SelectTrigger id={name} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_NAVIGATION}>Kein Menü</SelectItem>
                {navigations.map((nav) => (
                  <SelectItem key={nav.id} value={nav.id}>
                    {nav.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <p className="text-sm text-muted-foreground">{description}</p>
        </FormItem>
      )}
    />
  );
}

export function SettingsForm({
  settings,
  navigations,
  logoFolderId,
  webhooks,
  settingsChanges,
  smtp,
  jobs,
  jobRuns,
  jobRunsStatus,
  mailTemplates,
  mailShells,
  websites,
  statsHistory,
  moduleSettings,
  licenseState,
}: {
  settings: AppSettings;
  /** Auswahl für Hauptmenü und die beiden Footer-Spalten der Website. */
  navigations: NavigationSummary[];
  logoFolderId: string | null;
  webhooks: WebhookListResponse | null;
  settingsChanges: SettingsChangesResponse | null;
  smtp: SmtpSettings;
  jobs: ScheduledJobsResponse;
  jobRuns: JobRunsResponse;
  /** Aktiver Reiter der "Letzte Läufe"-Karte (`?jobsRunsStatus=`). */
  jobRunsStatus?: JobRunStatusFilter;
  mailTemplates: MailTemplateListItem[];
  mailShells: MailShellListItem[];
  websites: WebsiteListResponse;
  /** Gleiche Liste wie `websites`, aber mit eigener Seite – die Karte
   * "Gemeldete Zählerstände" blättert unabhängig von "Mandanten". */
  statsHistory: WebsiteStatsHistoryResponse;
  moduleSettings: ModuleSettingsEntry[] | null;
  /** Für den Warnhinweis auf einer Client-Installation, deren Schlüssel
   * beim letzten Versuch abgelehnt wurde (2026-09-02). */
  licenseState: LicenseState | null;
}) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionId>("access");
  const activeGroup =
    GROUPS.find((group) => group.sections.includes(activeSection)) ?? GROUPS[0];
  // Bereiche, die auf DIESER Installation überhaupt existieren. Seit
  // 2026-09-03 hängt das am Bereich, nicht mehr an der Gruppe (siehe
  // masterOnly in SECTIONS) – "Administration" enthält jetzt auch
  // Benachrichtigungen und Protokoll, die es auf einem Client genauso
  // geben muss.
  const visibleSections = (group: (typeof GROUPS)[number]) =>
    group.sections.filter(
      (id) =>
        !SECTIONS_BY_ID.get(id)?.masterOnly ||
        settings.deploymentMode === "master",
    );
  // Gruppen mit nur einem Bereich bekommen keine zweite Sidebar-Ebene
  // (Nutzervorgabe, 2026-08-31, am Beispiel Mailing): eine Spalte mit
  // einem einzigen Eintrag wiederholt nur den Gruppennamen.
  const showSectionColumn = visibleSections(activeGroup).length > 1;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultMediaStorageQuotaMb =
    settings.mediaStorageQuotaMb != null
      ? String(settings.mediaStorageQuotaMb)
      : "";

  const [mediaStorageQuotaMb, setMediaStorageQuotaMb] = useState(
    defaultMediaStorageQuotaMb,
  );

  const defaultMaxUploadSizeMb =
    settings.maxUploadSizeMb != null ? String(settings.maxUploadSizeMb) : "";
  const [maxUploadSizeMb, setMaxUploadSizeMb] = useState(
    defaultMaxUploadSizeMb,
  );
  const [isClearingCache, setIsClearingCache] = useState(false);

  async function handleClearCache() {
    setIsClearingCache(true);
    try {
      await fetch(bff("/api/settings/clear-cache"), { method: "POST" });
      toastCleared("Der Backend-Cache wurde geleert.");
    } finally {
      setIsClearingCache(false);
    }
  }

  const [isClearingFrontendCache, setIsClearingFrontendCache] = useState(false);
  async function handleClearFrontendCache() {
    setIsClearingFrontendCache(true);
    try {
      const res = await fetch(bff("/api/settings/clear-frontend-cache"), {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toastWarning(
          body?.message ?? "Frontend-Cache konnte nicht geleert werden.",
        );
        return;
      }
      toastCleared("Der Frontend-Cache wurde geleert.");
    } catch {
      toastWarning("Webseite nicht erreichbar.");
    } finally {
      setIsClearingFrontendCache(false);
    }
  }

  const [isRevokingAllSessions, setIsRevokingAllSessions] = useState(false);
  async function handleRevokeAllSessions() {
    setIsRevokingAllSessions(true);
    try {
      const res = await fetch(bff("/api/settings/revoke-all-sessions"), {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      // "Alle Sitzungen beenden" widerruft auch den eigenen Refresh-Token
      // (die Abfrage kennt keine Ausnahme für die aktuelle Sitzung) – ohne
      // eigenen Logout blieb man dank des noch gültigen Access-Tokens bis
      // zu 15 Minuten weiter angemeldet (Nutzer-Bugreport, 2026-08-22:
      // "alle sitzungen beenden funktioniert nicht. ich bin immer noch
      // angemeldet"). Gleiches Muster wie change-password-form.tsx.
      await fetch(bff("/api/auth/logout"), { method: "POST" });
      toastEdited(
        `Alle Sitzungen wurden beendet${data?.count != null ? ` (${data.count})` : ""}. Du wirst abgemeldet.`,
      );
      router.push("/login");
      router.refresh();
    } finally {
      setIsRevokingAllSessions(false);
    }
  }

  const [isForcingPasswordResetAll, setIsForcingPasswordResetAll] =
    useState(false);
  async function handleForcePasswordResetAll() {
    setIsForcingPasswordResetAll(true);
    try {
      const res = await fetch(bff("/api/settings/force-password-reset-all"), {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      toastEdited(
        `Passwort-Reset wurde für alle Konten erzwungen${data?.count != null ? ` (${data.count})` : ""}.`,
      );
    } finally {
      setIsForcingPasswordResetAll(false);
    }
  }

  const defaultValues: SettingsValues = {
    allowRegistration: settings.allowRegistration,
    allowPasswordReset: settings.allowPasswordReset,
    allowEmailChange: settings.allowEmailChange,
    allowAdminEmailChange: settings.allowAdminEmailChange,
    requireAdminActivation: settings.requireAdminActivation,
    autosaveEnabled: settings.autosaveEnabled,
    mediaResponsiveVariantsEnabled: settings.mediaResponsiveVariantsEnabled,
    maintenanceModeEnabled: settings.maintenanceModeEnabled,
    passwordMinLength: settings.passwordMinLength,
    passwordRequireUppercase: settings.passwordRequireUppercase,
    passwordRequireLowercase: settings.passwordRequireLowercase,
    passwordRequireNumber: settings.passwordRequireNumber,
    passwordRequireSpecialChar: settings.passwordRequireSpecialChar,
    passwordExpiryDays: settings.passwordExpiryDays,
    failedLoginLockoutThreshold: settings.failedLoginLockoutThreshold,
    passwordBlockLeaked: settings.passwordBlockLeaked,
    passwordPreventReuseEnabled: settings.passwordPreventReuseEnabled,
    allowTwoFactor: settings.allowTwoFactor,
    requireTwoFactorForAdmins: settings.requireTwoFactorForAdmins,
    requireTwoFactorForAll: settings.requireTwoFactorForAll,
    requireTwoFactorForPublishers: settings.requireTwoFactorForPublishers,
    sessionIdleTimeoutMinutes: settings.sessionIdleTimeoutMinutes,
    accentColor: settings.accentColor,
    tableDensity: settings.tableDensity as "compact" | "normal" | "airy",
    sidebarCollapsedByDefault: settings.sidebarCollapsedByDefault,
    keyboardShortcutsEnabled: settings.keyboardShortcutsEnabled,
    reduceMotion: settings.reduceMotion,
    defaultPageSize: settings.defaultPageSize,
    statsAnomalyRelativeDropPercent: settings.statsAnomalyRelativeDropPercent,
    statsAnomalyAbsoluteDrop: settings.statsAnomalyAbsoluteDrop,
    siteTitle: settings.siteTitle,
    siteTagline: settings.siteTagline,
    defaultSeoDescription: settings.defaultSeoDescription,
    publicBaseUrl: settings.publicBaseUrl,
    mainNavigationId: settings.mainNavigationId,
    backendCacheEnabled: settings.backendCacheEnabled,
    backendCacheTtlSeconds: settings.backendCacheTtlSeconds,
    frontendCacheEnabled: settings.frontendCacheEnabled,
    frontendCacheTtlSeconds: settings.frontendCacheTtlSeconds,
    footerNavigationPrimaryId: settings.footerNavigationPrimaryId,
    footerNavigationSecondaryId: settings.footerNavigationSecondaryId,
    pageSpacingTopMobile: settings.pageSpacingTopMobile,
    pageSpacingBottomMobile: settings.pageSpacingBottomMobile,
    pageSpacingTopTablet: settings.pageSpacingTopTablet,
    pageSpacingBottomTablet: settings.pageSpacingBottomTablet,
    pageSpacingTopDesktop: settings.pageSpacingTopDesktop,
    pageSpacingBottomDesktop: settings.pageSpacingBottomDesktop,
    pageSpacingOnHomepage: settings.pageSpacingOnHomepage,
    templateSettings: settings.templateSettings,
    footerNote: settings.footerNote,
  };

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  function handleDiscard() {
    form.reset(defaultValues);
    setMediaStorageQuotaMb(defaultMediaStorageQuotaMb);
    setMaxUploadSizeMb(defaultMaxUploadSizeMb);
    setError(null);
  }

  async function onSubmit(values: SettingsValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(bff("/api/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          mediaStorageQuotaMb: mediaStorageQuotaMb.trim()
            ? Number(mediaStorageQuotaMb)
            : null,
          maxUploadSizeMb: maxUploadSizeMb.trim()
            ? Number(maxUploadSizeMb)
            : null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.message ?? "Einstellungen konnten nicht gespeichert werden.",
        );
        return;
      }

      toastEdited("Die Einstellungen wurden gespeichert.");
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
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Einstellungen
            </h1>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichert…" : "Speichern"}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="w-full self-start overflow-hidden rounded-xl bg-card shadow-sm lg:flex xl:w-auto xl:shrink-0">
            <div
              className={cn(
                "relative z-10 flex flex-col lg:shrink-0 xl:w-60",
                showSectionColumn &&
                  "lg:w-1/2 lg:border-r lg:border-border lg:shadow-[5px_0_14px_-9px_rgba(0,0,0,0.10)]",
              )}
            >
              <div className="flex flex-col divide-y divide-border">
                {GROUPS.filter(
                  (group) => visibleSections(group).length > 0,
                ).map((group) => {
                  const isActive = group.id === activeGroup.id;
                  const Icon = group.icon;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() =>
                        setActiveSection(
                          visibleSections(group)[0] ?? group.sections[0],
                        )
                      }
                      className={cn(
                        "flex items-start gap-3 border-l-4 px-4 py-4 text-left transition-colors",
                        isActive
                          ? "border-l-primary bg-primary/15"
                          : "border-l-transparent hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          isActive
                            ? "bg-primary/25 text-foreground"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5 break-words">
                        <span className="text-sm font-semibold">
                          {group.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {group.subtitle}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {showSectionColumn && (
              <div className="flex flex-col border-t border-border lg:w-1/2 lg:shrink-0 lg:border-t-0 xl:w-68">
                <div className="px-4 py-3">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {activeGroup.title}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-border">
                  {visibleSections(activeGroup).map((sectionId) => {
                    const section = SECTIONS_BY_ID.get(sectionId)!;
                    const isActive = sectionId === activeSection;
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          "flex items-start gap-3 px-4 py-4 text-left transition-colors",
                          isActive ? "bg-primary/15" : "hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            isActive
                              ? "bg-primary/25 text-foreground"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5 break-words">
                          <span className="text-sm font-semibold">
                            {section.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {section.subtitle}
                          </span>
                        </span>
                        {isActive && (
                          <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {activeSection === "access" && (
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Zugriff & Funktionen</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Steuert, welche Selbstbedienungs-Funktionen verfügbar sind.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
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
                          label="Benutzer können E-Mail-Adresse anpassen"
                          description="Gilt für alle Rollen außer Administrator, Manager und Pivot. Manager können ihre E-Mail-Adresse nie selbst ändern."
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allowAdminEmailChange"
                    render={({ field }) => (
                      <FormItem>
                        <SwitchRow
                          label="Administratoren können E-Mail-Adresse anpassen"
                          description="Gilt nur für die Rolle Administrator. Pivot kann die E-Mail-Adresse immer ändern, unabhängig von diesem Schalter."
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
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="mediaStorageQuotaMb" className="text-sm">
                        Medien-Speicherkontingent (MB)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Ab 90 % Auslastung erscheint ein Hinweis im Dashboard.
                        Leer lassen für unbegrenzt.
                      </p>
                    </div>
                    <Input
                      id="mediaStorageQuotaMb"
                      type="number"
                      min={1}
                      className="w-32"
                      value={mediaStorageQuotaMb}
                      onChange={(e) => setMediaStorageQuotaMb(e.target.value)}
                      placeholder="Unbegrenzt"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="maxUploadSizeMb" className="text-sm">
                        Maximale Dateigröße pro Upload (MB)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Gilt für jeden Upload (Medien, Profilbild, Firmenlogo).
                        Verschärft nur die technischen Kategorie-Obergrenzen,
                        hebt sie nie auf. Leer lassen für keine zusätzliche
                        Grenze.
                      </p>
                    </div>
                    <Input
                      id="maxUploadSizeMb"
                      type="number"
                      min={1}
                      className="w-32"
                      value={maxUploadSizeMb}
                      onChange={(e) => setMaxUploadSizeMb(e.target.value)}
                      placeholder="Unbegrenzt"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === "caching" && (
              <div className="flex flex-col gap-4">
                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Backend-Cache</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Hält häufig wiederholte Abfragen kurz im Arbeitsspeicher
                      des Servers – aktuell die Zähler für die
                      Systembenachrichtigungen, die bei jedem Seitenwechsel neu
                      ermittelt würden. Betrifft nur zwischengespeicherte Werte,
                      niemals gespeicherte Daten.
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <FormField
                      control={form.control}
                      name="backendCacheEnabled"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Backend-Cache verwenden"
                            description="Aus = jede Abfrage geht direkt an die Datenbank."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="backendCacheTtlSeconds"
                      render={({ field }) => (
                        <FormItem>
                          <SegmentedPicker
                            label="Wie lange gespeichert wird"
                            options={BACKEND_CACHE_TTL_OPTIONS}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-sm">Jetzt leeren</Label>
                        <p className="text-sm text-muted-foreground">
                          Verwirft alle zwischengespeicherten Werte sofort.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-button-border"
                        disabled={isClearingCache}
                        onClick={handleClearCache}
                      >
                        {isClearingCache ? "Leert…" : "Backend-Cache leeren"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Frontend-Cache</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Wie lange die öffentliche Webseite Antworten der API
                      wiederverwendet, bevor sie neu nachfragt. Eine frisch
                      veröffentlichte Seite wird dadurch erst nach Ablauf dieser
                      Zeit öffentlich sichtbar – oder sofort, wenn Sie hier
                      leeren.
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <FormField
                      control={form.control}
                      name="frontendCacheEnabled"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Frontend-Cache verwenden"
                            description="Aus = die Webseite fragt bei jedem Besucher neu an. Ehrlich, aber deutlich langsamer."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="frontendCacheTtlSeconds"
                      render={({ field }) => (
                        <FormItem className="flex flex-col gap-1.5">
                          <SegmentedPicker
                            label="Wie lange gespeichert wird"
                            options={FRONTEND_CACHE_TTL_OPTIONS}
                            value={field.value}
                            onChange={field.onChange}
                          />
                          <p className="text-sm text-muted-foreground">
                            Kürzer als eine Minute ist nicht wählbar: die Seiten
                            der Webseite sind selbst auf eine Minute
                            eingestellt, und dieser Wert steht dort fest im
                            Code. Ein kleinerer Wert hier würde also nichts
                            bewirken.
                          </p>
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
                      <div className="flex flex-col gap-0.5">
                        <Label className="text-sm">Jetzt leeren</Label>
                        <p className="text-sm text-muted-foreground">
                          Verwirft die gesamte zwischengespeicherte Webseite –
                          gerenderte Seiten wie API-Antworten.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-button-border"
                        disabled={isClearingFrontendCache}
                        onClick={handleClearFrontendCache}
                      >
                        {isClearingFrontendCache
                          ? "Leert…"
                          : "Frontend-Cache leeren"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === "security" && (
              <>
                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Passwort-Richtlinie</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Gilt für Registrierung, neue Benutzer, Passwort ändern und
                      Passwort-Reset.
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="passwordMinLength"
                        render={({ field }) => (
                          <FormItem>
                            <SegmentedPicker
                              label="Mindestlänge"
                              value={field.value}
                              onChange={field.onChange}
                              options={[
                                { label: "8", value: 8 },
                                { label: "10", value: 10 },
                                { label: "12", value: 12 },
                                { label: "16", value: 16 },
                              ]}
                            />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="passwordExpiryDays"
                        render={({ field }) => (
                          <FormItem>
                            <SegmentedPicker
                              label="Wechsel nach Tagen"
                              value={field.value}
                              onChange={field.onChange}
                              options={[
                                { label: "90", value: 90 },
                                { label: "180", value: 180 },
                                { label: "365", value: 365 },
                                { label: "nie", value: null },
                              ]}
                            />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="failedLoginLockoutThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <SegmentedPicker
                              label="Sperre nach Fehlversuchen"
                              value={field.value}
                              onChange={field.onChange}
                              options={[
                                { label: "3", value: 3 },
                                { label: "5", value: 5 },
                                { label: "10", value: 10 },
                                { label: "nie", value: null },
                              ]}
                            />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <SwitchRow
                        label="Groß-/Kleinschreibung und Zahl erforderlich"
                        description="Mindestens ein Großbuchstabe, ein Kleinbuchstabe und eine Ziffer."
                        checked={
                          form.watch("passwordRequireUppercase") &&
                          form.watch("passwordRequireLowercase") &&
                          form.watch("passwordRequireNumber")
                        }
                        onCheckedChange={(checked) => {
                          form.setValue("passwordRequireUppercase", checked);
                          form.setValue("passwordRequireLowercase", checked);
                          form.setValue("passwordRequireNumber", checked);
                        }}
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
                      <FormField
                        control={form.control}
                        name="passwordBlockLeaked"
                        render={({ field }) => (
                          <FormItem>
                            <SwitchRow
                              label="Bekannte geleakte Passwörter blockieren"
                              description="Prüfung gegen die Have-I-Been-Pwned-Datenbank (k-Anonymität, das Passwort selbst verlässt den Server nie)."
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="passwordPreventReuseEnabled"
                        render={({ field }) => (
                          <FormItem>
                            <SwitchRow
                              label="Letzte 5 Passwörter nicht erneut zulassen"
                              description="Verhindert die Wiederverwendung eines der letzten 5 Passwörter desselben Kontos."
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Anmeldung</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      2FA per Authenticator-App (z.B. Google Authenticator,
                      Authy, Microsoft Authenticator), Sitzungsdauer und globale
                      Konto-Aktionen.
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <FormField
                      control={form.control}
                      name="allowTwoFactor"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="2FA verfügbar machen"
                            description="Schaltet das Feature systemweit ein/aus. Deaktiviert blendet die Einrichtung überall aus und der zweite Faktor wird beim Login nicht mehr abgefragt, auch wenn einzelne Nutzer ihn zuvor eingerichtet hatten."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="requireTwoFactorForAll"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Zwei-Faktor für alle Konten erzwingen"
                            description="Nutzer ohne 2FA werden beim Login zur Einrichtung geführt."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!form.watch("allowTwoFactor")}
                          />
                        </FormItem>
                      )}
                    />
                    <div
                      className={cn(
                        "grid transition-all duration-300 ease-in-out",
                        form.watch("requireTwoFactorForAll")
                          ? "grid-rows-[0fr] opacity-0"
                          : "grid-rows-[1fr] opacity-100",
                      )}
                    >
                      <div className="flex flex-col gap-3 overflow-hidden">
                        <FormField
                          control={form.control}
                          name="requireTwoFactorForPublishers"
                          render={({ field }) => (
                            <FormItem>
                              <SwitchRow
                                label="Zwei-Faktor für Rollen mit Veröffentlichungsrecht"
                                description="Gilt für jede Rolle mit dem Recht, Inhalte zu veröffentlichen."
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!form.watch("allowTwoFactor")}
                              />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="requireTwoFactorForAdmins"
                          render={({ field }) => (
                            <FormItem>
                              <SwitchRow
                                label="Zwei-Faktor für Administratoren erzwingen"
                                description="Administrator- und Pivot-Konten ohne eingerichtete 2FA werden nach dem Login zur Einrichtung gezwungen, bevor sie das Dashboard nutzen können."
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!form.watch("allowTwoFactor")}
                              />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    <FormField
                      control={form.control}
                      name="sessionIdleTimeoutMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Sitzung nach 8 Std. Inaktivität beenden"
                            description="Beendet eine Sitzung automatisch, wenn 8 Stunden lang keine Anfrage mehr einging."
                            checked={field.value != null}
                            onCheckedChange={(checked) =>
                              field.onChange(checked ? 480 : null)
                            }
                          />
                        </FormItem>
                      )}
                    />

                    <div className="mt-1 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row">
                      <ConfirmDeleteDialog
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            className="border-button-border"
                            disabled={isRevokingAllSessions}
                          >
                            {isRevokingAllSessions
                              ? "Beendet…"
                              : "Alle Sitzungen beenden"}
                          </Button>
                        }
                        variant="default"
                        title="Alle Sitzungen beenden?"
                        description="Jeder angemeldete Nutzer (inklusive dir selbst) wird sofort abgemeldet und muss sich neu anmelden."
                        confirmLabel="Beenden"
                        confirmingLabel="Beendet…"
                        onConfirm={handleRevokeAllSessions}
                      />
                      <ConfirmDeleteDialog
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            className="border-button-border text-destructive hover:text-destructive"
                            disabled={isForcingPasswordResetAll}
                          >
                            {isForcingPasswordResetAll
                              ? "Erzwingt…"
                              : "Passwort-Reset für alle erzwingen"}
                          </Button>
                        }
                        title="Passwort-Reset für alle Konten erzwingen?"
                        description="Jeder aktive Nutzer muss beim nächsten Login ein neues Passwort vergeben."
                        confirmLabel="Erzwingen"
                        confirmingLabel="Erzwingt…"
                        onConfirm={handleForcePasswordResetAll}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeSection === "display" && (
              <>
                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Marke</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Wirkt im Backend.
                    </p>
                  </CardHeader>
                  {/* Beide Kacheln nebeneinander sind immer gleich hoch
                      (Nutzervorgabe, 2026-09-03): das Raster streckt seine
                      Zellen ohnehin auf die Zeilenhöhe, die `h-full`/
                      `flex-1`-Kette reicht diese Höhe bis zur eigentlichen
                      Fläche durch – sonst stünde die kürzere Kachel oben in
                      einer zu hohen Zelle. Ab `sm` untereinander, dann ist
                      jede ihre eigene Zeile und behält ihre natürliche
                      Höhe. */}
                  <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex h-full flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Logo
                      </span>
                      <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-muted p-4">
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs text-muted-foreground">
                            Hellmodus
                          </p>
                          <LogoUploadField
                            field="companyLogoUrl"
                            label="Firmenlogo (Hellmodus)"
                            currentUrl={settings.companyLogoUrl}
                            folderId={logoFolderId}
                            previewClassName="dark:bg-[#969696] dark:text-neutral-800"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                          <p className="text-xs text-muted-foreground">
                            Dunkelmodus (optional – ohne eigenes Logo wird
                            nirgends automatisch das Hellmodus-Logo verwendet)
                          </p>
                          <LogoUploadField
                            field="companyLogoUrlDark"
                            label="Firmenlogo (Dunkelmodus)"
                            currentUrl={settings.companyLogoUrlDark}
                            folderId={logoFolderId}
                            previewClassName="bg-neutral-900 text-neutral-400"
                          />
                        </div>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="accentColor"
                      render={({ field }) => {
                        const current = field.value ?? ACCENT_PRESETS[0].hex;
                        const isCustom = !ACCENT_PRESETS.some(
                          (preset) =>
                            preset.hex.toLowerCase() === current.toLowerCase(),
                        );
                        // Grobe Helligkeitsschätzung, nur um das
                        // Paletten-Icon auf der eigenen Farbe lesbar zu
                        // halten (hell → dunkles Icon, dunkel → helles Icon).
                        const r = parseInt(current.slice(1, 3), 16);
                        const g = parseInt(current.slice(3, 5), 16);
                        const b = parseInt(current.slice(5, 7), 16);
                        const isLightCustom =
                          (r * 299 + g * 587 + b * 114) / 1000 > 150;
                        return (
                          // `h-full`/`flex-1` bis nach unten durchgereicht:
                          // die Kachel soll auf dieselbe Höhe wie die
                          // Logo-Kachel daneben kommen, auch wenn die Farben
                          // eine Reihe weniger brauchen.
                          <FormItem className="h-full">
                            <div className="flex h-full flex-col gap-2">
                              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                Akzentfarbe
                              </span>
                              {/* Umbrechendes Raster statt einer Zeile
                                  (Nutzervorgabe, 2026-09-03: "mehrere
                                  reihen, so das die kachel so hoch ist wie
                                  logo") – die Kachel steht neben der
                                  Logo-Kachel und war halb so hoch. */}
                              <div className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-muted p-4">
                                {/* `flex-1` + `content-center`: die Kachel
                                    ist so hoch wie die Logo-Kachel daneben,
                                    die Farbreihen stehen darin senkrecht
                                    mittig statt oben (Nutzervorgabe,
                                    2026-09-03). `content-center` greift, weil
                                    der Container umbricht – bei
                                    `flex-nowrap` bliebe es wirkungslos. */}
                                <div className="flex flex-1 flex-wrap content-center items-center gap-2">
                                  {ACCENT_PRESETS.map((preset) => {
                                    const isSelected =
                                      current.toLowerCase() ===
                                      preset.hex.toLowerCase();
                                    return (
                                      <button
                                        key={preset.hex}
                                        type="button"
                                        aria-label={preset.label}
                                        onClick={() =>
                                          field.onChange(
                                            preset.hex === ACCENT_PRESETS[0].hex
                                              ? null
                                              : preset.hex,
                                          )
                                        }
                                        className={cn(
                                          "size-8 shrink-0 rounded-full ring-2 ring-offset-2 transition-all",
                                          isSelected
                                            ? "ring-foreground"
                                            : "ring-transparent",
                                        )}
                                        style={{ backgroundColor: preset.hex }}
                                      />
                                    );
                                  })}
                                  <label
                                    className={cn(
                                      "relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all",
                                      isCustom
                                        ? cn(
                                            "ring-2 ring-foreground ring-offset-2",
                                            isLightCustom
                                              ? "text-foreground"
                                              : "text-white",
                                          )
                                        : "border border-dashed border-muted-foreground/40 text-muted-foreground",
                                    )}
                                    style={
                                      isCustom
                                        ? { backgroundColor: current }
                                        : undefined
                                    }
                                    title="Eigene Farbe wählen"
                                  >
                                    <Palette className="size-4" />
                                    <input
                                      type="color"
                                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                                      value={current}
                                      onChange={(e) =>
                                        field.onChange(e.target.value)
                                      }
                                    />
                                  </label>
                                </div>
                                <span className="ml-auto shrink-0 font-mono text-sm text-muted-foreground">
                                  {current.toLowerCase()}
                                </span>
                              </div>
                            </div>
                          </FormItem>
                        );
                      }}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <CardTitle>Oberfläche</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Gilt für alle Nutzer im Dashboard.
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <FormField
                      control={form.control}
                      name="tableDensity"
                      render={({ field }) => (
                        <FormItem>
                          <SegmentedPicker
                            label="Tabellendichte"
                            value={field.value}
                            onChange={field.onChange}
                            options={[
                              { label: "Kompakt", value: "compact" },
                              { label: "Normal", value: "normal" },
                              { label: "Luftig", value: "airy" },
                            ]}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="defaultPageSize"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted p-4">
                            <Label
                              htmlFor="defaultPageSize"
                              className="text-sm"
                            >
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
                    <FormField
                      control={form.control}
                      name="sidebarCollapsedByDefault"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Seitenleiste eingeklappt starten"
                            description="Gilt nur, solange der Nutzer die Seitenleiste noch nicht selbst umgeschaltet hat."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="keyboardShortcutsEnabled"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Tastaturkürzel aktiv"
                            description="Strg/Cmd+K öffnet die Befehlspalette."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="reduceMotion"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Bewegungen reduzieren"
                            description="Deaktiviert Übergänge und Animationen im Dashboard."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </>
            )}

            {activeSection === "frontend-basics" && (
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Grundlagen &amp; SEO</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Wie sich die öffentliche Webseite dieser Installation nennt
                    und wie sie in Suchmaschinen und sozialen Netzen erscheint.
                  </p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="siteTitle"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1.5">
                        <Label htmlFor="siteTitle">Webseiten-Titel</Label>
                        <FormControl>
                          <Input
                            id="siteTitle"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || null)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="siteTagline"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1.5">
                        <Label htmlFor="siteTagline">
                          Webseiten-Untertitel
                        </Label>
                        <FormControl>
                          <Input
                            id="siteTagline"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || null)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-col gap-1.5">
                    <Label>Favicon</Label>
                    <LogoUploadField
                      field="faviconUrl"
                      label="Favicon"
                      currentUrl={settings.faviconUrl}
                      folderId={logoFolderId}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Standard-Social-Media-Bild</Label>
                    <LogoUploadField
                      field="defaultOgImageUrl"
                      label="Standard-Social-Media-Bild"
                      currentUrl={settings.defaultOgImageUrl}
                      folderId={logoFolderId}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="publicBaseUrl"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label htmlFor="publicBaseUrl">
                          Basis-URL der Webseite
                        </Label>
                        <FormControl>
                          <Input
                            id="publicBaseUrl"
                            placeholder="https://www.example.de"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || null)
                            }
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Grundlage für die Sitemap und die kanonische URL von
                          Inhalten ohne eigene Angabe.
                        </p>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="defaultSeoDescription"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label htmlFor="defaultSeoDescription">
                          Standard-SEO-Beschreibung
                        </Label>
                        <FormControl>
                          <Textarea
                            id="defaultSeoDescription"
                            rows={3}
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || null)
                            }
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Wird verwendet, wenn eine Seite keine eigene
                          SEO-Beschreibung hat.
                        </p>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {activeSection === "frontend-display" && (
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Darstellung</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Gilt für alle Seiten der öffentlichen Webseite. Einzelne
                    Seiten können davon abweichen – der Wert am Menüpunkt sticht
                    den globalen.
                  </p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PageSpacingFields control={form.control} />
                  <FormField
                    control={form.control}
                    name="pageSpacingOnHomepage"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <SwitchRow
                          label="Auch auf der Startseite anwenden"
                          description="Aus, wenn die Startseite mit einem randlosen Aufmacher beginnt, der bündig unter der Kopfzeile sitzen soll. Ein am Startseiten-Menüpunkt gesetzter Abstand bleibt davon unberührt."
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormItem>
                    )}
                  />
                  <Separator className="sm:col-span-2" />
                  {/* Ab hier bestimmt das Template, was zu sehen ist – die
                      Felder kommen aus seinem Manifest, nicht aus diesem
                      Code (Nutzerentscheidung, 2026-09-05). */}
                  <FormField
                    control={form.control}
                    name="templateSettings"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <TemplateSettingsFields
                          values={
                            (field.value as TemplateSettingsValues | null) ??
                            null
                          }
                          onChange={field.onChange}
                          navigations={navigations}
                        />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {activeSection === "frontend-navigation" && (
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Kopf- und Fußbereich</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Aus diesen Menüs baut die Webseite ihren Header und Footer.
                    Gepflegt werden sie unter Inhalte → Menüs; die
                    Spaltenüberschrift im Footer ist der Name des Menüs. Die
                    Spalte „Rechtliches“ entsteht automatisch aus den
                    vorhandenen Rechtstexten.
                  </p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <NavigationSelectField
                    control={form.control}
                    name="mainNavigationId"
                    label="Hauptmenü (Header)"
                    description="Erscheint oben neben dem Logo."
                    navigations={navigations}
                  />
                  <div className="hidden sm:block" />
                  <NavigationSelectField
                    control={form.control}
                    name="footerNavigationPrimaryId"
                    label="Footer-Menü 1"
                    description="Erste Linkspalte im Footer."
                    navigations={navigations}
                  />
                  <NavigationSelectField
                    control={form.control}
                    name="footerNavigationSecondaryId"
                    label="Footer-Menü 2"
                    description="Zweite Linkspalte im Footer."
                    navigations={navigations}
                  />
                  <FormField
                    control={form.control}
                    name="footerNote"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-1.5 sm:col-span-2">
                        <Label htmlFor="footerNote">Footer-Zusatzzeile</Label>
                        <FormControl>
                          <Input
                            id="footerNote"
                            placeholder="z. B. Hosting in Frankfurt · ISO 27001 · DSGVO"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || null)
                            }
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Steht unten rechts, gegenüber der Copyright-Zeile.
                          Ohne Eintrag bleibt die Stelle leer.
                        </p>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {activeSection === "integrations" && (
              <div className="flex flex-col gap-4">
                <PlaceholderCard
                  title="API-Schlüssel"
                  note="Eigene API-Schlüssel für externe Anwendungen sind in Vorbereitung und folgen in einem späteren Ausbauschritt."
                />
                <SettingsServicesCard smtp={smtp} />
              </div>
            )}

            {activeSection === "master-client" && (
              <MasterClientCard
                settings={settings}
                websites={websites}
                statsHistory={statsHistory}
                form={form}
                licenseState={licenseState}
              />
            )}

            {activeSection === "module" && (
              <ModuleSettingsCard
                modules={(moduleSettings ?? []).filter(
                  (m) => m.usedByMasterItself,
                )}
              />
            )}

            {activeSection === "maintenance-page" && (
              <div className="flex flex-col gap-4">
                <Card className="rounded-xl shadow-sm">
                  <CardContent className="pt-6">
                    <FormField
                      control={form.control}
                      name="maintenanceModeEnabled"
                      render={({ field }) => (
                        <FormItem>
                          <SwitchRow
                            label="Wartungsmodus"
                            description="Zeigt einen Hinweis im Dashboard, dass die Webseite aktuell im Wartungsmodus ist."
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                <MaintenancePageCard
                  title={settings.maintenancePageTitle}
                  message={settings.maintenancePageMessage}
                />
              </div>
            )}

            {activeSection === "webhooks" && (
              <Card className="rounded-xl shadow-sm">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Webhooks</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Automatisierte Events an externe Dienste senden.
                    </p>
                  </div>
                  <WebhookDialog />
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {webhooks && (
                    <WebhookFailureBanner
                      failingCount={webhooks.meta.failingCount}
                    />
                  )}
                  <WebhooksManager items={webhooks?.items ?? []} />
                  {webhooks && (
                    <PaginationControls
                      page={webhooks.meta.page}
                      pageCount={webhooks.meta.pageCount}
                      buildHref={(p) => `?webhooksPage=${p}`}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "notifications" && (
              <NotificationSettingsCard settings={settings} />
            )}

            {activeSection === "jobs" && (
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-4 lg:col-span-2">
                  <ScheduledJobsCard jobs={jobs} />
                  <RecentJobRunsCard runs={jobRuns} status={jobRunsStatus} />
                </div>
                <div className="flex flex-col gap-4">
                  <JobRunRetentionCard
                    jobRunRetentionDays={settings.jobRunRetentionDays}
                    jobsGloballyPaused={settings.jobsGloballyPaused}
                  />
                  <ActivityLogRetentionCard
                    activityLogRetentionDays={settings.activityLogRetentionDays}
                  />
                </div>
              </div>
            )}

            {activeSection === "mailing" && (
              <MailingSettingsCard
                templates={mailTemplates}
                shells={mailShells}
                company={{
                  name: settings.companyName,
                  street: settings.companyStreet,
                  postalCode: settings.companyPostalCode,
                  city: settings.companyCity,
                  email: settings.companyEmail,
                  phone: settings.companyPhone,
                  logoUrl: settings.companyLogoUrl,
                  logoUrlDark: settings.companyLogoUrlDark,
                }}
                submissionSettings={{
                  formSubmissionNotifyOnNew: settings.formSubmissionNotifyOnNew,
                  formSubmissionRecipientEmail:
                    settings.formSubmissionRecipientEmail,
                  formSubmissionConfirmationDefault:
                    settings.formSubmissionConfirmationDefault,
                  formSubmissionUnreadReminderDays:
                    settings.formSubmissionUnreadReminderDays,
                  notificationRecipientEmail:
                    settings.notificationRecipientEmail,
                }}
              />
            )}

            {activeSection === "protocol" && (
              <div className="flex flex-col gap-4">
                <SettingsProtocolCard changes={settingsChanges} />
                <SettingsExportCard
                  hasChanges={(settingsChanges?.meta.total ?? 0) > 0}
                />
              </div>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}
