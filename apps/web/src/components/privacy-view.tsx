"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserCog,
} from "lucide-react";

import { toastCreated, toastDeleted, toastEdited } from "@/components/app-toast";
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
import { DeletionRequestDialog, DELETION_REQUEST_STATUS_LABELS } from "@/components/deletion-request-dialog";
import { ProcessingActivityDialog } from "@/components/processing-activity-dialog";
import { DataProcessorDialog } from "@/components/data-processor-dialog";
import { PrivacyIncidentDialog, PRIVACY_INCIDENT_SEVERITY_LABELS } from "@/components/privacy-incident-dialog";
import { formatName } from "@/lib/utils";
import type {
  AppSettings,
  DataProcessor,
  DeletionRequest,
  LegalDocument,
  ProcessingActivity,
  PrivacyIncident,
  RetentionAuditLogEntry,
  RetentionDeactivatedAccount,
  RetentionTrashDue,
} from "@/lib/api-server";

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
  DRAFT: "bg-slate-200 text-slate-700 hover:bg-slate-200",
  PUBLISHED: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  SCHEDULED: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  ARCHIVED: "bg-gray-100 text-gray-600 hover:bg-gray-100",
};

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
  | "dsb";

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
    <div className="flex flex-col gap-2 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {items.length > 0 && (
          <ConfirmDeleteDialog
            open={confirmAll}
            onOpenChange={setConfirmAll}
            trigger={
              <Button type="button" variant="outline" size="sm" className="border-[#D4D4D4]">
                Alles löschen
              </Button>
            }
            title={`${items.length} Einträge endgültig löschen?`}
            description="Diese Aktion kann nicht rückgängig gemacht werden."
            onConfirm={onDeleteAll}
          />
        )}
      </div>
      {items.length === 0 ?
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      : <ul className="flex flex-col divide-y divide-[#F0F0F0]">
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
      }
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
}: {
  settings: AppSettings;
  legalDocuments: LegalDocument[];
  deletionRequests: DeletionRequest[];
  processingActivities: ProcessingActivity[];
  dataProcessors: DataProcessor[];
  incidents: PrivacyIncident[];
  accessLogDue: RetentionAuditLogEntry[];
  deactivatedAccountsDue: RetentionDeactivatedAccount[];
  trashDue: RetentionTrashDue;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("rechtstexte");
  const tabsRef = useRef<HTMLDivElement>(null);

  const [legalDocuments, setLegalDocuments] = useState(initialLegalDocuments);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [legalDocumentError, setLegalDocumentError] = useState<string | null>(null);

  const [deletionRequests, setDeletionRequests] = useState(initialDeletionRequests);
  const [deletionRequestTarget, setDeletionRequestTarget] = useState<
    DeletionRequest | null | "new"
  >(null);
  const [deletionRequestDeleteTarget, setDeletionRequestDeleteTarget] =
    useState<DeletionRequest | null>(null);

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

  const [incidents, setIncidents] = useState(initialIncidents);
  const [incidentTarget, setIncidentTarget] = useState<
    PrivacyIncident | null | "new"
  >(null);
  const [incidentDeleteTarget, setIncidentDeleteTarget] =
    useState<PrivacyIncident | null>(null);

  const [accessLogDue, setAccessLogDue] = useState(initialAccessLogDue);
  const [deactivatedAccountsDue, setDeactivatedAccountsDue] = useState(
    initialDeactivatedAccountsDue,
  );
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
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const sortedLegalDocuments = [...legalDocuments].sort(
    (a, b) => LEGAL_DOCUMENT_ORDER.indexOf(a.key) - LEGAL_DOCUMENT_ORDER.indexOf(b.key),
  );
  const staleCount = legalDocuments.filter((d) => d.status === "stale").length;
  const missingCount = legalDocuments.filter((d) => d.status === "missing").length;
  const openDeletionRequests = deletionRequests.filter((r) => r.status === "open");
  const dueSoon = openDeletionRequests
    .filter((r) => r.dueAt)
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())[0];
  const dataProcessorsWithContract = dataProcessors.filter((p) => p.hasContract).length;
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
      const res = await fetch(`/api/legal-documents/${key}/regenerate`, {
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
      setLegalDocumentError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setRegeneratingKey(null);
    }
  }

  async function handleExportReport() {
    setIsExporting(true);
    try {
      const res = await fetch("/api/privacy/report");
      if (!res.ok) return;
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
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

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
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
          retentionFormSubmissionsDays: retentionFormSubmissionsDays ?? null,
          retentionAccessLogMonths,
          retentionDeactivatedAccountsMonths,
          retentionTrashDays,
        }),
      });
      if (res.ok) {
        toastEdited("Einstellungen wurden gespeichert.");
        router.refresh();
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
            className="border-[#D4D4D4]"
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
          sublabel={dueSoon ? `kürzeste Frist: ${formatDate(dueSoon.dueAt)}` : "Löschanfragen"}
        />
        <StatCard
          label="Rechtstexte offen"
          value={String(staleCount + missingCount)}
          sublabel="Veraltet oder fehlend"
        />
        <StatCard
          label="Aufbewahrung"
          value={
            retentionFormSubmissionsDays != null ?
              `${retentionFormSubmissionsDays} Tage`
            : "Unbegrenzt"
          }
          sublabel="Formular-Einsendungen"
        />
        <StatCard
          label="Auftragsverarbeiter"
          value={String(dataProcessors.length)}
          sublabel={`${dataProcessorsWithContract} mit AV-Vertrag`}
        />
      </div>

      {(staleCount > 0 || missingCount > 0) && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-[#E5E5E5] bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertTriangle className="size-[18px]" />
          </span>
          <p className="flex-1 text-sm">
            <span className="font-semibold text-[#132033]">
              {staleCount + missingCount}{" "}
              {staleCount + missingCount === 1 ? "Rechtstext braucht" : "Rechtstexte brauchen"} Aufmerksamkeit.
            </span>{" "}
            <span className="text-muted-foreground">
              {missingCount > 0 && staleCount > 0
                ? `${missingCount} ${missingCount === 1 ? "fehlt" : "fehlen"} noch, ${staleCount} ${staleCount === 1 ? "ist" : "sind"} veraltet.`
                : missingCount > 0
                  ? `${missingCount} ${missingCount === 1 ? "fehlt" : "fehlen"} noch.`
                  : "Firmendaten haben sich seit der letzten Erzeugung geändert."}
            </span>
          </p>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setActiveTab("rechtstexte");
              tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <TabsList className="!h-auto w-fit max-w-full flex-wrap justify-start gap-1 !overflow-visible bg-[#F4F4F5] p-1">
          {(
            [
              ["rechtstexte", "Rechtstexte", `${staleCount + missingCount} offen`],
              ["loeschanfragen", "Löschanfragen", `${openDeletionRequests.length} offen`],
              ["verarbeitungen", "Verarbeitungen", `${processingActivities.length} Zwecke`],
              [
                "auftragsverarbeiter",
                "Auftragsverarbeiter",
                `${dataProcessorsWithContract} von ${dataProcessors.length} mit AV`,
              ],
              ["vorfaelle", "Vorfälle", `${incidents.length} erfasst`],
              ["dsb", "Datenschutzbeauftragter", dpo.dpoIsExternal ? "extern benannt" : "intern benannt"],
            ] as const
          ).map(([id, label, subtitle]) => (
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
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
            <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
              <CardHeader>
                <CardTitle>Rechtstexte</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Aus den Stammdaten erzeugt — manuelle Ergänzungen bleiben erhalten.
                </p>
                {legalDocumentError && (
                  <p className="text-sm text-destructive">{legalDocumentError}</p>
                )}
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-[#F0F0F0] p-0">
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
                          className={CONTENT_STATUS_BADGE_CLASSNAMES[doc.contentStatus]}
                        >
                          {CONTENT_STATUS_LABELS[doc.contentStatus]}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      {doc.status === "current" && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          aktuell
                        </Badge>
                      )}
                      {doc.status === "stale" && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          Firmendaten geändert
                        </Badge>
                      )}
                      {doc.status === "missing" && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          fehlt
                        </Badge>
                      )}
                      {doc.contentId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="border-[#D4D4D4]"
                          aria-label={`„${doc.title}“-Seite öffnen`}
                          render={<Link href={`/dashboard/content/${doc.contentId}/edit`} />}
                        >
                          <ExternalLink />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-[#D4D4D4]"
                        disabled={regeneratingKey === doc.key}
                        onClick={() => handleRegenerate(doc.key)}
                      >
                        <RefreshCw className="size-3.5" />
                        {doc.status === "missing" ? "Erzeugen" : "Neu erzeugen"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
              <CardHeader>
                <CardTitle>Aufbewahrung</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Nach Ablauf wird die Wiederherstellung gesperrt — endgültig
                  gelöscht wird erst nach manueller Bestätigung, nie automatisch.
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
                  Kein Formular-Modul vorhanden — Wert wird für ein späteres
                  Formular-Feature vorgehalten.
                </p>

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
                  Nach Ablauf wird der Eintrag gesperrt und kann nicht mehr
                  wiederhergestellt werden – keine automatische Löschung.
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
                    await fetch(`/api/privacy/retention/access-log/${id}`, {
                      method: "DELETE",
                    });
                    setAccessLogDue((prev) => prev.filter((e) => e.id !== id));
                    toastDeleted("Eintrag wurde gelöscht.");
                  }}
                  onDeleteAll={async () => {
                    await fetch("/api/privacy/retention/access-log", {
                      method: "DELETE",
                    });
                    setAccessLogDue([]);
                    toastDeleted("Einträge wurden gelöscht.");
                  }}
                />

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
                </p>
                <RetentionDueList
                  title="Fällig zur Anonymisierung"
                  emptyLabel="Nichts fällig."
                  items={deactivatedAccountsDue.map((u) => ({
                    id: u.id,
                    label: formatName(u),
                    date: formatDate(u.deactivatedAt),
                  }))}
                  onDeleteOne={async (id) => {
                    await fetch(`/api/users/${id}/anonymize`, { method: "POST" });
                    setDeactivatedAccountsDue((prev) =>
                      prev.filter((u) => u.id !== id),
                    );
                    toastDeleted("Konto wurde anonymisiert.");
                  }}
                  onDeleteAll={async () => {
                    await Promise.all(
                      deactivatedAccountsDue.map((u) =>
                        fetch(`/api/users/${u.id}/anonymize`, { method: "POST" }),
                      ),
                    );
                    setDeactivatedAccountsDue([]);
                    toastDeleted("Konten wurden anonymisiert.");
                  }}
                />

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
                    ...trashDue.content.map((i) => ({ ...i, type: "content" as const })),
                    ...trashDue.media.map((i) => ({ ...i, type: "media" as const })),
                    ...trashDue.categories.map((i) => ({ ...i, type: "categories" as const })),
                    ...trashDue.tags.map((i) => ({ ...i, type: "tags" as const })),
                  ].map((i) => ({ id: `${i.type}:${i.id}`, label: i.label, date: formatDate(i.deletedAt) }))}
                  onDeleteOne={async (compositeId) => {
                    const [type, id] = compositeId.split(":");
                    await fetch(`/api/${type}/${id}/permanent`, { method: "DELETE" });
                    setTrashDue((prev) => ({
                      ...prev,
                      [type]: (prev[type as keyof RetentionTrashDue] as { id: string }[]).filter(
                        (i) => i.id !== id,
                      ),
                    }));
                    toastDeleted("Eintrag wurde endgültig gelöscht.");
                  }}
                  onDeleteAll={async () => {
                    const all = [
                      ...trashDue.content.map((i) => ({ type: "content", id: i.id })),
                      ...trashDue.media.map((i) => ({ type: "media", id: i.id })),
                      ...trashDue.categories.map((i) => ({ type: "categories", id: i.id })),
                      ...trashDue.tags.map((i) => ({ type: "tags", id: i.id })),
                    ];
                    await Promise.all(
                      all.map((i) =>
                        fetch(`/api/${i.type}/${i.id}/permanent`, { method: "DELETE" }),
                      ),
                    );
                    setTrashDue({ content: [], media: [], categories: [], tags: [] });
                    toastDeleted("Papierkorb wurde geleert.");
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="loeschanfragen">
          <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Löschanfragen</CardTitle>
              <Button type="button" size="sm" onClick={() => setDeletionRequestTarget("new")}>
                <Plus className="size-4" />
                Anfrage anlegen
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-[#F0F0F0] p-0">
              {deletionRequests.length === 0 ?
                <p className="px-6 py-6 text-sm text-muted-foreground">
                  Noch keine Löschanfragen erfasst.
                </p>
              : deletionRequests.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div>
                      <p className="font-medium">{row.requesterName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.requesterEmail}
                        {row.dueAt && ` · Frist ${formatDate(row.dueAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        {DELETION_REQUEST_STATUS_LABELS[row.status]}
                      </Badge>
                      <RowActionButtons
                        size="icon-sm"
                        onEdit={() => setDeletionRequestTarget(row)}
                        onDelete={() => setDeletionRequestDeleteTarget(row)}
                      />
                    </div>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verarbeitungen">
          <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Verarbeitungstätigkeiten</CardTitle>
              <Button type="button" size="sm" onClick={() => setProcessingActivityTarget("new")}>
                <Plus className="size-4" />
                Zweck hinzufügen
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-[#F0F0F0] p-0">
              {processingActivities.length === 0 ?
                <p className="px-6 py-6 text-sm text-muted-foreground">
                  Noch keine Verarbeitungstätigkeiten erfasst.
                </p>
              : processingActivities.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div>
                      <p className="font-medium">{row.purpose}</p>
                      <p className="text-xs text-muted-foreground">
                        {[row.legalBasis, row.dataCategories].filter(Boolean).join(" · ") || "–"}
                      </p>
                    </div>
                    <RowActionButtons
                      size="icon-sm"
                      onEdit={() => setProcessingActivityTarget(row)}
                      onDelete={() => setProcessingActivityDeleteTarget(row)}
                    />
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auftragsverarbeiter">
          <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Auftragsverarbeiter</CardTitle>
              <Button type="button" size="sm" onClick={() => setDataProcessorTarget("new")}>
                <Plus className="size-4" />
                Verarbeiter hinzufügen
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-[#F0F0F0] p-0">
              {dataProcessors.length === 0 ?
                <p className="px-6 py-6 text-sm text-muted-foreground">
                  Noch keine Auftragsverarbeiter erfasst.
                </p>
              : dataProcessors.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.purpose || "–"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <Badge
                        variant="secondary"
                        className={
                          row.hasContract ?
                            "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-muted text-muted-foreground"
                        }
                      >
                        {row.hasContract ? "mit AV-Vertrag" : "ohne AV-Vertrag"}
                      </Badge>
                      <RowActionButtons
                        size="icon-sm"
                        onEdit={() => setDataProcessorTarget(row)}
                        onDelete={() => setDataProcessorDeleteTarget(row)}
                      />
                    </div>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vorfaelle">
          <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Vorfälle</CardTitle>
              <Button type="button" size="sm" onClick={() => setIncidentTarget("new")}>
                <Plus className="size-4" />
                Vorfall erfassen
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-[#F0F0F0] p-0">
              {incidents.length === 0 ?
                <p className="px-6 py-6 text-sm text-muted-foreground">
                  Noch keine Vorfälle erfasst.
                </p>
              : incidents.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div className="flex items-center gap-3">
                      {row.severity === "high" && (
                        <ShieldAlert className="size-4 shrink-0 text-destructive" />
                      )}
                      <div>
                        <p className="font-medium">{row.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {PRIVACY_INCIDENT_SEVERITY_LABELS[row.severity]}
                          {row.occurredAt && ` · ${formatDate(row.occurredAt)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <Badge
                        variant="secondary"
                        className={
                          row.status === "resolved" ?
                            "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                        }
                      >
                        {row.status === "resolved" ? "Behoben" : "Offen"}
                      </Badge>
                      <RowActionButtons
                        size="icon-sm"
                        onEdit={() => setIncidentTarget(row)}
                        onDelete={() => setIncidentDeleteTarget(row)}
                      />
                    </div>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dsb">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
            <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
              <CardHeader>
                <CardTitle>Benannte Person</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pflicht, sobald regelmäßig besondere Kategorien von Daten
                  verarbeitet werden.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {(dpo.dpoName || dpo.dpoEmail) && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                      {dpoInitials || "?"}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {dpo.dpoName || "Ohne Namen"}
                        </span>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          {dpo.dpoIsExternal ? "extern" : "intern"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {dpo.dpoEmail && <span>{dpo.dpoEmail}</span>}
                        {dpo.dpoPhone && <span>{dpo.dpoPhone}</span>}
                        {dpo.dpoAppointedAt && (
                          <span>benannt seit {formatDate(new Date(dpo.dpoAppointedAt).toISOString())}</span>
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
                      onChange={(e) => setDpo((p) => ({ ...p, dpoName: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-company">
                      {dpo.dpoIsExternal ? "Kanzlei / Unternehmen" : "Abteilung"}
                    </Label>
                    <Input
                      id="dsb-company"
                      value={dpo.dpoCompany}
                      onChange={(e) => setDpo((p) => ({ ...p, dpoCompany: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-email">E-Mail</Label>
                    <Input
                      id="dsb-email"
                      type="email"
                      value={dpo.dpoEmail}
                      onChange={(e) => setDpo((p) => ({ ...p, dpoEmail: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-phone">Telefon</Label>
                    <Input
                      id="dsb-phone"
                      value={dpo.dpoPhone}
                      onChange={(e) => setDpo((p) => ({ ...p, dpoPhone: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-appointed">Benannt seit</Label>
                    <Input
                      id="dsb-appointed"
                      type="date"
                      value={dpo.dpoAppointedAt}
                      onChange={(e) =>
                        setDpo((p) => ({ ...p, dpoAppointedAt: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="dsb-reported">Meldung an Aufsichtsbehörde</Label>
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
              <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
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
                      setDpo((p) => ({ ...p, dpoSupervisoryAuthority: e.target.value }))
                    }
                    placeholder="z.B. Landesbeauftragte für Datenschutz…"
                  />
                  <div className="flex flex-col divide-y divide-[#F0F0F0] text-sm">
                    <div className="flex items-center justify-between py-2 first:pt-0">
                      <span className="text-muted-foreground">Benennung gemeldet</span>
                      <span>
                        {dpo.dpoReportedAt ?
                          formatDate(new Date(dpo.dpoReportedAt).toISOString())
                        : "–"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 last:pb-0">
                      <span className="text-muted-foreground">Letzter Kontakt</span>
                      <Input
                        type="date"
                        className="h-7 w-32 text-right"
                        value={dpo.dpoLastContactAt}
                        onChange={(e) =>
                          setDpo((p) => ({ ...p, dpoLastContactAt: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="border-[#D4D4D4]" disabled>
                    Meldeformular öffnen
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
                <CardHeader>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Kontaktweg für Betroffene
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col divide-y divide-[#F0F0F0] text-sm">
                    <div className="flex items-center justify-between py-2 first:pt-0">
                      <span className="text-muted-foreground">Adresse</span>
                      <span className="truncate">{dpo.dpoEmail || "–"}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 last:pb-0">
                      <span className="text-muted-foreground">
                        Anfragen {currentYear}
                      </span>
                      <span className="font-medium">{deletionRequestsThisYear}</span>
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
      </Tabs>

      <DeletionRequestDialog
        target={deletionRequestTarget}
        onOpenChange={(open) => !open && setDeletionRequestTarget(null)}
        onSaved={(row) =>
          setDeletionRequests((prev) => {
            const exists = prev.some((r) => r.id === row.id);
            return exists ? prev.map((r) => (r.id === row.id ? row : r)) : [row, ...prev];
          })
        }
      />
      <ConfirmDeleteDialog
        open={deletionRequestDeleteTarget !== null}
        onOpenChange={(open) => !open && setDeletionRequestDeleteTarget(null)}
        title="Löschanfrage entfernen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={async () => {
          if (!deletionRequestDeleteTarget) return;
          await fetch(`/api/deletion-requests/${deletionRequestDeleteTarget.id}`, {
            method: "DELETE",
          });
          setDeletionRequests((prev) =>
            prev.filter((r) => r.id !== deletionRequestDeleteTarget.id),
          );
          toastDeleted("Löschanfrage wurde entfernt.");
          setDeletionRequestDeleteTarget(null);
        }}
      />

      <ProcessingActivityDialog
        target={processingActivityTarget}
        onOpenChange={(open) => !open && setProcessingActivityTarget(null)}
        onSaved={(row) =>
          setProcessingActivities((prev) => {
            const exists = prev.some((r) => r.id === row.id);
            return exists ? prev.map((r) => (r.id === row.id ? row : r)) : [row, ...prev];
          })
        }
      />
      <ConfirmDeleteDialog
        open={processingActivityDeleteTarget !== null}
        onOpenChange={(open) => !open && setProcessingActivityDeleteTarget(null)}
        title="Verarbeitungstätigkeit entfernen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={async () => {
          if (!processingActivityDeleteTarget) return;
          await fetch(`/api/processing-activities/${processingActivityDeleteTarget.id}`, {
            method: "DELETE",
          });
          setProcessingActivities((prev) =>
            prev.filter((r) => r.id !== processingActivityDeleteTarget.id),
          );
          toastDeleted("Verarbeitungstätigkeit wurde entfernt.");
          setProcessingActivityDeleteTarget(null);
        }}
      />

      <DataProcessorDialog
        target={dataProcessorTarget}
        onOpenChange={(open) => !open && setDataProcessorTarget(null)}
        onSaved={(row) =>
          setDataProcessors((prev) => {
            const exists = prev.some((r) => r.id === row.id);
            return exists ? prev.map((r) => (r.id === row.id ? row : r)) : [row, ...prev];
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
          await fetch(`/api/data-processors/${dataProcessorDeleteTarget.id}`, {
            method: "DELETE",
          });
          setDataProcessors((prev) =>
            prev.filter((r) => r.id !== dataProcessorDeleteTarget.id),
          );
          toastDeleted("Auftragsverarbeiter wurde entfernt.");
          setDataProcessorDeleteTarget(null);
        }}
      />

      <PrivacyIncidentDialog
        target={incidentTarget}
        onOpenChange={(open) => !open && setIncidentTarget(null)}
        onSaved={(row) =>
          setIncidents((prev) => {
            const exists = prev.some((r) => r.id === row.id);
            return exists ? prev.map((r) => (r.id === row.id ? row : r)) : [row, ...prev];
          })
        }
      />
      <ConfirmDeleteDialog
        open={incidentDeleteTarget !== null}
        onOpenChange={(open) => !open && setIncidentDeleteTarget(null)}
        title="Vorfall entfernen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={async () => {
          if (!incidentDeleteTarget) return;
          await fetch(`/api/privacy-incidents/${incidentDeleteTarget.id}`, {
            method: "DELETE",
          });
          setIncidents((prev) => prev.filter((r) => r.id !== incidentDeleteTarget.id));
          toastDeleted("Vorfall wurde entfernt.");
          setIncidentDeleteTarget(null);
        }}
      />
    </div>
  );
}
