"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RowActionButtons } from "@/components/row-action-buttons";
import { SegmentedPicker } from "@/components/segmented-picker";
import { Separator } from "@/components/ui/separator";
import { SwitchRow } from "@/components/switch-row";
import { StatCard } from "@/components/stat-card";
import { SystemMessage } from "@/components/ui/system-message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataSubjectRequestsPanel } from "@/components/data-subject-requests-panel";
import { ProcessingActivityDialog } from "@/components/processing-activity-dialog";
import { DataProcessorDialog } from "@/components/data-processor-dialog";
import { PrivacyIncidentsPanel } from "@/components/privacy-incidents-panel";
import { mediaUrl } from "@/lib/media";
import { cn, formatName, initials, truncateMiddle } from "@/lib/utils";
import type {
  CompanySettings,
  CurrentUser,
  DataProcessor,
  DeletionRequest,
  LegalDocument,
  PrivacySettings,
  ProcessingActivity,
  PrivacyIncident,
  RetentionAuditLogEntry,
  RetentionDeactivatedAccount,
  RetentionTrashDue,
} from "@/lib/api-server";
import { SubjectAccessRequestDialog } from "@/components/subject-access-request-dialog";
import { UserRestoreButton } from "@/components/user-restore-button";
import { bff } from "@/lib/bff";

type PrivacyPageSettings = CompanySettings & PrivacySettings;

function formatDate(iso: string | null) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Gleiche Labels/Farben wie die Statusverteilung auf dem Dashboard
// (dashboard/page.tsx statusLabel/statusBadgeClassName) – 1:1 übernommen,
// damit ein Content-Status app-weit immer gleich aussieht.
const CONTENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  PUBLISHED: "Veröffentlicht",
  SCHEDULED: "Geplant",
  ARCHIVED: "Archiviert",
};
const CONTENT_STATUS_BADGE_CLASSNAMES: Record<string, string> = {
  DRAFT: "badge--slate border-0",
  PUBLISHED: "badge--green border-0",
  SCHEDULED: "badge--blue border-0",
  ARCHIVED: "badge--slate border-0",
};

// Rechtstexte-Tab, Karte "Pflichtangaben-Check" (Nutzervorgabe, 2026-08-20,
// 1:1 nach Bildvorlage) – gruppiert die Firmen-Stammdaten (siehe
// company-fields.ts) nach §5 TMG-Pflichtangaben statt der flachen
// Feldliste dort: "Anschrift" und "Register & Nummer" fassen mehrere
// Einzelfelder zu einem Check zusammen.
const PFLICHTANGABEN_CHECK_ITEMS: {
  label: string;
  filled: (s: PrivacyPageSettings) => boolean;
}[] = [
  { label: "Firmierung", filled: (s) => !!s.companyName },
  {
    label: "Anschrift",
    filled: (s) => !!(s.companyStreet && s.companyPostalCode && s.companyCity),
  },
  { label: "Vertretungsberechtigte", filled: (s) => !!s.companyRepresentative },
  {
    label: "Register & Nummer",
    filled: (s) => !!(s.companyRegisterCourt && s.companyRegisterNumber),
  },
  { label: "USt-IdNr.", filled: (s) => !!s.companyVatId },
  { label: "Aufsichtsbehörde", filled: (s) => !!s.companySupervisoryAuthority },
  { label: "Streitschlichtung", filled: (s) => !!s.companyDisputeResolution },
];

const LEGAL_DOCUMENT_ORDER = [
  "impressum",
  "datenschutz",
  "cookies",
  "agb",
  "barrierefreiheit",
];

type TabId =
  | "rechtstexte"
  | "loeschanfragen"
  | "verarbeitungen"
  | "auftragsverarbeiter"
  | "vorfaelle"
  | "dsb"
  | "nutzer"
  | "aufbewahrung";

/** Generische "fällig zur Löschung"-Review-Liste (Nutzervorgabe,
 * 2026-08-18: Werte speichern + Liste mit Einzel-/Alles-löschen statt
 * automatischer Hintergrund-Löschung). Drei Instanzen: Zugriffsprotokoll,
 * Deaktivierte Konten, Papierkorb. */
