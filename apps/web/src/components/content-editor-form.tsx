"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, X } from "lucide-react";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateTimePicker } from "@/components/date-time-picker";
import { InfoTooltip } from "@/components/info-tooltip";
import { SegmentedPicker } from "@/components/segmented-picker";
import {
  BlockEditorField,
  type ModuleInstance,
} from "@/components/block-editor-field";
import { PageContent } from "@/components/page-content";
import { SystemMessage } from "@/components/ui/system-message";
import {
  DRAFT_STORAGE_PREFIX,
  notifyLocalDraftsChanged,
} from "@/lib/local-drafts";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CategoryRef,
  ContentType,
  ContentStatus,
  ContentDetail,
  GlobalModule,
  ModuleType,
  TagRef,
} from "@/lib/api-server";
import { tagDotColor } from "@/lib/tag-colors";
import { cn, formatName, slugify } from "@/lib/utils";

const LOCK_HEARTBEAT_INTERVAL_MS = 60_000;

interface LockInfo {
  lockedBy: { id: string; firstName: string | null; lastName: string };
  lockedAt: string;
}

type LockState = "checking" | "held" | "locked-by-other" | "error";

interface SeoValues {
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  twitterCard: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
}

function toSeoValues(content: ContentDetail | undefined): SeoValues {
  return {
    excerpt: content?.excerpt ?? "",
    seoTitle: content?.seoTitle ?? "",
    seoDescription: content?.seoDescription ?? "",
    canonicalUrl: content?.canonicalUrl ?? "",
    ogTitle: content?.ogTitle ?? "",
    ogDescription: content?.ogDescription ?? "",
    ogImageUrl: content?.ogImageUrl ?? "",
    twitterCard: content?.twitterCard ?? "none",
    robotsIndex: content?.robotsIndex ?? true,
    robotsFollow: content?.robotsFollow ?? true,
  };
}

const statusLabel: Record<ContentStatus, string> = {
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

const metaSchema = z.object({
  contentTypeId: z.string().min(1, "Bitte einen Content-Type wählen."),
  title: z.string().min(1, "Titel ist erforderlich."),
  slug: z
    .string()
    .min(1, "Slug ist erforderlich.")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Nur Kleinbuchstaben, Zahlen und Bindestriche.",
    ),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
});

type MetaValues = z.infer<typeof metaSchema>;

/** ISO-String (UTC) -> Wert für ein `datetime-local`-Input (lokale Zeit, ohne Zeitzone). */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDataValues(
  data: Record<string, unknown> | undefined,
): Record<string, string> {
  if (!data) return {};
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? "")]),
  );
}

/**
 * Modul-Felder (Seiten-Designer) speichern kein einfaches String-Feld,
 * sondern ein Array von Modul-Instanzen – laufen deshalb bewusst über
 * einen eigenen State statt über `dataValues`, statt dessen Typ auf
 * `string | ModuleInstance[]` aufzuweiten (hätte sonst an vielen Stellen
 * String-Annahmen über `dataValues` gebrochen).
 */
function toModuleValues(
  data: Record<string, unknown> | undefined,
): Record<string, ModuleInstance[]> {
  if (!data) return {};
  const result: Record<string, ModuleInstance[]> = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      result[key] = value as ModuleInstance[];
    }
  }
  return result;
}

interface DraftSnapshot {
  savedAt: string;
  title: string;
  slug: string;
  status: ContentStatus;
  scheduledForValue: string;
  categoryIds: string[];
  tagIds: string[];
  dataValues: Record<string, string>;
  moduleValues: Record<string, ModuleInstance[]>;
  seoValues: SeoValues;
}

function draftStorageKey(
  content: ContentDetail | undefined,
  contentTypeId: string,
) {
  return `${DRAFT_STORAGE_PREFIX}${content?.id ?? `new-${contentTypeId}`}`;
}

function isDraftWorthSaving(snapshot: DraftSnapshot) {
  return (
    snapshot.title.trim().length > 0 ||
    Object.values(snapshot.dataValues).some(
      (value) => value.trim().length > 0,
    ) ||
    Object.values(snapshot.moduleValues).some(
      (instances) => instances.length > 0,
    )
  );
}