function RetentionDueList({
  title,
  items,
  onDeleteOne,
  onDeleteAll,
  emptyLabel,
}: {
  title: string;
  items: { id: string; label: string; date: string }[];
  onDeleteOne: (id: string) => Promise<void>;
  onDeleteAll: () => Promise<void>;
  emptyLabel: string;
}) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {items.length > 0 && (
          <ConfirmDeleteDialog
            open={confirmAll}
            onOpenChange={setConfirmAll}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-button-border"
              >
                Alles löschen
              </Button>
            }
            title={`${items.length} Einträge endgültig löschen?`}
            description="Diese Aktion kann nicht rückgängig gemacht werden."
            onConfirm={onDeleteAll}
          />
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.date}
              </span>
              <ConfirmDeleteDialog
                open={deleteTarget === item.id}
                onOpenChange={(open) => setDeleteTarget(open ? item.id : null)}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-destructive hover:bg-destructive/10"
                  >
                    Löschen
                  </Button>
                }
                title="Eintrag endgültig löschen?"
                description="Diese Aktion kann nicht rückgängig gemacht werden."
                onConfirm={() => onDeleteOne(item.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PrivacyView({
  settings,
  legalDocuments: initialLegalDocuments,
  deletionRequests: initialDeletionRequests,
  processingActivities: initialProcessingActivities,
  dataProcessors: initialDataProcessors,
  incidents: initialIncidents,
  accessLogDue: initialAccessLogDue,
  deactivatedAccountsDue: initialDeactivatedAccountsDue,
  trashDue: initialTrashDue,
  users,
  avsFolderId,
  sccTemplateMedia: initialSccTemplateMedia,
  enabledFeatures,
}: {
  settings: PrivacyPageSettings;
  legalDocuments: LegalDocument[];
  deletionRequests: DeletionRequest[];
  processingActivities: ProcessingActivity[];
  dataProcessors: DataProcessor[];
  incidents: PrivacyIncident[];
  accessLogDue: RetentionAuditLogEntry[];
  deactivatedAccountsDue: RetentionDeactivatedAccount[];
  trashDue: RetentionTrashDue;
  users: CurrentUser[];
  avsFolderId: string | null;
  sccTemplateMedia: { id: string; filename: string; url: string } | null;
  // Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): `null` = unbeschränkt
  // (Master/unchecked), sonst nur die hier gelisteten Reiter-Keys.
  enabledFeatures: string[] | null;
}) {
  const router = useRouter();
  // ?tab=-Deep-Link (z.B. von der Systemnachrichten-Seite aus, Nutzervorgabe
  // 2026-08-19: "Löschanfragen unter Systembenachrichtigungen aufführen"),
  // gleiches Muster wie my-account-view.tsx.
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const ALL_TAB_IDS: TabId[] = [
    "rechtstexte",
    "loeschanfragen",
    "verarbeitungen",
    "auftragsverarbeiter",
    "vorfaelle",
    "dsb",
    "nutzer",
    "aufbewahrung",
  ];
  // Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): pro Reiter
  // (de)aktivierbar, `enabledFeatures === null` = unbeschränkt.
  const TAB_IDS = enabledFeatures
    ? ALL_TAB_IDS.filter((id) => enabledFeatures.includes(id))
    : ALL_TAB_IDS;
  const initialTab =
    tabParam && (TAB_IDS as string[]).includes(tabParam)
      ? (tabParam as TabId)
      : (TAB_IDS[0] ?? "rechtstexte");
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const tabsRef = useRef<HTMLDivElement>(null);

  const [legalDocuments, setLegalDocuments] = useState(initialLegalDocuments);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [legalDocumentError, setLegalDocumentError] = useState<string | null>(
    null,
  );

  const [deletionRequests, setDeletionRequests] = useState(
    initialDeletionRequests,
  );

  const [processingActivities, setProcessingActivities] = useState(
    initialProcessingActivities,
  );
  const [processingActivityTarget, setProcessingActivityTarget] = useState<
    ProcessingActivity | null | "new"
  >(null);
  const [processingActivityDeleteTarget, setProcessingActivityDeleteTarget] =
    useState<ProcessingActivity | null>(null);

  const [dataProcessors, setDataProcessors] = useState(initialDataProcessors);
  const [dataProcessorTarget, setDataProcessorTarget] = useState<
    DataProcessor | null | "new"
  >(null);
  const [dataProcessorDeleteTarget, setDataProcessorDeleteTarget] =
    useState<DataProcessor | null>(null);
  const [requestingContractFor, setRequestingContractFor] = useState<
    string | null
  >(null);
  const [sccTemplateMedia, setSccTemplateMedia] = useState(
    initialSccTemplateMedia,
  );
  const [isUploadingSccTemplate, setIsUploadingSccTemplate] = useState(false);
  const [isRemovingSccTemplate, setIsRemovingSccTemplate] = useState(false);

  async function handleRequestContract(processor: DataProcessor) {
    setRequestingContractFor(processor.id);
    try {
      const res = await fetch(
        bff(`/api/data-processors/${processor.id}/request-contract`),
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toastEdited(
          body?.message ??
            "Konnte nicht angefragt werden – bitte Kontakt-E-Mail prüfen.",
        );
        return;
      }
      toastEdited(`Anfrage an „${processor.name}“ wurde gesendet.`);
    } finally {
      setRequestingContractFor(null);
    }
  }

  async function handleUploadSccTemplate(file: File) {
    setIsUploadingSccTemplate(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const uploadRes = await fetch(bff("/api/media"), {
        method: "POST",
        body: formData,
      });
      const uploaded = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) return;
      await fetch(bff("/api/settings/privacy/scc-template"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sccTemplateMediaId: uploaded.id }),
      });
      setSccTemplateMedia(uploaded);
      toastEdited("SCC-Vorlage wurde hochgeladen.");
      router.refresh();
    } finally {
      setIsUploadingSccTemplate(false);
    }
  }

  async function handleRemoveSccTemplate() {
    if (!sccTemplateMedia) return;
    setIsRemovingSccTemplate(true);
    try {
      await fetch(bff("/api/settings/privacy/scc-template"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sccTemplateMediaId: null }),
      });
      await fetch(bff(`/api/media/${sccTemplateMedia.id}`), {
        method: "DELETE",
      });
      setSccTemplateMedia(null);
      toastDeleted("SCC-Vorlage wurde entfernt.");
      router.refresh();
    } finally {
      setIsRemovingSccTemplate(false);
    }
  }

  const [incidents, setIncidents] = useState(initialIncidents);

  const [accessLogDue, setAccessLogDue] = useState(initialAccessLogDue);
  const [deactivatedAccountsDue, setDeactivatedAccountsDue] = useState(
    initialDeactivatedAccountsDue,
  );
  const [anonymizeTarget, setAnonymizeTarget] =
    useState<RetentionDeactivatedAccount | null>(null);
  const [trashDue, setTrashDue] = useState(initialTrashDue);

  const [dpo, setDpo] = useState({
    dpoIsExternal: settings.dpoIsExternal,
    dpoName: settings.dpoName ?? "",
    dpoCompany: settings.dpoCompany ?? "",
    dpoEmail: settings.dpoEmail ?? "",
    dpoPhone: settings.dpoPhone ?? "",
    dpoAppointedAt: settings.dpoAppointedAt?.slice(0, 10) ?? "",
    dpoReportedAt: settings.dpoReportedAt?.slice(0, 10) ?? "",
    dpoSupervisoryAuthority: settings.dpoSupervisoryAuthority ?? "",
    dpoLastContactAt: settings.dpoLastContactAt?.slice(0, 10) ?? "",
    dpoListInLegalTexts: settings.dpoListInLegalTexts,
    dpoNotifyOnIncident: settings.dpoNotifyOnIncident,
    dpoMonthlyReportEnabled: settings.dpoMonthlyReportEnabled,
  });
  const [retentionFormSubmissionsDays, setRetentionFormSubmissionsDays] =
    useState(settings.retentionFormSubmissionsDays);
  const [retentionAccessLogMonths, setRetentionAccessLogMonths] = useState(
    settings.retentionAccessLogMonths,
  );
  const [
    retentionDeactivatedAccountsMonths,
    setRetentionDeactivatedAccountsMonths,
  ] = useState(settings.retentionDeactivatedAccountsMonths);
  const [retentionTrashDays, setRetentionTrashDays] = useState(
    settings.retentionTrashDays,
  );
  const [dsbFormSelfServiceDisclosure, setDsbFormSelfServiceDisclosure] =
    useState(settings.dsbFormSelfServiceDisclosure);
  const [dsbFormStoreSubmissionIp, setDsbFormStoreSubmissionIp] = useState(
    settings.dsbFormStoreSubmissionIp,
  );
  const [
    formSubmissionDeleteAfterReadDays,
    setFormSubmissionDeleteAfterReadDays,
  ] = useState(settings.formSubmissionDeleteAfterReadDays);
  const [
    formSubmissionDeleteUnreadAfterDays,
    setFormSubmissionDeleteUnreadAfterDays,
  ] = useState(settings.formSubmissionDeleteUnreadAfterDays);
  const [subjectAccessRequestOpen, setSubjectAccessRequestOpen] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const sortedLegalDocuments = [...legalDocuments].sort(
    (a, b) =>
      LEGAL_DOCUMENT_ORDER.indexOf(a.key) - LEGAL_DOCUMENT_ORDER.indexOf(b.key),
  );
  const staleCount = legalDocuments.filter((d) => d.status === "stale").length;
  const missingCount = legalDocuments.filter(
    (d) => d.status === "missing",
  ).length;
  // Erzeugt, aber die verknüpfte Seite steht auf Entwurf/geplant/archiviert
  // – für Besucher dasselbe wie kein Text, zählt deshalb genauso als
  // "offen" (Nutzer-Bugreport, 2026-09-01). Siehe die gleichnamige
  // Benachrichtigung in notifications.service.ts.
  const unpublishedCount = legalDocuments.filter(
    (d) => d.contentId != null && d.contentStatus !== "PUBLISHED",
  ).length;
  // Ein Dokument kann gleichzeitig veraltet UND unveröffentlicht sein –
  // für Zähler/Kacheln daher die Dokumente zählen, nicht die Befunde
  // addieren, sonst steht in der Kachel eine höhere Zahl als es
  // Rechtstexte gibt.
  const attentionCount = legalDocuments.filter(
    (d) =>
      d.status !== "current" ||
      (d.contentId != null && d.contentStatus !== "PUBLISHED"),
  ).length;
  const legalAttentionDetail = [
    missingCount > 0
      ? `${missingCount} ${missingCount === 1 ? "fehlt" : "fehlen"} noch`
      : null,
    staleCount > 0
      ? `${staleCount} ${staleCount === 1 ? "ist" : "sind"} veraltet (Firmendaten geändert)`
      : null,
    unpublishedCount > 0
      ? `${unpublishedCount} ${unpublishedCount === 1 ? "ist" : "sind"} nicht veröffentlicht`
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  const openDeletionRequests = deletionRequests.filter(
    (r) => r.status === "open",
  );
  const dueSoon = openDeletionRequests
    .filter((r) => r.dueAt)
    .sort(
      (a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime(),
    )[0];
  const incidentsWithRisk = incidents.filter((i) => i.severity !== "low");
  const dataProcessorsWithContract = dataProcessors.filter(
    (p) => p.hasContract,
  ).length;
  const dataProcessorsMissingContract = dataProcessors.filter(
    (p) => !p.hasContract,
  );
  const dataProcessorsOutsideEu = dataProcessors.filter((p) => p.outsideEu);
  // "AV-Verträge herunterladen" nur zeigen, wenn tatsächlich eine Datei
  // zum Herunterladen da ist – getrennt vom manuellen `hasContract`-Haken
  // (der gilt z.B. auch für Papierverträge ohne Upload, siehe
  // schema.prisma-Kommentar zu `DataProcessor.hasContract`). Nutzervorgabe,
  // 2026-08-22: "wenn keine verträge und dateien mehr dazu da sind, soll
  // der button ... nicht mehr erscheinen".
  const hasAnyContractFile = dataProcessors.some((p) => p.contractMedia);
  const currentYear = new Date().getFullYear();
  const deletionRequestsThisYear = deletionRequests.filter(
    (r) => new Date(r.createdAt).getFullYear() === currentYear,
  ).length;
  const dpoInitials = dpo.dpoName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function handleRegenerate(key: string) {
    setRegeneratingKey(key);
    setLegalDocumentError(null);
    try {
      const res = await fetch(bff(`/api/legal-documents/${key}/regenerate`), {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setLegalDocuments((prev) =>
          prev.map((d) => (d.key === key ? { ...data, status: "current" } : d)),
        );
        toastEdited("Rechtstext wurde neu erzeugt.");
      } else {
        setLegalDocumentError(
          data?.message ?? "Rechtstext konnte nicht erzeugt werden.",
        );
      }
    } catch {
      setLegalDocumentError(
        "Server nicht erreichbar. Bitte später erneut versuchen.",
      );
    } finally {
      setRegeneratingKey(null);
    }
  }

  async function handleExportReport() {
    setIsExporting(true);
    try {
      const res = await fetch(bff("/api/privacy/report"));
      if (!res.ok) return;
      // `res.blob()` statt `res.text()`: `text()` dekodiert laut WHATWG-Spec
      // als UTF-8 und entfernt dabei ein führendes BOM automatisch – die
      // Datei kam dadurch ohne BOM an und Excel zeigte Umlaute als Mojibake
      // (Nutzer-Bugreport, 2026-08-20, gleicher Bug-Typ wie in bff-proxy.ts
      // schon einmal gefixt, hier aber ein zweiter, unabhängiger Ort).
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dsgvo-bericht-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  // Bugreport, 2026-08-29: "ich kann in Datenschutz nichts mehr speichern"
  // – Backend-Aufteilung von 2026-08-28 (Datenschutz-als-Modul, `dsb`-Reiter
  // unabhängig vom Rest gegatet) zog `dpo*`-Felder aus `UpdatePrivacyDto` in
  // eine eigene `UpdatePrivacyDsbDto`/`PATCH /settings/privacy/dsb` aus,
  // dieser Handler hier schickte sie aber weiterhin zusammen mit den
  // Aufbewahrungsfeldern an `PATCH /settings/privacy` – mit `dpo*` als
  // (jetzt) unbekannten Feldern lehnt `ValidationPipe({forbidNonWhitelisted:
  // true})` die GESAMTE Anfrage mit 400 ab, auch die eigentlich gültigen
  // Aufbewahrungsfelder wurden dadurch nie gespeichert. Zwei getrennte
  // Requests statt einem, da beide Feldgruppen weiterhin über denselben
  // "Speichern"-Button dieses einen Formulars laufen.
  async function handleSave() {
    setIsSaving(true);
    try {
      // `dsb` einzeln deaktivierbar (siehe TAB_IDS oben) – der Reiter ist
      // dann gar nicht editierbar, ein PATCH mit unveränderten Werten
      // würde nur unnötig an `ModuleFeatureGuard` scheitern (404) und den
      // Speichern-Vorgang fälschlich als Ganzes fehlschlagen lassen.
      const requests = [
        fetch(bff("/api/settings/privacy"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            retentionFormSubmissionsDays: retentionFormSubmissionsDays ?? null,
            retentionAccessLogMonths,
            retentionDeactivatedAccountsMonths,
            retentionTrashDays,
            dsbFormSelfServiceDisclosure,
            dsbFormStoreSubmissionIp,
            formSubmissionDeleteAfterReadDays:
              formSubmissionDeleteAfterReadDays ?? null,
            formSubmissionDeleteUnreadAfterDays:
              formSubmissionDeleteUnreadAfterDays ?? null,
          }),
        }),
      ];
      if (TAB_IDS.includes("dsb")) {
        requests.push(
          fetch(bff("/api/settings/privacy/dsb"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dpoIsExternal: dpo.dpoIsExternal,
              dpoName: dpo.dpoName || undefined,
              dpoCompany: dpo.dpoCompany || undefined,
              dpoEmail: dpo.dpoEmail || undefined,
              dpoPhone: dpo.dpoPhone || undefined,
              dpoAppointedAt: dpo.dpoAppointedAt
                ? new Date(dpo.dpoAppointedAt).toISOString()
                : undefined,
              dpoReportedAt: dpo.dpoReportedAt
                ? new Date(dpo.dpoReportedAt).toISOString()
                : undefined,
              dpoSupervisoryAuthority: dpo.dpoSupervisoryAuthority || undefined,
              dpoLastContactAt: dpo.dpoLastContactAt
                ? new Date(dpo.dpoLastContactAt).toISOString()
                : undefined,
              dpoListInLegalTexts: dpo.dpoListInLegalTexts,
              dpoNotifyOnIncident: dpo.dpoNotifyOnIncident,
              dpoMonthlyReportEnabled: dpo.dpoMonthlyReportEnabled,
            }),
          }),
        );
      }
      const results = await Promise.all(requests);
      const failed = results.find((res) => !res.ok);
      if (!failed) {
        toastEdited("Einstellungen wurden gespeichert.");
        router.refresh();
      } else {
        const data = await failed.json().catch(() => null);
        toastEdited(data?.message ?? "Konnte nicht gespeichert werden.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datenschutz</h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-button-border"
            onClick={handleExportReport}
            disabled={isExporting}
          >
            <Download className="size-4" />
            {isExporting ? "Erzeugt…" : "Bericht erzeugen"}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Offene Anfragen"
          value={String(openDeletionRequests.length)}
          sublabel={
            dueSoon
              ? `kürzeste Frist: ${formatDate(dueSoon.dueAt)}`
              : "Löschanfragen"
          }
        />
        <StatCard
          label="Rechtstexte offen"
          value={String(attentionCount)}
          sublabel="Veraltet, fehlend oder Entwurf"
        />
        <StatCard
          label="Vorfälle mit Risiko"
          value={String(incidentsWithRisk.length)}
          sublabel={`${incidentsWithRisk.filter((i) => !i.authorityNotifiedAt).length} noch nicht gemeldet`}
        />
        <StatCard
          label="Gelöschte Nutzer"
          value={String(deactivatedAccountsDue.length)}
          sublabel="Müssen entfernt werden"
        />
      </div>

      {attentionCount > 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
          <span className="flex size-9 shrink-0 items-center justify-center badge--amber rounded-full">
            <AlertTriangle className="size-[18px]" />
          </span>
          <p className="flex-1 text-sm">
            <span className="font-semibold text-pivot-navy">
              {attentionCount}{" "}
              {attentionCount === 1
                ? "Rechtstext braucht"
                : "Rechtstexte brauchen"}{" "}
              Aufmerksamkeit.
            </span>{" "}
            <span className="break-words text-muted-foreground">
              {legalAttentionDetail}.
            </span>
          </p>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setActiveTab("rechtstexte");
              tabsRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            Prüfen
          </Button>
        </div>
      )}

      <Tabs
        ref={tabsRef}
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabId)}
        className="gap-4"
      >
        <TabsList className="!h-auto w-fit max-w-full flex-wrap justify-start gap-1 !overflow-visible p-1">
          {(
            [
              ["rechtstexte", "Rechtstexte", `${attentionCount} offen`],
              [
                "loeschanfragen",
                "Anfragen",
                `${openDeletionRequests.length} offen`,
              ],
              [
                "verarbeitungen",
                "Verarbeitungen",
                `${processingActivities.length} Zwecke`,
              ],
              [
                "auftragsverarbeiter",
                "Auftragsverarbeiter",
                `${dataProcessorsWithContract} von ${dataProcessors.length} mit AV`,
              ],
              ["vorfaelle", "Vorfälle", `${incidents.length} erfasst`],
              [
                "dsb",
                "Datenschutzbeauftragter",
                dpo.dpoIsExternal ? "extern benannt" : "intern benannt",
              ],
              [
                "nutzer",
                "Benutzer",
                `${deactivatedAccountsDue.length} zu entfernen`,
              ],
              [
                "aufbewahrung",
                "Aufbewahrung",
                `${accessLogDue.length + deactivatedAccountsDue.length} zur Prüfung`,
              ],
            ] as const
          )
            .filter(([id]) => TAB_IDS.includes(id as TabId))
            .map(([id, label, subtitle]) => (
              <TabsTrigger
                key={id}
                value={id}
                className="!h-auto min-h-[52px] flex-none flex-col items-start justify-center gap-0.5 rounded-lg px-4 py-2.5 text-left whitespace-normal"
              >
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {subtitle}
                </span>
              </TabsTrigger>
            ))}
        </TabsList>

        <TabsContent value="rechtstexte">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Rechtstexte</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Aus den Stammdaten erzeugt — manuelle Ergänzungen bleiben
                    erhalten.
                  </p>
                  {legalDocumentError && (
                    <p className="text-sm text-destructive">
                      {legalDocumentError}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col divide-y divide-border p-0">
                  {sortedLegalDocuments.map((doc) => (
                    <div
                      key={doc.key}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                    >
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.slug} · Stand {formatDate(doc.lastGeneratedAt)}
                          </p>
                        </div>
                        {doc.contentStatus && (
                          <Badge
                            variant="secondary"
                            className={
                              CONTENT_STATUS_BADGE_CLASSNAMES[doc.contentStatus]
                            }
                          >
                            {CONTENT_STATUS_LABELS[doc.contentStatus]}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        {doc.status === "current" && (
                          <Badge className="badge--green border-0">
                            aktuell
                          </Badge>
                        )}
                        {doc.status === "stale" && (
                          <Badge className="badge--amber border-0">
                            Firmendaten geändert
                          </Badge>
                        )}
                        {doc.status === "missing" && (
                          <Badge className="badge--amber border-0">fehlt</Badge>
                        )}
                        {doc.contentId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="border-button-border"
                            aria-label={`„${doc.title}“-Seite öffnen`}
                            render={
                              <Link
                                href={`/dashboard/content/${doc.contentId}/edit`}
                              />
                            }
                          >
                            <ExternalLink />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-button-border"
                          disabled={regeneratingKey === doc.key}
                          onClick={() => handleRegenerate(doc.key)}
                        >
                          <RefreshCw className="size-3.5" />
                          {doc.status === "missing"
                            ? "Erzeugen"
                            : "Neu erzeugen"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Betroffenenrechte</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Auskunft und Löschung nach Art. 15 und 17 DSGVO.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <SwitchRow
                    label="Selbstauskunft im Formular-Footer anbieten"
                    description="Zeigt unter jedem Formular auf der Webseite einen Link, über den Besucher eine Auskunft anfordern können. Die Anfrage landet unter Anfragen, es werden keine Daten automatisch herausgegeben."
                    checked={dsbFormSelfServiceDisclosure}
                    onCheckedChange={setDsbFormSelfServiceDisclosure}
                  />
                  <SwitchRow
                    label="IP-Adressen bei Einsendungen speichern"
                    description="Aus = die IP wird beim Absenden gar nicht erst gespeichert."
                    checked={dsbFormStoreSubmissionIp}
                    onCheckedChange={setDsbFormStoreSubmissionIp}
                  />
                  <Separator className="my-1" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-button-border"
                      onClick={() => setSubjectAccessRequestOpen(true)}
                    >
                      Auskunft erstellen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Pflichtangaben-Check
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ul className="flex flex-col gap-2.5 text-sm">
                    {PFLICHTANGABEN_CHECK_ITEMS.map((item) => {
                      const ok = item.filled(settings);
                      return (
                        <li
                          key={item.label}
                          className="flex items-center gap-2"
                        >
                          {ok ? (
                            <Check className="size-4 shrink-0 text-primary" />
                          ) : (
                            <X className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span
                            className={ok ? undefined : "text-muted-foreground"}
                          >
                            {item.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Kein Rechtsrat — die Prüfung deckt nur die Vollständigkeit
                    der Felder ab.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="loeschanfragen">
          <DataSubjectRequestsPanel
            requests={deletionRequests}
            onRequestsChange={setDeletionRequests}
            users={users}
            settings={settings}
          />
        </TabsContent>

        <TabsContent value="verarbeitungen">
          <div className="overflow-hidden rounded-xl bg-card shadow-sm">
            <div className="border-b border-border px-6 py-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Verzeichnis der Verarbeitungstätigkeiten
              </p>
            </div>
            {processingActivities.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">
                Noch keine Verarbeitungstätigkeiten erfasst.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {processingActivities.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_110px_1fr_100px_130px_auto] items-center gap-4 px-6 py-4"
                  >
                    <p className="truncate font-medium">{row.purpose}</p>
                    <p className="truncate font-mono text-xs text-blue-700 dark:text-blue-500">
                      {row.legalBasis || "–"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {row.dataCategories || "–"}
                    </p>
                    <p className="truncate font-mono text-xs text-amber-700 dark:text-amber-500">
                      {row.retentionPeriod || "–"}
                    </p>
                    <div className="flex justify-end">
                      {row.recipients ? (
                        <Badge
                          variant="secondary"
                          className="bg-muted text-muted-foreground"
                        >
                          {row.recipients}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          intern
                        </span>
                      )}
                    </div>
                    <RowActionButtons
                      size="icon-sm"
                      onEdit={() => setProcessingActivityTarget(row)}
                      onDelete={() => setProcessingActivityDeleteTarget(row)}
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setProcessingActivityTarget("new")}
              className="flex w-full items-center gap-2 border-t border-border px-6 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Plus className="size-4" />
              Verarbeitung ergänzen
            </button>
          </div>
        </TabsContent>

        <TabsContent value="auftragsverarbeiter">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <div className="overflow-hidden rounded-xl bg-card shadow-sm lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Dienstleister mit Datenzugriff · {dataProcessors.length}
                </p>
                <span className="text-xs text-muted-foreground">
                  Art. 28 DSGVO
                </span>
              </div>
              {dataProcessors.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Noch keine Auftragsverarbeiter erfasst.
                </p>
              )}
              <div className="flex flex-col divide-y divide-border">
                {dataProcessors.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 sm:w-48 sm:shrink-0">
                      <p className="truncate font-semibold">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.contractDate &&
                          `seit ${formatDate(row.contractDate)}`}
                        {row.contractDate && row.complianceNote && " · "}
                        {row.complianceNote}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground sm:w-48 sm:shrink-0">
                      {row.purpose || "–"}
                    </p>
                    <div className="flex shrink-0 items-center gap-3">
                      {row.location && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" />
                          {row.location}
                        </span>
                      )}
                      <Badge
                        className={
                          row.hasContract
                            ? "badge--green border-0"
                            : "badge--amber border-0"
                        }
                      >
                        {row.hasContract ? "AV-Vertrag" : "AV fehlt"}
                      </Badge>
                      <RowActionButtons
                        size="icon-sm"
                        onEdit={() => setDataProcessorTarget(row)}
                        onDelete={() => setDataProcessorDeleteTarget(row)}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setDataProcessorTarget("new")}
                    className="flex items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Plus className="size-4" />
                    Auftragsverarbeiter ergänzen
                  </button>
                  {hasAnyContractFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-button-border"
                      render={
                        <a href={bff("/api/data-processors/contracts.zip")} />
                      }
                    >
                      AV-Verträge herunterladen
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Offene Punkte
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {dataProcessorsMissingContract.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Keine offenen Punkte.
                    </p>
                  ) : (
                    dataProcessorsMissingContract.map((processor) => (
                      <div key={processor.id} className="flex flex-col gap-2">
                        <p className="text-sm text-amber-700">
                          <span className="font-semibold">
                            {processor.name}
                          </span>{" "}
                          — AV-Vertrag
                          {processor.outsideEu &&
                            " und Standardvertragsklauseln"}{" "}
                          fehlen
                        </p>
                        <Button
                          type="button"
                          className="w-full"
                          disabled={requestingContractFor === processor.id}
                          onClick={() => handleRequestContract(processor)}
                        >
                          {requestingContractFor === processor.id
                            ? "Sendet…"
                            : "AV-Vertrag anfordern"}
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Drittlandtransfer
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {dataProcessorsOutsideEu.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Kein Dienstleister verarbeitet Daten außerhalb der EU.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {dataProcessorsOutsideEu.length === 1
                        ? `${dataProcessorsOutsideEu[0].name} verarbeitet`
                        : `${dataProcessorsOutsideEu.length} Dienstleister verarbeiten`}{" "}
                      Daten außerhalb der EU. Nötig sind
                      Standardvertragsklauseln plus Transfer-Folgenabschätzung.
                    </p>
                  )}
                  {sccTemplateMedia ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-button-border"
                        render={
                          <a href={mediaUrl(sccTemplateMedia)} download />
                        }
                      >
                        Vorlage herunterladen
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="SCC-Vorlage entfernen"
                        disabled={isRemovingSccTemplate}
                        onClick={handleRemoveSccTemplate}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-border px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-muted">
                        {isUploadingSccTemplate
                          ? "Lädt hoch…"
                          : "Vorlage hochladen"}
                        <input
                          type="file"
                          className="hidden"
                          disabled={isUploadingSccTemplate}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadSccTemplate(file);
                          }}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Noch keine SCC-Vorlage hinterlegt.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vorfaelle">
          <PrivacyIncidentsPanel
            incidents={incidents}
            onIncidentsChange={setIncidents}
          />
        </TabsContent>

        <TabsContent value="dsb">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <Card className="rounded-xl shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle>Benannte Person</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pflicht, sobald regelmäßig besondere Kategorien von Daten
                  verarbeitet werden.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {(dpo.dpoName || dpo.dpoEmail) && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted p-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                      {dpoInitials || "?"}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {dpo.dpoName || "Ohne Namen"}
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-muted text-muted-foreground"
                        >
                          {dpo.dpoIsExternal ? "extern" : "intern"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {dpo.dpoEmail && <span>{dpo.dpoEmail}</span>}
                        {dpo.dpoPhone && <span>{dpo.dpoPhone}</span>}
                        {dpo.dpoAppointedAt && (
                          <span>
                            benannt seit{" "}
                            {formatDate(
                              new Date(dpo.dpoAppointedAt).toISOString(),
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={dpo.dpoIsExternal}
                    onCheckedChange={(checked) =>
                      setDpo((p) => ({ ...p, dpoIsExternal: checked === true }))
                    }
                  />
                  Extern benannt
                </label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-name">Name</Label>
                    <Input
                      id="dsb-name"
                      value={dpo.dpoName}
                      onChange={(e) =>
                        setDpo((p) => ({ ...p, dpoName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-company">
                      {dpo.dpoIsExternal
                        ? "Kanzlei / Unternehmen"
                        : "Abteilung"}
                    </Label>
                    <Input
                      id="dsb-company"
                      value={dpo.dpoCompany}
                      onChange={(e) =>
                        setDpo((p) => ({ ...p, dpoCompany: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-email">E-Mail</Label>
                    <Input
                      id="dsb-email"
                      type="email"
                      value={dpo.dpoEmail}
                      onChange={(e) =>
                        setDpo((p) => ({ ...p, dpoEmail: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-phone">Telefon</Label>
                    <Input
                      id="dsb-phone"
                      value={dpo.dpoPhone}
                      onChange={(e) =>
                        setDpo((p) => ({ ...p, dpoPhone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-appointed">Benannt seit</Label>
                    <Input
                      id="dsb-appointed"
                      type="date"
                      value={dpo.dpoAppointedAt}
                      onChange={(e) =>
                        setDpo((p) => ({
                          ...p,
                          dpoAppointedAt: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-reported">
                      Meldung an Aufsichtsbehörde
                    </Label>
                    <Input
                      id="dsb-reported"
                      type="date"
                      value={dpo.dpoReportedAt}
                      onChange={(e) =>
                        setDpo((p) => ({ ...p, dpoReportedAt: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Datum der Benennungsmeldung.
                    </p>
                  </div>
                </div>

                <Separator />

                <SwitchRow
                  label="Im Impressum und in der Datenschutzerklärung nennen"
                  description="Wirkt erst nach Speichern und „Neu erzeugen“ bei den beiden Rechtstexten."
                  checked={dpo.dpoListInLegalTexts}
                  onCheckedChange={(checked) =>
                    setDpo((p) => ({ ...p, dpoListInLegalTexts: checked }))
                  }
                />
                {dpo.dpoListInLegalTexts && !dpo.dpoName && !dpo.dpoEmail && (
                  <SystemMessage
                    variant="warning"
                    title="Noch kein Absatz in den Rechtstexten."
                    description="Ohne Name oder E-Mail-Adresse wird nichts angezeigt. Danach die Rechtstexte über „Neu erzeugen“ aktualisieren."
                  />
                )}
                <SwitchRow
                  label="Bei jedem Vorfall automatisch benachrichtigen"
                  checked={dpo.dpoNotifyOnIncident}
                  onCheckedChange={(checked) =>
                    setDpo((p) => ({ ...p, dpoNotifyOnIncident: checked }))
                  }
                />
                <SwitchRow
                  label="Monatsbericht per E-Mail"
                  description="Anfragen, Vorfälle, offene AV-Verträge"
                  checked={dpo.dpoMonthlyReportEnabled}
                  onCheckedChange={(checked) =>
                    setDpo((p) => ({ ...p, dpoMonthlyReportEnabled: checked }))
                  }
                />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Aufsichtsbehörde
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Input
                    aria-label="Aufsichtsbehörde"
                    value={dpo.dpoSupervisoryAuthority}
                    onChange={(e) =>
                      setDpo((p) => ({
                        ...p,
                        dpoSupervisoryAuthority: e.target.value,
                      }))
                    }
                    placeholder="z.B. Landesbeauftragte für Datenschutz…"
                  />
                  <div className="flex flex-col divide-y divide-border text-sm">
                    <div className="flex items-center justify-between py-2 first:pt-0">
                      <span className="text-muted-foreground">
                        Benennung gemeldet
                      </span>
                      <span>
                        {dpo.dpoReportedAt
                          ? formatDate(
                              new Date(dpo.dpoReportedAt).toISOString(),
                            )
                          : "–"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 last:pb-0">
                      <span className="text-muted-foreground">
                        Letzter Kontakt
                      </span>
                      <Input
                        type="date"
                        className="h-7 w-32 text-right"
                        value={dpo.dpoLastContactAt}
                        onChange={(e) =>
                          setDpo((p) => ({
                            ...p,
                            dpoLastContactAt: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-button-border"
                    disabled
                  >
                    Meldeformular öffnen
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm">
                <CardHeader>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Kontaktweg für Betroffene
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col divide-y divide-border text-sm">
                    <div className="flex items-center justify-between py-2 first:pt-0">
                      <span className="text-muted-foreground">Adresse</span>
                      <span className="truncate">{dpo.dpoEmail || "–"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 last:pb-0">
                      <span className="text-muted-foreground">
                        Anfragen {currentYear}
                      </span>
                      <span className="font-medium">
                        {deletionRequestsThisYear}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Die Adresse erscheint in allen Rechtstexten, sobald die
                    Nennung aktiv ist.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="nutzer">
          <div className="overflow-hidden rounded-xl bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Gelöschte Nutzer · {deactivatedAccountsDue.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Gelöschte Konten, die noch nicht anonymisiert wurden.
                </p>
              </div>
              {deactivatedAccountsDue.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-button-border"
                  onClick={async () => {
                    await Promise.all(
                      deactivatedAccountsDue.map((u) =>
                        fetch(bff(`/api/users/${u.id}/anonymize`), {
                          method: "POST",
                        }),
                      ),
                    );
                    setDeactivatedAccountsDue([]);
                    toastDeleted("Konten wurden anonymisiert.");
                  }}
                >
                  Alle anonymisieren
                </Button>
              )}
            </div>
            {deactivatedAccountsDue.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">
                Keine gelöschten Nutzer.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {deactivatedAccountsDue.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                        {initials(u)}
                      </span>
                      <div>
                        <p className="font-medium">{formatName(u)}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        Gelöscht seit {formatDate(u.deletedAt)}
                      </span>
                      {u.overdue ? (
                        <div className="flex items-center gap-1.5 text-sm text-destructive">
                          <Lock className="size-3.5" />
                          Frist abgelaufen
                        </div>
                      ) : (
                        <div className="flex w-28 flex-col items-end gap-1">
                          <span className="text-sm font-medium">
                            {u.daysLeft === 0 ? "heute" : `in ${u.daysLeft} T.`}
                          </span>
                          <div className="h-1.5 w-full rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                u.daysLeft <= 7 ? "bg-amber-500" : "bg-primary",
                              )}
                              style={{
                                width: `${Math.max(0, Math.min(100, (u.daysLeft / (retentionDeactivatedAccountsMonths * 30)) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <UserRestoreButton
                        userId={u.id}
                        name={formatName(u)}
                        onRestored={() =>
                          setDeactivatedAccountsDue((prev) =>
                            prev.filter((p) => p.id !== u.id),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-button-border text-destructive"
                        onClick={() => setAnonymizeTarget(u)}
                      >
                        Anonymisieren
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Nutzervorgabe, 2026-09-02: EIN Reiter statt zweier, und die
            Themen nebeneinander über die volle Breite. Vorher lagen alle
            vier Fristen in einer langen Karte im Reiter Rechtstexte, mit
            der Einsendungs-Löschung in einem eigenen Reiter daneben –
            zusammenhanglos untereinander und mit leerem Drittel rechts. */}
        <TabsContent value="aufbewahrung">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Nach Ablauf wird die Wiederherstellung gesperrt — endgültig
              gelöscht wird erst nach manueller Bestätigung über die Listen
              unten. Einzige Ausnahme: gelesene Einsendungen, die tatsächlich
              automatisch gelöscht werden.
            </p>
            {/* Mehrspaltiger Fluss statt Grid (Nutzervorgabe, 2026-09-02:
                "wie in der Galerie umbrechen ohne leeren Raum"): ein
                `grid-cols-2` macht jede Zeile so hoch wie ihre höchste
                Karte und lässt unter der kürzeren ein Loch. CSS-Spalten
                verteilen die Karten stattdessen ausbalanciert, ohne
                Lücke. Bewusst NICHT das JS-Masonry aus
                media-explorer.tsx – das schätzt Höhen aus Bild-Seiten-
                verhältnissen und passt für Karten unbekannter Höhe nicht. */}
            <div className="columns-1 gap-4 lg:columns-2">
              <Card className="mb-4 break-inside-avoid rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Formular-Einsendungen</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Enthalten in aller Regel personenbezogene Daten.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <SegmentedPicker
                    label="Formular-Einsendungen"
                    value={retentionFormSubmissionsDays ?? -1}
                    onChange={(v) =>
                      setRetentionFormSubmissionsDays(v === -1 ? null : v)
                    }
                    options={[
                      { label: "30 Tage", value: 30 },
                      { label: "90 Tage", value: 90 },
                      { label: "1 Jahr", value: 365 },
                      { label: "unbegrenzt", value: -1 },
                    ]}
                  />
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Gerechnet ab Eingang. Markiert abgelaufene Einsendungen in
                    der Liste, löscht aber nichts — automatisches Löschen nach
                    dem Lesen steht im Reiter „Formulare“.
                  </p>

                  <SegmentedPicker
                    label="Nach dem Lesen automatisch löschen"
                    value={formSubmissionDeleteAfterReadDays ?? -1}
                    onChange={(v) =>
                      setFormSubmissionDeleteAfterReadDays(v === -1 ? null : v)
                    }
                    options={[
                      { label: "7 Tage", value: 7 },
                      { label: "30 Tage", value: 30 },
                      { label: "90 Tage", value: 90 },
                      { label: "nie", value: -1 },
                    ]}
                  />
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Gemessen ab dem Zeitpunkt des Lesens, nicht ab Eingang. Wird
                    eine Einsendung wieder auf ungelesen gesetzt, beginnt die
                    Frist neu.
                  </p>

                  <SegmentedPicker
                    label="Nie gelesene löschen"
                    value={formSubmissionDeleteUnreadAfterDays ?? -1}
                    onChange={(v) =>
                      setFormSubmissionDeleteUnreadAfterDays(
                        v === -1 ? null : v,
                      )
                    }
                    options={[
                      { label: "90 Tage", value: 90 },
                      { label: "180 Tage", value: 180 },
                      { label: "1 Jahr", value: 365 },
                      { label: "nie", value: -1 },
                    ]}
                  />
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Gemessen ab Eingang — für nie gelesene Einsendungen gibt es
                    keinen Lesezeitpunkt. Bewusst großzügiger: was niemand
                    angesehen hat, soll nicht nach wenigen Tagen verschwinden.
                  </p>

                  <SystemMessage
                    variant="warning"
                    title="Löscht endgültig, nicht in den Papierkorb."
                    description="Anders als bei allen übrigen Aufbewahrungsfristen gibt es hier keine Wiederherstellung und keine manuelle Bestätigung. Der tägliche Job „Gelesene Einsendungen löschen“ erledigt das."
                  />
                </CardContent>
              </Card>
              <Card className="mb-4 break-inside-avoid rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Zugriffsprotokoll</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Wer wann was im Backend getan hat.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <SegmentedPicker
                    label="Zugriffsprotokoll (Monate)"
                    value={retentionAccessLogMonths}
                    onChange={setRetentionAccessLogMonths}
                    options={[
                      { label: "3 Monate", value: 3 },
                      { label: "6 Monate", value: 6 },
                      { label: "12 Monate", value: 12 },
                      { label: "24 Monate", value: 24 },
                    ]}
                  />
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Nach Ablauf erscheint der Eintrag unten zur manuellen
                    Löschung. Zusätzlich räumt die Aufbewahrungsfrist unter
                    Einstellungen → Jobs den kompletten Aktivitäten-Verlauf
                    automatisch auf – bei kürzerer Frist dort verschwindet ein
                    Eintrag ggf. schon vorher.
                  </p>
                  <RetentionDueList
                    title="Fällig zur Löschung"
                    emptyLabel="Nichts fällig."
                    items={accessLogDue.map((e) => ({
                      id: e.id,
                      label: e.action,
                      date: formatDate(e.createdAt),
                    }))}
                    onDeleteOne={async (id) => {
                      await fetch(
                        bff(`/api/privacy/retention/access-log/${id}`),
                        {
                          method: "DELETE",
                        },
                      );
                      setAccessLogDue((prev) =>
                        prev.filter((e) => e.id !== id),
                      );
                      toastDeleted("Eintrag wurde gelöscht.");
                    }}
                    onDeleteAll={async () => {
                      await fetch(bff("/api/privacy/retention/access-log"), {
                        method: "DELETE",
                      });
                      setAccessLogDue([]);
                      toastDeleted("Einträge wurden gelöscht.");
                    }}
                  />
                </CardContent>
              </Card>
              <Card className="mb-4 break-inside-avoid rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Deaktivierte Konten</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Abgeschaltete Benutzerkonten samt ihrer Daten.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <SegmentedPicker
                    label="Deaktivierte Konten (Monate)"
                    value={retentionDeactivatedAccountsMonths}
                    onChange={setRetentionDeactivatedAccountsMonths}
                    options={[
                      { label: "3 Monate", value: 3 },
                      { label: "6 Monate", value: 6 },
                      { label: "12 Monate", value: 12 },
                      { label: "24 Monate", value: 24 },
                    ]}
                  />
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Nach Ablauf wird der Eintrag gesperrt und kann nicht mehr
                    wiederhergestellt werden – keine automatische Löschung.
                    Fällige Konten stehen im Tab „Benutzer“.
                  </p>
                </CardContent>
              </Card>
              <Card className="mb-4 break-inside-avoid rounded-xl shadow-sm">
                <CardHeader>
                  <CardTitle>Papierkorb</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Gelöschte Seiten, Medien, Kategorien und Tags.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <SegmentedPicker
                    label="Papierkorb (Tage)"
                    value={retentionTrashDays}
                    onChange={setRetentionTrashDays}
                    options={[
                      { label: "7 Tage", value: 7 },
                      { label: "30 Tage", value: 30 },
                      { label: "90 Tage", value: 90 },
                      { label: "180 Tage", value: 180 },
                    ]}
                  />
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Nach Ablauf wird der Eintrag im Papierkorb gesperrt und kann
                    nicht mehr wiederhergestellt werden – keine automatische
                    Löschung.
                  </p>
                  <RetentionDueList
                    title="Fällig zur endgültigen Löschung"
                    emptyLabel="Papierkorb ist leer."
                    items={[
                      ...trashDue.content.map((i) => ({
                        ...i,
                        type: "content" as const,
                      })),
                      ...trashDue.media.map((i) => ({
                        ...i,
                        type: "media" as const,
                      })),
                      ...trashDue.categories.map((i) => ({
                        ...i,
                        type: "categories" as const,
                      })),
                      ...trashDue.tags.map((i) => ({
                        ...i,
                        type: "tags" as const,
                      })),
                    ].map((i) => ({
                      id: `${i.type}:${i.id}`,
                      label: i.label,
                      date: formatDate(i.deletedAt),
                    }))}
                    onDeleteOne={async (compositeId) => {
                      const [type, id] = compositeId.split(":");
                      await fetch(bff(`/api/${type}/${id}/permanent`), {
                        method: "DELETE",
                      });
                      setTrashDue((prev) => ({
                        ...prev,
                        [type]: (
                          prev[type as keyof RetentionTrashDue] as {
                            id: string;
                          }[]
                        ).filter((i) => i.id !== id),
                      }));
                      toastDeleted("Eintrag wurde endgültig gelöscht.");
                    }}
                    onDeleteAll={async () => {
                      const all = [
                        ...trashDue.content.map((i) => ({
                          type: "content",
                          id: i.id,
                        })),
                        ...trashDue.media.map((i) => ({
                          type: "media",
                          id: i.id,
                        })),
                        ...trashDue.categories.map((i) => ({
                          type: "categories",
                          id: i.id,
                        })),
                        ...trashDue.tags.map((i) => ({
                          type: "tags",
                          id: i.id,
                        })),
                      ];
                      await Promise.all(
                        all.map((i) =>
                          fetch(bff(`/api/${i.type}/${i.id}/permanent`), {
                            method: "DELETE",
                          }),
                        ),
                      );
                      setTrashDue({
                        content: [],
                        media: [],
                        categories: [],
                        tags: [],
                      });
                      toastDeleted("Papierkorb wurde geleert.");
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ProcessingActivityDialog
        target={processingActivityTarget}
        onOpenChange={(open) => !open && setProcessingActivityTarget(null)}
        onSaved={(row) =>
          setProcessingActivities((prev) => {
            const exists = prev.some((r) => r.id === row.id);
            return exists
              ? prev.map((r) => (r.id === row.id ? row : r))
              : [row, ...prev];
          })
        }
      />
      <ConfirmDeleteDialog
        open={processingActivityDeleteTarget !== null}
        onOpenChange={(open) =>
          !open && setProcessingActivityDeleteTarget(null)
        }
        title="Verarbeitungstätigkeit entfernen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={async () => {
          if (!processingActivityDeleteTarget) return;
          await fetch(
            bff(
              `/api/processing-activities/${processingActivityDeleteTarget.id}`,
            ),
            {
              method: "DELETE",
            },
          );
          setProcessingActivities((prev) =>
            prev.filter((r) => r.id !== processingActivityDeleteTarget.id),
          );
          toastDeleted("Verarbeitungstätigkeit wurde entfernt.");
          setProcessingActivityDeleteTarget(null);
        }}
      />

      <DataProcessorDialog
        target={dataProcessorTarget}
        avsFolderId={avsFolderId}
        onOpenChange={(open) => !open && setDataProcessorTarget(null)}
        onSaved={(row) =>
          setDataProcessors((prev) => {
            const exists = prev.some((r) => r.id === row.id);
            return exists
              ? prev.map((r) => (r.id === row.id ? row : r))
              : [row, ...prev];
          })
        }
      />
      <ConfirmDeleteDialog
        open={dataProcessorDeleteTarget !== null}
        onOpenChange={(open) => !open && setDataProcessorDeleteTarget(null)}
        title="Auftragsverarbeiter entfernen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={async () => {
          if (!dataProcessorDeleteTarget) return;
          await fetch(
            bff(`/api/data-processors/${dataProcessorDeleteTarget.id}`),
            {
              method: "DELETE",
            },
          );
          setDataProcessors((prev) =>
            prev.filter((r) => r.id !== dataProcessorDeleteTarget.id),
          );
          toastDeleted("Auftragsverarbeiter wurde entfernt.");
          setDataProcessorDeleteTarget(null);
        }}
      />

      <SubjectAccessRequestDialog
        open={subjectAccessRequestOpen}
        onOpenChange={setSubjectAccessRequestOpen}
        users={users}
      />

      <ConfirmDeleteDialog
        open={anonymizeTarget !== null}
        onOpenChange={(open) => !open && setAnonymizeTarget(null)}
        title={`„${truncateMiddle(formatName(anonymizeTarget ?? { firstName: "", lastName: "" }))}“ anonymisieren?`}
        description="Alle personenbezogenen Daten werden entfernt. Diese Aktion ist endgültig und kann nicht rückgängig gemacht werden."
        confirmLabel="Anonymisieren"
        confirmingLabel="Anonymisiert…"
        onConfirm={async () => {
          if (!anonymizeTarget) return;
          await fetch(bff(`/api/users/${anonymizeTarget.id}/anonymize`), {
            method: "POST",
          });
          setDeactivatedAccountsDue((prev) =>
            prev.filter((p) => p.id !== anonymizeTarget.id),
          );
          toastDeleted(`„${formatName(anonymizeTarget)}“ wurde anonymisiert.`);
          setAnonymizeTarget(null);
        }}
      />
    </div>
  );
}