export function ContentEditorForm({
  contentTypes,
  moduleTypes,
  globalModules,
  categories,
  tags,
  content,
  autosaveEnabled = true,
  canForceUnlock = false,
}: {
  contentTypes: ContentType[];
  moduleTypes: ModuleType[];
  globalModules: GlobalModule[];
  categories: CategoryRef[];
  tags: TagRef[];
  content?: ContentDetail;
  autosaveEnabled?: boolean;
  canForceUnlock?: boolean;
}) {
  const router = useRouter();
  const isEditing = Boolean(content);
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [dataValues, setDataValues] = useState<Record<string, string>>(
    toDataValues(content?.data),
  );
  const [moduleValues, setModuleValues] = useState<
    Record<string, ModuleInstance[]>
  >(toModuleValues(content?.data));
  const [dataErrors, setDataErrors] = useState<Record<string, string>>({});
  const [categoryIds, setCategoryIds] = useState<string[]>(
    content?.categories.map((category) => category.id) ?? [],
  );
  const [tagIds, setTagIds] = useState<string[]>(
    content?.tags.map((tag) => tag.id) ?? [],
  );
  const [seoValues, setSeoValues] = useState<SeoValues>(toSeoValues(content));
  const [scheduledForValue, setScheduledForValue] = useState(
    toDatetimeLocalValue(content?.scheduledFor),
  );
  const [scheduledForError, setScheduledForError] = useState<string | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftBanner, setDraftBanner] = useState<DraftSnapshot | null>(null);
  const [lastAutosavedAt, setLastAutosavedAt] = useState<Date | null>(null);
  const isFirstAutosaveRun = useRef(true);
  const [lockState, setLockState] = useState<LockState>(
    isEditing ? "checking" : "held",
  );
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const form = useForm<MetaValues>({
    resolver: zodResolver(metaSchema),
    defaultValues: {
      contentTypeId: content?.contentType.id ?? contentTypes[0]?.id ?? "",
      title: content?.title ?? "",
      slug: content?.slug ?? "",
      status: content?.status ?? "DRAFT",
    },
  });

  const watchedValues = form.watch();
  const selectedType = contentTypes.find(
    (type) => type.id === watchedValues.contentTypeId,
  );
  const editorFields =
    selectedType?.schema.fields.filter((field) => field.type === "richtext") ??
    [];
  const moduleFields =
    selectedType?.schema.fields.filter((field) => field.type === "modules") ??
    [];
  const settingsFields =
    selectedType?.schema.fields.filter(
      (field) => field.type !== "richtext" && field.type !== "modules",
    ) ?? [];

  // Beim Neuanlegen ist der Tab-Wechsel ein geführter Schritt-für-Schritt-
  // Ablauf (Einstellungen & SEO -> Designer, nur falls der Content-Type ein
  // "modules"-Feld hat): spätere Tabs sind erst klickbar, sobald der
  // vorherige Schritt erfolgreich validiert wurde (siehe `maxWizardStepIndex`).
  // Beim Bearbeiten eines bestehenden Inhalts bleiben alle Tabs wie bisher
  // frei wählbar. Nur noch zwei Tabs (Nutzervorgabe, 2026-08-18: "Seite
  // anlegen, bearbeiten: nur noch 2 Tabs. Einstellungen und SEO
  // zusammenlegen") – Einstellungen & SEO sind ein gemeinsamer Schritt.
  const isWizard = !isEditing;
  const wizardSteps =
    moduleFields.length > 0
      ? (["settingsSeo", "design"] as const)
      : (["settingsSeo"] as const);

  const [activeTab, setActiveTab] = useState(() =>
    !isEditing || moduleFields.length === 0 ? "settingsSeo" : "design",
  );
  const [maxWizardStepIndex, setMaxWizardStepIndex] = useState(0);

  function wizardStepIndex(step: string) {
    return (wizardSteps as readonly string[]).indexOf(step);
  }

  function goToTab(next: string) {
    if (isWizard && wizardStepIndex(next) > maxWizardStepIndex) return;
    setActiveTab(next);
  }

  // Wechselt automatisch zurück, falls der Design-Tab durch einen
  // Content-Type-Wechsel wegfällt (kein "modules"-Feld mehr vorhanden).
  useEffect(() => {
    if (moduleFields.length === 0) {
      setActiveTab((prev) => (prev === "design" ? "settingsSeo" : prev));
    }
  }, [moduleFields.length]);

  // Prüft beim Öffnen einmalig, ob im Browser noch ein nicht gespeicherter
  // Entwurf für diesen Inhalt (bzw. für "neuer Inhalt" dieses Content-Typs)
  // liegt, und bietet ihn zur Wiederherstellung an.
  useEffect(() => {
    if (!autosaveEnabled) return;
    try {
      const raw = localStorage.getItem(
        draftStorageKey(content, watchedValues.contentTypeId),
      );
      if (raw) {
        setDraftBanner(JSON.parse(raw) as DraftSnapshot);
      }
    } catch {
      // Kaputter/nicht vorhandener Entwurf – einfach ignorieren, kein
      // kritischer Pfad.
    }
    // Nur beim ersten Rendern prüfen, nicht bei jeder Content-Typ-Änderung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced Autosave: schreibt den aktuellen Bearbeitungsstand lokal in
  // den Browser, sobald sich etwas ändert – nicht beim ersten Render (das
  // wäre nur der unveränderte Server-Stand).
  useEffect(() => {
    if (!autosaveEnabled) return;
    if (isFirstAutosaveRun.current) {
      isFirstAutosaveRun.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      const snapshot: DraftSnapshot = {
        savedAt: new Date().toISOString(),
        title: watchedValues.title,
        slug: watchedValues.slug,
        status: watchedValues.status,
        scheduledForValue,
        categoryIds,
        tagIds,
        dataValues,
        moduleValues,
        seoValues,
      };
      if (!isDraftWorthSaving(snapshot)) return;
      try {
        localStorage.setItem(
          draftStorageKey(content, watchedValues.contentTypeId),
          JSON.stringify(snapshot),
        );
        setLastAutosavedAt(new Date());
        notifyLocalDraftsChanged();
      } catch {
        // localStorage kann in seltenen Fällen (Privatmodus, Kontingent
        // voll) fehlschlagen – Autosave ist best-effort, kein kritischer
        // Pfad, deshalb kein Fehler-UI dafür.
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [
    autosaveEnabled,
    content,
    watchedValues.title,
    watchedValues.slug,
    watchedValues.status,
    watchedValues.contentTypeId,
    scheduledForValue,
    categoryIds,
    tagIds,
    dataValues,
    moduleValues,
    seoValues,
  ]);

  // Bearbeitungssperre: verhindert, dass zwei Redakteure denselben Inhalt
  // gleichzeitig bearbeiten und sich gegenseitig überschreiben. Nur bei
  // bestehenden Inhalten relevant – ein noch nicht angelegter Inhalt kann
  // nicht kollidieren.
  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;

    async function acquireLock() {
      try {
        const res = await fetch(`/api/content/${content!.id}/lock`, {
          method: "POST",
        });
        if (cancelled) return;
        if (res.ok) {
          setLockState("held");
          setLockInfo(null);
        } else if (res.status === 409) {
          const body = await res.json().catch(() => null);
          setLockState("locked-by-other");
          setLockInfo(
            body?.lockedBy
              ? { lockedBy: body.lockedBy, lockedAt: body.lockedAt }
              : null,
          );
        } else {
          setLockState("error");
        }
      } catch {
        if (!cancelled) setLockState("error");
      }
    }

    acquireLock();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, content?.id]);

  // Heartbeat: verlängert die eigene Sperre, solange aktiv bearbeitet wird.
  useEffect(() => {
    if (!isEditing || lockState !== "held") return;
    const interval = setInterval(() => {
      fetch(`/api/content/${content!.id}/lock`, { method: "POST" }).catch(
        () => {},
      );
    }, LOCK_HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isEditing, lockState, content]);

  // Sperre wieder freigeben: beim Verlassen der Seite (Client-Navigation)
  // sowie best-effort beim Schließen des Tabs/Browsers.
  useEffect(() => {
    if (!isEditing) return;
    const contentId = content!.id;

    function releaseOnUnload() {
      navigator.sendBeacon?.(`/api/content/${contentId}/unlock`);
    }
    window.addEventListener("beforeunload", releaseOnUnload);
    return () => {
      window.removeEventListener("beforeunload", releaseOnUnload);
      fetch(`/api/content/${contentId}/unlock`, { method: "POST" }).catch(
        () => {},
      );
    };
  }, [isEditing, content]);

  async function handleForceUnlock() {
    if (!content) return;
    setIsUnlocking(true);
    try {
      await fetch(`/api/content/${content.id}/unlock`, { method: "POST" });
      setLockState("checking");
      const res = await fetch(`/api/content/${content.id}/lock`, {
        method: "POST",
      });
      setLockState(res.ok ? "held" : "error");
      setLockInfo(null);
    } finally {
      setIsUnlocking(false);
    }
  }

  function handleRestoreDraft() {
    if (!draftBanner) return;
    form.setValue("title", draftBanner.title);
    form.setValue("slug", draftBanner.slug);
    form.setValue("status", draftBanner.status);
    setSlugTouched(true);
    setScheduledForValue(draftBanner.scheduledForValue);
    setCategoryIds(draftBanner.categoryIds);
    setTagIds(draftBanner.tagIds ?? []);
    setDataValues(draftBanner.dataValues);
    setModuleValues(draftBanner.moduleValues ?? {});
    setSeoValues(draftBanner.seoValues);
    setDraftBanner(null);
  }

  function handleDiscardDraft() {
    try {
      localStorage.removeItem(
        draftStorageKey(content, watchedValues.contentTypeId),
      );
      notifyLocalDraftsChanged();
    } catch {
      // ignore
    }
    setDraftBanner(null);
  }

  // Verwirft alle aktuellen Änderungen (nicht nur den Entwurf) und lädt neu
  // vom Server – ein manueller partieller Reset über alle beteiligten
  // Felder (RHF + separate useState für Kategorien/Module/SEO/Zeitplan)
  // wäre fehleranfällig, ein Reload ist hier der robustere Weg.
  function handleDiscardChanges() {
    try {
      localStorage.removeItem(
        draftStorageKey(content, watchedValues.contentTypeId),
      );
      notifyLocalDraftsChanged();
    } catch {
      // ignore
    }
    window.location.reload();
  }

  function handleTypeChange(id: string | null) {
    if (!id) return;
    form.setValue("contentTypeId", id);
    setDataValues({});
    setModuleValues({});
    setDataErrors({});
  }

  function handleTitleChange(value: string) {
    form.setValue("title", value);
    if (!slugTouched) {
      form.setValue("slug", slugify(value));
    }
  }

  const isLockedByOther = isEditing && lockState === "locked-by-other";
  const lockBlocksEditing =
    isEditing && (lockState === "checking" || lockState === "locked-by-other");

  // Validiert nur die Felder des "Einstellungen"-Schritts (Meta-Formular +
  // dynamische Nicht-Modul-Felder + Veröffentlichungszeitpunkt) – dieselben
  // Regeln wie in `onSubmit`, aber ohne die Modul-Felder-Prüfung, die erst
  // im "Designer"-Schritt greift.
  async function validateSettingsStep(): Promise<boolean> {
    const metaValid = await form.trigger([
      "contentTypeId",
      "title",
      "slug",
      "status",
    ]);
    if (!metaValid) return false;

    const fields = selectedType?.schema.fields ?? [];
    const nextDataErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === "modules") continue;
      const raw = dataValues[field.name]?.trim() ?? "";
      if (field.required && !raw) {
        nextDataErrors[field.name] = "Pflichtfeld";
      }
    }
    if (Object.keys(nextDataErrors).length > 0) {
      setDataErrors((prev) => ({ ...prev, ...nextDataErrors }));
      return false;
    }

    if (form.getValues("status") === "SCHEDULED" && !scheduledForValue) {
      setScheduledForError(
        "Für einen geplanten Inhalt ist ein Veröffentlichungszeitpunkt erforderlich.",
      );
      return false;
    }
    setScheduledForError(null);
    return true;
  }

  // Validiert nur die Modul-Felder des "Designer"-Schritts.
  function validateDesignStep(): boolean {
    const fields = selectedType?.schema.fields ?? [];
    const nextDataErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.type !== "modules") continue;
      const instances = moduleValues[field.name] ?? [];
      if (field.required && instances.length === 0) {
        nextDataErrors[field.name] = "Mindestens ein Baustein erforderlich";
      }
    }
    if (Object.keys(nextDataErrors).length > 0) {
      setDataErrors((prev) => ({ ...prev, ...nextDataErrors }));
      return false;
    }
    return true;
  }

  async function handleWizardNext() {
    if (activeTab === "settingsSeo") {
      if (!(await validateSettingsStep())) return;
    } else if (activeTab === "design") {
      if (!validateDesignStep()) return;
    }
    const nextIndex = wizardStepIndex(activeTab) + 1;
    if (nextIndex >= wizardSteps.length) return;
    setMaxWizardStepIndex((prev) => Math.max(prev, nextIndex));
    setActiveTab(wizardSteps[nextIndex]);
  }

  function handleWizardBack() {
    const prevIndex = wizardStepIndex(activeTab) - 1;
    if (prevIndex < 0) return;
    setActiveTab(wizardSteps[prevIndex]);
  }

  // Baut Payload + Validierung wie zuvor `onSubmit`, gibt aber die
  // gespeicherte Content-ID zurück statt zu redirecten – wiederverwendet
  // sowohl vom normalen Speichern-Button als auch von "Vorschau öffnen"
  // (Phase B: Live-Vorschau-Integration), die nach dem Speichern auf der
  // Seite bleiben will statt zur Content-Liste zu wechseln.
  async function saveContent(values: MetaValues): Promise<string | null> {
    setFormError(null);

    const fields = selectedType?.schema.fields ?? [];
    const nextDataErrors: Record<string, string> = {};
    const data: Record<string, unknown> = {};

    for (const field of fields) {
      if (field.type === "modules") continue;
      const raw = dataValues[field.name]?.trim() ?? "";
      if (field.required && !raw) {
        nextDataErrors[field.name] = "Pflichtfeld";
        continue;
      }
      if (!raw) continue;
      data[field.name] = field.type === "number" ? Number(raw) : raw;
    }

    // Modul-Felder (Seiten-Designer): Array von Modul-Instanzen statt
    // einfachem String-Wert, deshalb separat behandelt.
    for (const field of fields) {
      if (field.type !== "modules") continue;
      const instances = moduleValues[field.name] ?? [];
      if (field.required && instances.length === 0) {
        nextDataErrors[field.name] = "Mindestens ein Baustein erforderlich";
        continue;
      }
      if (instances.length === 0) continue;
      data[field.name] = instances;
    }

    if (Object.keys(nextDataErrors).length > 0) {
      setDataErrors(nextDataErrors);
      return null;
    }
    setDataErrors({});

    if (values.status === "SCHEDULED" && !scheduledForValue) {
      setScheduledForError(
        "Für einen geplanten Inhalt ist ein Veröffentlichungszeitpunkt erforderlich.",
      );
      return null;
    }
    setScheduledForError(null);

    setIsSubmitting(true);
    try {
      const url = isEditing ? `/api/content/${content!.id}` : "/api/content";
      const method = isEditing ? "PATCH" : "POST";
      const seoPayload = {
        ...seoValues,
        twitterCard:
          seoValues.twitterCard === "none" ? null : seoValues.twitterCard,
      };
      const scheduledFor = scheduledForValue
        ? new Date(scheduledForValue).toISOString()
        : null;
      const body = isEditing
        ? {
            title: values.title,
            slug: values.slug,
            status: values.status,
            data,
            categoryIds,
            tagIds,
            scheduledFor,
            ...seoPayload,
          }
        : {
            ...values,
            data,
            categoryIds,
            tagIds,
            scheduledFor,
            ...seoPayload,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const resBody = await res.json().catch(() => null);

      if (!res.ok) {
        setFormError(
          resBody?.message ?? "Inhalt konnte nicht gespeichert werden.",
        );
        return null;
      }

      try {
        localStorage.removeItem(draftStorageKey(content, values.contentTypeId));
        notifyLocalDraftsChanged();
      } catch {
        // ignore
      }
      setLastAutosavedAt(null);

      return isEditing ? content!.id : (resBody?.id ?? null);
    } catch {
      setFormError("Server nicht erreichbar. Bitte später erneut versuchen.");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmit(values: MetaValues) {
    const id = await saveContent(values);
    if (!id) return;
    if (isEditing) toastEdited(`„${values.title}“ wurde gespeichert.`);
    else toastCreated(`„${values.title}“ wurde angelegt.`);
    router.push("/dashboard/content");
    router.refresh();
  }

  // "Vorschau öffnen": speichert wie der normale Submit, bleibt aber auf
  // der Bearbeiten-Seite und öffnet die interne, authentifizierte Vorschau
  // (`/dashboard/content/[id]/preview`) in neuem Tab – kein Freigabe-Link,
  // keine zeitliche Begrenzung. Freigabe-Links für Außenstehende erstellt
  // ausschließlich `PreviewLinksDialog` (siehe preview-links-dialog.tsx).
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);

  async function handleOpenPreview() {
    await form.handleSubmit(async (values) => {
      setIsOpeningPreview(true);
      try {
        const id = await saveContent(values);
        if (!id) return;
        window.open(`/dashboard/content/${id}/preview`, "_blank");
      } finally {
        setIsOpeningPreview(false);
      }
    })();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col"
      >
        <div className="flex flex-col gap-6">
          {isLockedByOther && (
            <SystemMessage
              variant="error"
              title="Wird gerade bearbeitet"
              description={`${
                lockInfo?.lockedBy
                  ? `Wird gerade bearbeitet von ${formatName(lockInfo.lockedBy)}`
                  : "Wird gerade von einer anderen Person bearbeitet"
              }${
                lockInfo?.lockedAt
                  ? ` seit ${new Date(lockInfo.lockedAt).toLocaleTimeString("de-DE")}`
                  : ""
              }. Änderungen sind gesperrt, bis die Bearbeitung dort beendet wird.`}
              actions={
                canForceUnlock && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isUnlocking}
                    onClick={handleForceUnlock}
                  >
                    {isUnlocking ? "Hebt auf…" : "Sperre aufheben"}
                  </Button>
                )
              }
            />
          )}

          {draftBanner && (
            <SystemMessage
              variant="warning"
              title="Nicht gespeicherter Entwurf gefunden"
              description={`Es gibt einen nicht gespeicherten Entwurf vom ${new Date(draftBanner.savedAt).toLocaleString("de-DE")}. Nur in diesem Browser gespeichert, nicht bei anderen Nutzern sichtbar.`}
              actions={
                <>
                  <Button type="button" size="sm" onClick={handleRestoreDraft}>
                    Wiederherstellen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDiscardDraft}
                  >
                    Verwerfen
                  </Button>
                </>
              }
            />
          )}

          {!draftBanner && !isLockedByOther && lastAutosavedAt && (
            <SystemMessage
              variant="warning"
              title="Ungespeicherte Änderungen"
              description="Du hast Änderungen an diesem Inhalt, die noch nicht gespeichert wurden."
              actions={
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-600 text-white hover:bg-amber-700"
                    disabled={isSubmitting}
                    onClick={() => form.handleSubmit(onSubmit)()}
                  >
                    {isSubmitting ? "Speichert…" : "Jetzt speichern"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDiscardChanges}
                  >
                    Verwerfen
                  </Button>
                </>
              }
            />
          )}

          <PageContent plain>
            <fieldset disabled={lockBlocksEditing} className="contents">
              <Tabs value={activeTab} onValueChange={goToTab}>
                <TabsList>
                  <TabsTrigger value="settingsSeo">
                    Einstellungen & SEO
                  </TabsTrigger>
                  {moduleFields.length > 0 && (
                    <TabsTrigger
                      value="design"
                      disabled={
                        isWizard &&
                        wizardStepIndex("design") > maxWizardStepIndex
                      }
                    >
                      Designer
                    </TabsTrigger>
                  )}
                </TabsList>

                {moduleFields.length > 0 && (
                  <TabsContent value="design">
                    <div className="flex flex-col gap-2">
                      {moduleFields.map((field) => (
                        <div key={field.name} className="flex flex-col gap-2">
                          <BlockEditorField
                            value={moduleValues[field.name] ?? []}
                            onChange={(next) =>
                              setModuleValues((prev) => ({
                                ...prev,
                                [field.name]: next,
                              }))
                            }
                            moduleTypes={moduleTypes}
                            globalModules={globalModules}
                          />
                          {dataErrors[field.name] && (
                            <p className="text-center text-sm text-destructive">
                              {dataErrors[field.name]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="settingsSeo">
                  <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                    <div className="flex flex-col gap-6">
                      <Card className="shadow-sm">
                        <CardContent className="flex flex-col gap-10">
                          <FormField
                            control={form.control}
                            name="contentTypeId"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center gap-1.5">
                                  <FormLabel required>Content-Type</FormLabel>
                                  <InfoTooltip text="Legt fest, welche Felder dieser Inhalt hat (z.B. Titel + Text). Kann nach dem Anlegen nicht mehr geändert werden." />
                                </div>
                                <Select
                                  value={field.value}
                                  onValueChange={handleTypeChange}
                                  disabled={isEditing}
                                  items={Object.fromEntries(
                                    contentTypes.map((type) => [
                                      type.id,
                                      type.name,
                                    ]),
                                  )}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Content-Type wählen" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {contentTypes.map((type) => (
                                      <SelectItem key={type.id} value={type.id}>
                                        {type.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {isEditing && (
                                  <p className="text-xs text-muted-foreground">
                                    Der Content-Type kann nachträglich nicht
                                    geändert werden.
                                  </p>
                                )}
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel required>Titel</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    onChange={(e) =>
                                      handleTitleChange(e.target.value)
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="slug"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center gap-1.5">
                                  <FormLabel required>Slug</FormLabel>
                                  <InfoTooltip text="Der URL-freundliche Teil der Adresse, z.B. wird aus „Mein Titel“ „mein-titel“. Wird automatisch aus dem Titel erzeugt, lässt sich aber manuell anpassen." />
                                </div>
                                <FormControl>
                                  <Input
                                    {...field}
                                    onChange={(e) => {
                                      setSlugTouched(true);
                                      field.onChange(e);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center gap-1.5">
                                  <FormLabel>Status</FormLabel>
                                  <InfoTooltip
                                    text={
                                      "Entwurf: nur intern sichtbar, noch nicht veröffentlicht.\n" +
                                      "Geplant: wird automatisch veröffentlicht, sobald der gewählte Zeitpunkt erreicht ist.\n" +
                                      "Veröffentlicht: öffentlich sichtbar.\n" +
                                      "Archiviert: nicht mehr aktiv, bleibt aber erhalten."
                                    }
                                  />
                                </div>
                                <SegmentedPicker
                                  value={field.value}
                                  onChange={field.onChange}
                                  options={(isEditing
                                    ? (Object.keys(
                                        statusLabel,
                                      ) as ContentStatus[])
                                    : ([
                                        "DRAFT",
                                        "PUBLISHED",
                                        "SCHEDULED",
                                      ] as const)
                                  ).map((value) => ({
                                    label: statusLabel[value],
                                    value,
                                  }))}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {watchedValues.status === "SCHEDULED" && (
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="scheduled-for" required>
                                Veröffentlichungszeitpunkt
                              </Label>
                              <DateTimePicker
                                id="scheduled-for"
                                value={scheduledForValue}
                                onChange={(next) => {
                                  setScheduledForValue(next);
                                  setScheduledForError(null);
                                }}
                              />
                              <p className="text-xs text-muted-foreground">
                                Wird automatisch veröffentlicht, sobald dieser
                                Zeitpunkt erreicht ist.
                              </p>
                              {scheduledForError && (
                                <p className="text-sm text-destructive">
                                  {scheduledForError}
                                </p>
                              )}
                            </div>
                          )}

                          {categories.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <Label>Kategorien</Label>
                              <Select
                                multiple
                                value={categoryIds}
                                onValueChange={(value) =>
                                  setCategoryIds(value ?? [])
                                }
                                items={Object.fromEntries(
                                  categories.map((category) => [
                                    category.id,
                                    category.name,
                                  ]),
                                )}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Kategorien wählen">
                                    {(value: string[]) =>
                                      value.length === 0
                                        ? "Keine Kategorie ausgewählt"
                                        : `${value.length} ${value.length === 1 ? "Kategorie" : "Kategorien"} ausgewählt`
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((category) => (
                                    <SelectItem
                                      key={category.id}
                                      value={category.id}
                                    >
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {categoryIds.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {categoryIds.map((id) => {
                                    const category = categories.find(
                                      (c) => c.id === id,
                                    );
                                    if (!category) return null;
                                    return (
                                      <Badge key={id} variant="secondary">
                                        {category.name}
                                        <button
                                          type="button"
                                          aria-label={`${category.name} entfernen`}
                                          onClick={() =>
                                            setCategoryIds((prev) =>
                                              prev.filter((c) => c !== id),
                                            )
                                          }
                                          className="ml-0.5 rounded-full hover:text-foreground"
                                        >
                                          <X className="size-3" />
                                        </button>
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {tags.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <Label>Tags</Label>
                              <Select
                                multiple
                                value={tagIds}
                                onValueChange={(value) => setTagIds(value ?? [])}
                                items={Object.fromEntries(
                                  tags.map((tag) => [tag.id, tag.name]),
                                )}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Tags wählen">
                                    {(value: string[]) =>
                                      value.length === 0
                                        ? "Kein Tag ausgewählt"
                                        : `${value.length} ${value.length === 1 ? "Tag" : "Tags"} ausgewählt`
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {tags.map((tag) => (
                                    <SelectItem key={tag.id} value={tag.id}>
                                      {tag.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {tagIds.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {tagIds.map((id) => {
                                    const tag = tags.find((t) => t.id === id);
                                    if (!tag) return null;
                                    return (
                                      <Badge key={id} variant="secondary" className="gap-1.5">
                                        <span
                                          className={cn(
                                            "size-1.5 rounded-full",
                                            tagDotColor(tag.id),
                                          )}
                                        />
                                        {tag.name}
                                        <button
                                          type="button"
                                          aria-label={`${tag.name} entfernen`}
                                          onClick={() =>
                                            setTagIds((prev) =>
                                              prev.filter((t) => t !== id),
                                            )
                                          }
                                          className="ml-0.5 rounded-full hover:text-foreground"
                                        >
                                          <X className="size-3" />
                                        </button>
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {settingsFields.length > 0 && (
                            <div className="flex flex-col gap-4 rounded-xl bg-muted/30 p-4">
                              <p className="text-sm font-medium">
                                {selectedType?.name} – Felder
                              </p>
                              {settingsFields.map((field) => (
                                <div
                                  key={field.name}
                                  className="flex flex-col gap-2"
                                >
                                  <Label
                                    htmlFor={`data-${field.name}`}
                                    required={field.required}
                                  >
                                    {field.name}
                                  </Label>
                                  {field.type === "text" ? (
                                    <Textarea
                                      id={`data-${field.name}`}
                                      rows={6}
                                      value={dataValues[field.name] ?? ""}
                                      onChange={(e) =>
                                        setDataValues((prev) => ({
                                          ...prev,
                                          [field.name]: e.target.value,
                                        }))
                                      }
                                    />
                                  ) : (
                                    <Input
                                      id={`data-${field.name}`}
                                      type={
                                        field.type === "number"
                                          ? "number"
                                          : "text"
                                      }
                                      value={dataValues[field.name] ?? ""}
                                      onChange={(e) =>
                                        setDataValues((prev) => ({
                                          ...prev,
                                          [field.name]: e.target.value,
                                        }))
                                      }
                                    />
                                  )}
                                  {dataErrors[field.name] && (
                                    <p className="text-sm text-destructive">
                                      {dataErrors[field.name]}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {editorFields.length > 0 && (
                        <Card className="flex h-full flex-col shadow-sm">
                          <CardContent className="flex flex-1 flex-col gap-10">
                            {editorFields.map((field) => (
                              <div
                                key={field.name}
                                className="flex min-h-0 flex-1 flex-col gap-2"
                              >
                                <Label
                                  htmlFor={`data-${field.name}`}
                                  required={field.required}
                                >
                                  {field.name}
                                </Label>
                                <RichTextEditor
                                  id={`data-${field.name}`}
                                  value={dataValues[field.name] ?? ""}
                                  editable={!lockBlocksEditing}
                                  onChange={(html) =>
                                    setDataValues((prev) => ({
                                      ...prev,
                                      [field.name]: html,
                                    }))
                                  }
                                />
                                {dataErrors[field.name] && (
                                  <p className="text-sm text-destructive">
                                    {dataErrors[field.name]}
                                  </p>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <div className="flex flex-col gap-6">
                      <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center gap-3 border-b">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/25 text-pivot-navy">
                            <Search className="size-4" />
                          </span>
                          <CardTitle>SEO & Sichtbarkeit</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-10">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1.5">
                              <Label htmlFor="seo-excerpt">
                                Kurzbeschreibung (Excerpt)
                              </Label>
                              <InfoTooltip text="Kurze Zusammenfassung, z.B. für Listenansichten oder als Vorschautext." />
                            </div>
                            <Textarea
                              id="seo-excerpt"
                              rows={3}
                              value={seoValues.excerpt}
                              onChange={(e) =>
                                setSeoValues((prev) => ({
                                  ...prev,
                                  excerpt: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1.5">
                              <Label htmlFor="seo-title">SEO-Titel</Label>
                              <InfoTooltip text="Wird als Seitentitel in Suchergebnissen angezeigt, falls gesetzt – sonst der normale Titel." />
                            </div>
                            <Input
                              id="seo-title"
                              value={seoValues.seoTitle}
                              onChange={(e) =>
                                setSeoValues((prev) => ({
                                  ...prev,
                                  seoTitle: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1.5">
                              <Label htmlFor="seo-description">
                                Meta-Description
                              </Label>
                              <InfoTooltip text="Kurzbeschreibung für Suchergebnisse, empfohlen ca. 150–160 Zeichen." />
                            </div>
                            <Textarea
                              id="seo-description"
                              rows={3}
                              value={seoValues.seoDescription}
                              onChange={(e) =>
                                setSeoValues((prev) => ({
                                  ...prev,
                                  seoDescription: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1.5">
                              <Label htmlFor="seo-canonical">
                                Canonical-URL
                              </Label>
                              <InfoTooltip text="Offizielle URL, falls dieser Inhalt auch unter einer anderen Adresse erreichbar ist – verhindert doppelten Content bei Suchmaschinen." />
                            </div>
                            <Input
                              id="seo-canonical"
                              placeholder="https://example.com/pfad"
                              value={seoValues.canonicalUrl}
                              onChange={(e) =>
                                setSeoValues((prev) => ({
                                  ...prev,
                                  canonicalUrl: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between gap-4 py-2">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <Label htmlFor="seo-robots-index">
                                  Indexierung erlauben
                                </Label>
                                <InfoTooltip text="Steuert, ob Suchmaschinen diesen Inhalt in ihren Index aufnehmen dürfen." />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Deaktiviert: Suchmaschinen wird `noindex`
                                mitgeteilt.
                              </p>
                            </div>
                            <Switch
                              id="seo-robots-index"
                              checked={seoValues.robotsIndex}
                              onCheckedChange={(checked) =>
                                setSeoValues((prev) => ({
                                  ...prev,
                                  robotsIndex: checked,
                                }))
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between gap-4 py-2">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <Label htmlFor="seo-robots-follow">
                                  Link-Folgen erlauben
                                </Label>
                                <InfoTooltip text="Steuert, ob Suchmaschinen ausgehenden Links auf dieser Seite folgen dürfen." />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Deaktiviert: Suchmaschinen wird `nofollow`
                                mitgeteilt.
                              </p>
                            </div>
                            <Switch
                              id="seo-robots-follow"
                              checked={seoValues.robotsFollow}
                              onCheckedChange={(checked) =>
                                setSeoValues((prev) => ({
                                  ...prev,
                                  robotsFollow: checked,
                                }))
                              }
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </fieldset>

            {formError && (
              <SystemMessage
                variant="error"
                title="Speichern fehlgeschlagen"
                description={formError}
              />
            )}
          </PageContent>
        </div>

        <PageContent
          plain
          className="mt-10 flex-row flex-wrap items-center gap-3"
        >
          {isWizard && activeTab !== wizardSteps[0] && (
            <Button
              key="wizard-back"
              type="button"
              variant="outline"
              disabled={lockBlocksEditing}
              onClick={handleWizardBack}
            >
              Zurück
            </Button>
          )}
          {isWizard && activeTab !== wizardSteps[wizardSteps.length - 1] ? (
            <Button
              key="wizard-next"
              type="button"
              disabled={lockBlocksEditing}
              onClick={handleWizardNext}
            >
              Weiter
            </Button>
          ) : (
            <Button
              key="submit"
              type="submit"
              disabled={isSubmitting || lockBlocksEditing}
            >
              {isSubmitting
                ? "Speichert…"
                : isEditing
                  ? "Änderungen speichern"
                  : "Inhalt speichern"}
            </Button>
          )}
          {isEditing &&
            (!isWizard ||
              activeTab === wizardSteps[wizardSteps.length - 1]) && (
              <Button
                key="open-preview"
                type="button"
                variant="outline"
                disabled={isSubmitting || isOpeningPreview || lockBlocksEditing}
                onClick={handleOpenPreview}
              >
                {isOpeningPreview ? "Öffnet…" : "Vorschau öffnen"}
              </Button>
            )}
          {autosaveEnabled && lastAutosavedAt && (
            <p className="text-xs text-muted-foreground">
              Entwurf lokal gespeichert um{" "}
              {lastAutosavedAt.toLocaleTimeString("de-DE")}
            </p>
          )}
        </PageContent>
      </form>
    </Form>
  );
}
