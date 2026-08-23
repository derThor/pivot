"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  CircleDot,
  Eye,
  Hash,
  Heading,
  Info,
  List,
  Mail as MailIcon,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  toastCreated,
  toastDeleted,
  toastEdited,
} from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { SegmentedPicker } from "@/components/segmented-picker";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { cn } from "@/lib/utils";
import type {
  ContentListItem,
  FormDetail,
  FormFieldOption,
  FormStatus,
  MailTemplateListItem,
} from "@/lib/api-server";

interface PaletteEntry {
  type: string;
  label: string;
  icon: typeof AlignLeft;
  hasOptions?: boolean;
}

const PALETTE: { group: string; entries: PaletteEntry[] }[] = [
  {
    group: "Basis",
    entries: [
      { type: "text", label: "Text", icon: AlignLeft },
      { type: "textarea", label: "Textbereich", icon: List },
      { type: "email", label: "E-Mail", icon: MailIcon },
      { type: "tel", label: "Telefon", icon: Phone },
      { type: "number", label: "Zahl", icon: Hash },
    ],
  },
  {
    group: "Auswahl",
    entries: [
      {
        type: "select",
        label: "Dropdown",
        icon: ChevronDown,
        hasOptions: true,
      },
      {
        type: "radio",
        label: "Einzelauswahl",
        icon: CircleDot,
        hasOptions: true,
      },
      {
        type: "checkbox",
        label: "Mehrfachauswahl",
        icon: CheckSquare,
        hasOptions: true,
      },
    ],
  },
  {
    group: "Erweitert",
    entries: [
      { type: "date", label: "Datum", icon: Calendar },
      { type: "section", label: "Abschnitt", icon: Heading },
      {
        type: "privacy_notice",
        label: "Datenschutzhinweis",
        icon: ShieldCheck,
      },
    ],
  },
];

const PALETTE_GROUPS = PALETTE.map((g) => g.group);
const ALL_ENTRIES = PALETTE.flatMap((g) => g.entries);
const TYPE_LABELS = Object.fromEntries(
  ALL_ENTRIES.map((e) => [e.type, e.label]),
);
const TYPE_ICONS = Object.fromEntries(ALL_ENTRIES.map((e) => [e.type, e.icon]));

const STATUS_OPTIONS: { value: FormStatus; label: string }[] = [
  { value: "draft", label: "Entwurf" },
  { value: "published", label: "Live" },
  { value: "paused", label: "Pausiert" },
];

// Pseudo-Auswahl für den Absenden-Button im Aufbau-Canvas (siehe
// FormCanvas/FieldPropertiesPanel) – kollidiert nie mit einer echten
// Feld-Id, da `generateFieldId()` immer "feld_"/"heading_"-Präfixe vergibt.
const SUBMIT_SENTINEL = "__submit__";
type SubmitButtonAlign = "left" | "center" | "right";
const SUBMIT_ALIGN_CLASSES: Record<SubmitButtonAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

// Nur veröffentlichte Seiten sind sinnvoll verlinkbar – gleiches Prinzip
// wie `loadPublishedForms()` in module-field-input.tsx (einmaliger Abruf
// pro Editor-Sitzung, gecacht).
let pagesCache: Promise<ContentListItem[]> | null = null;
function loadPublishedPages(): Promise<ContentListItem[]> {
  if (!pagesCache) {
    pagesCache = fetch("/api/content?status=PUBLISHED&pageSize=100")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.items ?? [])
      .catch(() => []);
  }
  return pagesCache;
}

let fieldCounter = 0;
function generateFieldId(existing: FormFieldOption[]): string {
  fieldCounter += 1;
  let id = `feld_${existing.length + fieldCounter}`;
  while (existing.some((f) => f.id === id)) {
    fieldCounter += 1;
    id = `feld_${existing.length + fieldCounter}`;
  }
  return id;
}

function defaultFields(): FormFieldOption[] {
  return [
    {
      id: "heading_1",
      type: "section",
      label: "Ihre Anfrage",
      helpText: "Wir melden uns innerhalb von 24 Stunden.",
      required: false,
      width: 100,
    },
  ];
}

/** Statische, nicht ausfüllbare Darstellung eines Feld-Typs – für die
 * Live-Vorschau im Editor (Aufbau-Canvas + "Vorschau"-Dialog). Bewusst
 * keine echten, kontrollierten Inputs (kein `value`/`onChange`): die
 * Werte hier haben keine Bedeutung, es geht nur um die Struktur. */
function FieldPreviewControl({ field }: { field: FormFieldOption }) {
  if (field.type === "textarea") {
    return <Textarea rows={3} disabled placeholder={field.label} />;
  }
  if (field.type === "select") {
    return (
      <Select disabled value="">
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Bitte wählen" />
        </SelectTrigger>
        <SelectContent>{null}</SelectContent>
      </Select>
    );
  }
  if (field.type === "radio") {
    return (
      <div
        className={cn(
          "flex gap-1.5",
          field.optionsLayout === "horizontal"
            ? "flex-row flex-wrap gap-x-4"
            : "flex-col",
        )}
      >
        {(field.options ?? []).map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <input type="radio" disabled className="size-4" />
            {opt}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <div
        className={cn(
          "flex gap-1.5",
          field.optionsLayout === "horizontal"
            ? "flex-row flex-wrap gap-x-4"
            : "flex-col",
        )}
      >
        {(field.options ?? []).map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Checkbox disabled />
            {opt}
          </label>
        ))}
      </div>
    );
  }
  return (
    <Input
      disabled
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text"
      }
    />
  );
}

function FieldPreview({ field }: { field: FormFieldOption }) {
  if (field.type === "privacy_notice") {
    return (
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <Checkbox disabled />
          <span>
            {field.label || "…"}
            {field.required && <span className="text-red-500"> *</span>}
          </span>
        </label>
        {field.helpText && (
          <p className="pl-6 text-xs text-muted-foreground">{field.helpText}</p>
        )}
        {field.privacyPageSlug && (
          <p className="pl-6 text-xs text-primary underline underline-offset-2">
            {field.privacyPageTitle || "Datenschutzerklärung"}
          </p>
        )}
      </div>
    );
  }
  if (field.type === "section") {
    return (
      <div className="flex flex-col gap-1">
        {field.showLabel !== false && (
          <h3 className="text-base font-semibold">{field.label || "…"}</h3>
        )}
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {field.showLabel !== false && (
        <Label>
          {field.label || "…"}
          {field.required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      <FieldPreviewControl field={field} />
    </div>
  );
}

/** Rein darstellende Live-Vorschau (Name/Slug-Kopfzeile + Felder +
 * Absenden-Fußzeile) – gemeinsam genutzt vom Aufbau-Canvas (mit
 * Auswahl-Overlay) und dem "Vorschau"-Dialog (ohne). */
function FormCanvas({
  name,
  slug,
  fields,
  submitButtonText = "Absenden",
  submitButtonAlign = "left",
  selectedId,
  onSelect,
  onReorderStep,
  onReorderDrop,
  onResize,
  onRemove,
}: {
  name: string;
  slug: string;
  fields: FormFieldOption[];
  submitButtonText?: string;
  submitButtonAlign?: "left" | "center" | "right";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Pfeiltasten-Umsortieren (Barrierefreiheit) – ein Schritt je Aufruf. */
  onReorderStep?: (index: number, direction: -1 | 1) => void;
  /** Ziehen&Ablegen – gleiches Muster wie `gallery-editor.tsx`. */
  onReorderDrop?: (draggedId: string, targetId: string) => void;
  /** Breite per Zieh-Griff ändern – gleiches Muster wie der Bild-Baustein
   * im Seiten-Designer (`block-editor-field.tsx` `startResize`). */
  onResize?: (id: string, width: number) => void;
  onRemove?: (id: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>, index: number) {
    if (!onReorderStep) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onReorderStep(index, -1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onReorderStep(index, 1);
    }
  }

  function startResize(e: ReactPointerEvent, field: FormFieldOption) {
    if (!onResize) return;
    e.preventDefault();
    e.stopPropagation();
    const rowWidth = rowRef.current?.getBoundingClientRect().width;
    if (!rowWidth) return;
    const startX = e.clientX;
    const startWidth = field.width;
    setResizingId(field.id);

    function onMove(ev: PointerEvent) {
      const deltaPct = ((ev.clientX - startX) / rowWidth!) * 100;
      const nextWidth = Math.round(
        Math.min(100, Math.max(20, startWidth + deltaPct)),
      );
      onResize!(field.id, nextWidth);
    }
    function onUp() {
      setResizingId(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold">{name || "Neues Formular"}</h2>
        <span className="shrink-0 rounded-md bg-[#F4F4F5] px-2 py-1 font-mono text-xs text-muted-foreground">
          /{slug || "neues-formular"}
        </span>
      </div>

      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Noch keine Felder. Links ein Feld aus der Palette wählen.
        </div>
      ) : (
        <div ref={rowRef} className="flex flex-wrap gap-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              draggable={Boolean(onReorderDrop) && resizingId === null}
              onDragStart={() => setDraggedId(field.id)}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                if (!onReorderDrop) return;
                e.preventDefault();
                setDragOverId(field.id);
              }}
              onDragLeave={() =>
                setDragOverId((current) =>
                  current === field.id ? null : current,
                )
              }
              onDrop={(e) => {
                if (!onReorderDrop) return;
                e.preventDefault();
                setDragOverId(null);
                if (draggedId && draggedId !== field.id) {
                  onReorderDrop(draggedId, field.id);
                }
                setDraggedId(null);
              }}
              onClick={() => onSelect?.(field.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "group/field relative w-full sm:w-[var(--field-w)]",
                onReorderDrop && "cursor-grab active:cursor-grabbing",
                onSelect &&
                  cn(
                    "rounded-lg border-2 p-3 transition-colors",
                    field.id === selectedId
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-border",
                    dragOverId === field.id &&
                      draggedId !== field.id &&
                      "border-primary",
                  ),
              )}
              style={{ "--field-w": `${field.width}%` } as CSSProperties}
            >
              <FieldPreview field={field} />

              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(field.id);
                  }}
                  aria-label="Feld entfernen"
                  className="absolute top-1.5 right-1.5 hidden size-5 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/90 group-hover/field:flex"
                >
                  <X className="size-3" />
                </button>
              )}

              {onResize && (
                <div
                  onPointerDown={(e) => startResize(e, field)}
                  onDragStart={(e) => e.preventDefault()}
                  draggable={false}
                  className={cn(
                    "absolute right-0.5 bottom-0.5 size-3.5 cursor-ew-resize rounded-sm border-2 border-white bg-orange-500 opacity-0 shadow transition-opacity group-hover/field:opacity-100",
                    resizingId === field.id && "opacity-100",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-[#F0F0F0] pt-4">
        <p className="text-xs text-muted-foreground">
          Ihre Daten werden verschlüsselt übertragen.
        </p>
        <div
          role={onSelect ? "button" : undefined}
          tabIndex={onSelect ? 0 : undefined}
          onClick={() => onSelect?.(SUBMIT_SENTINEL)}
          className={cn(
            "flex",
            SUBMIT_ALIGN_CLASSES[submitButtonAlign],
            onSelect &&
              cn(
                "-m-2 cursor-pointer rounded-lg border-2 p-2 transition-colors",
                selectedId === SUBMIT_SENTINEL
                  ? "border-primary bg-primary/5"
                  : "border-transparent hover:border-border",
              ),
          )}
        >
          <Button type="button" disabled className="pointer-events-none">
            {submitButtonText || "Absenden"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Linke Kachel "Feld hinzufügen" – immer sichtbar, unabhängig vom
 * aktiven Tab (siehe FormEditor: nur die mittlere Spalte tabbt sich um,
 * Palette links und Eigenschaften rechts bleiben stehen). */
function FieldPalette({
  activeGroup,
  onGroupChange,
  onAdd,
}: {
  activeGroup: string;
  onGroupChange: (group: string) => void;
  onAdd: (entry: PaletteEntry) => void;
}) {
  const currentGroup =
    PALETTE.find((g) => g.group === activeGroup) ?? PALETTE[0];
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-3 shadow-sm">
      <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Feld hinzufügen
      </p>
      <SegmentedPicker
        value={activeGroup}
        onChange={onGroupChange}
        options={PALETTE_GROUPS.map((group) => ({
          label: group,
          value: group,
        }))}
      />
      <div className="flex flex-col gap-2">
        {currentGroup.entries.map((entry) => (
          <button
            key={entry.type}
            type="button"
            onClick={() => onAdd(entry)}
            className="flex items-center justify-between gap-2 rounded-lg border border-[#F0F0F0] px-3 py-2 text-left text-sm transition-colors hover:border-[#D4D4D4] hover:bg-[#F4F4F5]"
          >
            <span className="flex items-center gap-2">
              <entry.icon className="size-4 text-muted-foreground" />
              {entry.label}
            </span>
            <Plus className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
      {/* Gleiche Info-Farbtöne wie `ui/system-message.tsx` (Variante
          "info"), aber ohne dessen fett gesetzten Titel-Text – hier reicht
          ein einzeiliger, normal gewichteter Hinweis. */}
      <div className="flex gap-2 rounded-xl border border-lime-200 bg-lime-50 p-3 dark:border-lime-900 dark:bg-lime-950/40">
        <Info className="mt-0.5 size-4 shrink-0 text-lime-700 dark:text-lime-500" />
        <p className="text-sm text-muted-foreground">
          Felder lassen sich in der Mitte per Ziehen umsortieren.
        </p>
      </div>
    </div>
  );
}

/** Dropdown zur Auswahl einer bestehenden (veröffentlichten) Seite für den
 * "Datenschutzhinweis"-Feldtyp – speichert Slug+Titel als Snapshot direkt
 * am Feld (siehe `FormField.privacyPageSlug`-Kommentar), keine Live-
 * Verknüpfung über eine Content-Id. */
function PrivacyPagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (page: ContentListItem | undefined) => void;
}) {
  const [pages, setPages] = useState<ContentListItem[] | null>(null);

  useEffect(() => {
    let active = true;
    loadPublishedPages().then((items) => {
      if (active) setPages(items);
    });
    return () => {
      active = false;
    };
  }, []);

  if (pages === null) {
    return (
      <p className="text-sm text-muted-foreground">Seiten werden geladen …</p>
    );
  }

  const items = Object.fromEntries([
    ["", "Keine Verlinkung"],
    ...pages.map((p) => [p.slug, p.title]),
  ]);

  return (
    <Select
      value={value}
      onValueChange={(slug) => onChange(pages.find((p) => p.slug === slug))}
      items={items}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Keine Verlinkung" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Keine Verlinkung</SelectItem>
        {pages.map((page) => (
          <SelectItem key={page.id} value={page.slug}>
            {page.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Rechte Kachel im Zustand "Absenden-Button ausgewählt" (siehe
 * `SUBMIT_SENTINEL` in `FormCanvas`) – Geschwister von
 * `FieldPropertiesPanel`, kein echtes Formularfeld also eigene Kachel
 * statt eines weiteren Sonderfalls dort. */
function SubmitButtonPropertiesPanel({
  text,
  align,
  redirectUrl,
  onTextChange,
  onAlignChange,
  onRedirectUrlChange,
}: {
  text: string;
  align: SubmitButtonAlign;
  redirectUrl: string;
  onTextChange: (text: string) => void;
  onAlignChange: (align: SubmitButtonAlign) => void;
  onRedirectUrlChange: (url: string) => void;
}) {
  return (
    <div className="rounded-xl bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-[#F0F0F0] pb-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Send className="size-4" />
          </span>
          <p className="font-semibold">Absenden-Button</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="submit-text"
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Text
          </Label>
          <Input
            id="submit-text"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
          />
        </div>

        <SegmentedPicker
          label="Ausrichtung"
          value={align}
          onChange={onAlignChange}
          options={[
            { label: "Links", value: "left" },
            { label: "Mitte", value: "center" },
            { label: "Rechts", value: "right" },
          ]}
        />

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="submit-redirect"
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Weiterleitung nach Absenden
          </Label>
          <Input
            id="submit-redirect"
            value={redirectUrl}
            onChange={(e) => onRedirectUrlChange(e.target.value)}
            placeholder="Optional, z. B. /danke"
          />
          <p className="text-xs text-muted-foreground">
            Leer lassen für die eingebaute „Vielen Dank&quot;-Meldung.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Rechte Kachel "Eigenschaften" – wie `FieldPalette` immer sichtbar,
 * zeigt das zuletzt im Aufbau-Canvas ausgewählte Feld. */
function FieldPropertiesPanel({
  selected,
  selectedIndex,
  total,
  onUpdate,
  onRemove,
}: {
  selected: FormFieldOption | null;
  selectedIndex: number;
  total: number;
  onUpdate: (id: string, patch: Partial<FormFieldOption>) => void;
  onRemove: (id: string) => void;
}) {
  const SelectedIcon = selected
    ? (TYPE_ICONS[selected.type] ?? AlignLeft)
    : AlignLeft;

  return (
    <div className="rounded-xl bg-card p-3 shadow-sm">
      {!selected ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Feld auswählen, um es zu bearbeiten.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 border-b border-[#F0F0F0] pb-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <SelectedIcon className="size-4" />
            </span>
            <div>
              <p className="font-semibold">
                {TYPE_LABELS[selected.type] ?? selected.type}
              </p>
              <p className="text-sm text-muted-foreground">
                Feld {selectedIndex + 1} von {total}
              </p>
            </div>
          </div>

          {selected.type !== "privacy_notice" && (
            <div className="flex items-center justify-between">
              <Label htmlFor="field-show-label">Titel anzeigen</Label>
              <Switch
                id="field-show-label"
                checked={selected.showLabel !== false}
                onCheckedChange={(checked) =>
                  onUpdate(selected.id, { showLabel: checked })
                }
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="field-label"
              className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Titel
            </Label>
            <Input
              id="field-label"
              value={selected.label}
              onChange={(e) => onUpdate(selected.id, { label: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="field-help"
              className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Hinweistext
            </Label>
            <Input
              id="field-help"
              value={selected.helpText ?? ""}
              onChange={(e) =>
                onUpdate(selected.id, { helpText: e.target.value })
              }
              placeholder="Optional"
            />
          </div>

          {selected.type !== "section" && (
            <div className="flex items-center justify-between">
              <Label htmlFor="field-required">Pflichtfeld</Label>
              <Switch
                id="field-required"
                checked={selected.required}
                onCheckedChange={(checked) =>
                  onUpdate(selected.id, { required: checked })
                }
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Breite
              </Label>
              <span className="text-xs text-muted-foreground">
                {selected.width}%
              </span>
            </div>
            <SegmentedPicker
              value={selected.width}
              onChange={(width) => onUpdate(selected.id, { width })}
              options={[
                { label: "Halb", value: 50 },
                { label: "Voll", value: 100 },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Oder im Aufbau-Canvas per Zieh-Griff (unten rechts am Feld)
              stufenlos anpassen.
            </p>
          </div>

          {(selected.type === "select" ||
            selected.type === "radio" ||
            selected.type === "checkbox") && (
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="field-options"
                className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                Optionen (eine je Zeile)
              </Label>
              <Textarea
                id="field-options"
                rows={4}
                value={(selected.options ?? []).join("\n")}
                onChange={(e) =>
                  onUpdate(selected.id, {
                    options: e.target.value
                      .split("\n")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          )}

          {(selected.type === "radio" || selected.type === "checkbox") && (
            <SegmentedPicker
              label="Anordnung"
              value={selected.optionsLayout ?? "vertical"}
              onChange={(optionsLayout) =>
                onUpdate(selected.id, { optionsLayout })
              }
              options={[
                { label: "Untereinander", value: "vertical" },
                { label: "Nebeneinander", value: "horizontal" },
              ]}
            />
          )}

          {selected.type === "privacy_notice" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Datenschutzseite verlinken
              </Label>
              <PrivacyPagePicker
                value={selected.privacyPageSlug ?? ""}
                onChange={(page) =>
                  onUpdate(selected.id, {
                    privacyPageSlug: page?.slug,
                    privacyPageTitle: page?.title,
                  })
                }
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Feld-ID
            </Label>
            <div className="rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-2 text-sm text-muted-foreground">
              {selected.id}
            </div>
            <p className="text-xs text-muted-foreground">
              Platzhalter in Mail-Vorlagen: {`{{${selected.id}}}`}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-[#D4D4D4] text-destructive hover:bg-destructive/5"
            onClick={() => onRemove(selected.id)}
          >
            <Trash2 className="size-4" />
            Feld entfernen
          </Button>
        </div>
      )}
    </div>
  );
}

export function FormEditor({
  form,
  adminTemplate,
}: {
  /** `null` = Neu anlegen (siehe `/dashboard/forms/new`). */
  form: FormDetail | null;
  adminTemplate: MailTemplateListItem | null;
}) {
  const router = useRouter();
  const isNew = form === null;
  const [name, setName] = useState(form?.name ?? "Neues Formular");
  const [slug, setSlug] = useState(form?.slug ?? "neues-formular");
  const [status, setStatus] = useState<FormStatus>(form?.status ?? "draft");
  const [fields, setFields] = useState<FormFieldOption[]>(
    form?.fields ?? defaultFields(),
  );
  const [emailFieldId, setEmailFieldId] = useState<string>(
    form?.emailFieldId ?? "",
  );
  const [sendConfirmation, setSendConfirmation] = useState(
    form?.sendConfirmation ?? false,
  );
  const [submitButtonText, setSubmitButtonText] = useState(
    form?.submitButtonText ?? "Absenden",
  );
  const [submitButtonAlign, setSubmitButtonAlign] = useState<SubmitButtonAlign>(
    form?.submitButtonAlign ?? "left",
  );
  const [redirectUrl, setRedirectUrl] = useState(form?.redirectUrl ?? "");
  const [recipientMode, setRecipientMode] = useState<"shared" | "custom">(
    adminTemplate?.recipientTo ? "custom" : "shared",
  );
  const [recipientTo, setRecipientTo] = useState(
    adminTemplate?.recipientTo ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("aufbau");
  const [activeGroup, setActiveGroup] = useState(PALETTE_GROUPS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(
    fields[0]?.id ?? null,
  );

  const selected = fields.find((f) => f.id === selectedId) ?? null;
  const selectedIndex = fields.findIndex((f) => f.id === selectedId);
  const emailFields = fields.filter((f) => f.type === "email");
  const requiredCount = fields.filter((f) => f.required).length;

  function addField(entry: PaletteEntry) {
    const id = generateFieldId(fields);
    const isPrivacyNotice = entry.type === "privacy_notice";
    const next: FormFieldOption = {
      id,
      type: entry.type,
      label: isPrivacyNotice
        ? "Ich habe die Datenschutzerklärung gelesen und stimme zu."
        : entry.label,
      required: isPrivacyNotice,
      width: 100,
      ...(entry.hasOptions ? { options: ["Option 1", "Option 2"] } : {}),
    };
    setFields([...fields, next]);
    setSelectedId(id);
  }

  function updateField(id: string, patch: Partial<FormFieldOption>) {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    setFields(fields.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  }

  /** Ziehen&Ablegen im Aufbau-Canvas – gleiches Muster wie
   * `gallery-editor.tsx` `handleDrop()`. */
  function moveFieldByDrop(draggedId: string, targetId: string) {
    const next = [...fields];
    const fromIndex = next.findIndex((f) => f.id === draggedId);
    const toIndex = next.findIndex((f) => f.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setFields(next);
  }

  const primaryLabel = isSaving
    ? "Speichert…"
    : status === "published"
      ? "Speichern"
      : "Speichern & veröffentlichen";

  async function syncRecipient() {
    if (!adminTemplate) return;
    await fetch(
      `/api/settings/mail-templates/${encodeURIComponent(adminTemplate.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientTo: recipientMode === "custom" ? recipientTo : "",
        }),
      },
    );
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const payload = {
        name,
        slug,
        fields,
        emailFieldId: emailFieldId || undefined,
        sendConfirmation,
        submitButtonText: submitButtonText || "Absenden",
        submitButtonAlign,
        redirectUrl,
      };

      const res = await fetch(isNew ? "/api/forms" : `/api/forms/${form!.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }

      // "Speichern & veröffentlichen" (primaryLabel) setzt bei Bedarf auch
      // den Status – Neuanlage startet laut FormsService.create() immer
      // als Entwurf, eine bestehende, noch nicht veröffentlichte
      // Bearbeitung soll der Button-Beschriftung entsprechend live gehen.
      const formId = isNew ? data.id : form!.id;
      if (status !== "published") {
        await fetch(`/api/forms/${formId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        setStatus("published");
      }

      if (isNew) {
        toastCreated(`„${name}“ wurde veröffentlicht.`);
        router.push(`/dashboard/forms/${formId}`);
        return;
      }

      await syncRecipient();
      toastEdited(`„${name}“ wurde gespeichert.`);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(next: FormStatus) {
    if (!form) return;
    setStatus(next);
    await fetch(`/api/forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    toastEdited(
      next === "published"
        ? "Formular ist jetzt live."
        : next === "paused"
          ? "Formular wurde pausiert."
          : "Formular ist jetzt ein Entwurf.",
    );
    router.refresh();
  }

  async function handleDelete() {
    if (!form) return;
    await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
    toastDeleted(`„${name}“ wurde gelöscht.`);
    router.push("/dashboard/forms");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? "Neues Formular" : name}
          </h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-[#D4D4D4]"
            render={<Link href="/dashboard/forms" />}
          >
            <ChevronLeft className="size-4" />
            Zurück
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[#D4D4D4]"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="size-4" />
            Vorschau
          </Button>
          <Button type="button" disabled={isSaving} onClick={handleSave}>
            {primaryLabel}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Nur die mittlere Spalte tabbt sich um (Nutzervorgabe) – Palette
          links und Eigenschaften-Panel rechts bleiben über alle drei Tabs
          hinweg stehen, da sie sich auf den gesamten Feld-Zustand beziehen,
          nicht auf einen einzelnen Tab. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_1fr_300px]">
        <div onClick={() => setActiveTab("aufbau")}>
          <FieldPalette
            activeGroup={activeGroup}
            onGroupChange={setActiveGroup}
            onAdd={addField}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="aufbau">Aufbau</TabsTrigger>
              <TabsTrigger value="benachrichtigung">
                Benachrichtigung
              </TabsTrigger>
              <TabsTrigger value="einstellungen">Einstellungen</TabsTrigger>
            </TabsList>
            <p className="text-sm text-muted-foreground">
              {fields.length} {fields.length === 1 ? "Feld" : "Felder"} ·{" "}
              {requiredCount} Pflicht
            </p>
          </div>

          <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
            <TabsContent value="aufbau">
              <FormCanvas
                name={name}
                slug={slug}
                fields={fields}
                submitButtonText={submitButtonText}
                submitButtonAlign={submitButtonAlign}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReorderStep={moveField}
                onReorderDrop={moveFieldByDrop}
                onResize={(id, width) => updateField(id, { width })}
                onRemove={removeField}
              />
            </TabsContent>

            <TabsContent
              value="benachrichtigung"
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email-field">E-Mail-Feld des Absenders</Label>
                <Select
                  value={emailFieldId}
                  onValueChange={(v) => setEmailFieldId(v ?? "")}
                  items={Object.fromEntries(
                    emailFields.map((f) => [f.id, f.label]),
                  )}
                >
                  <SelectTrigger id="email-field" className="w-full max-w-sm">
                    <SelectValue placeholder="Kein E-Mail-Feld" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailFields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Nötig, damit eine Bestätigung an den Absender verschickt
                  werden kann.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-4">
                <div>
                  <Label>Bestätigung an Absender senden</Label>
                  <p className="text-sm text-muted-foreground">
                    Verschickt nach jeder Einsendung eine Bestätigungsmail.
                  </p>
                </div>
                <Switch
                  checked={sendConfirmation}
                  onCheckedChange={setSendConfirmation}
                  disabled={!emailFieldId}
                />
              </div>

              {isNew ? (
                <p className="text-sm text-muted-foreground">
                  Der Admin-Empfänger lässt sich nach dem ersten Speichern hier
                  festlegen.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <SegmentedPicker
                    label="Admin-Benachrichtigung an"
                    value={recipientMode}
                    onChange={setRecipientMode}
                    options={[
                      { label: "Gemeinsame Adresse", value: "shared" },
                      { label: "Eigene Adresse", value: "custom" },
                    ]}
                  />
                  {recipientMode === "shared" && (
                    <p className="text-xs text-muted-foreground">
                      Aus Einstellungen → Benachrichtigungen.
                    </p>
                  )}
                  {recipientMode === "custom" && (
                    <Input
                      type="email"
                      className="max-w-sm"
                      value={recipientTo}
                      onChange={(e) => setRecipientTo(e.target.value)}
                      placeholder="name@beispiel.de"
                    />
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Wortlaut der beiden Mails (Admin-Benachrichtigung & Bestätigung)
                unter{" "}
                <Link href="/dashboard/settings" className="underline">
                  Einstellungen → Mailing
                </Link>{" "}
                bearbeiten.
              </p>
            </TabsContent>

            <TabsContent value="einstellungen" className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5 max-w-sm">
                <Label htmlFor="form-name-setting">Name</Label>
                <Input
                  id="form-name-setting"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5 max-w-sm">
                <Label htmlFor="form-slug-setting">Slug</Label>
                <Input
                  id="form-slug-setting"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>

              {!isNew && (
                <SegmentedPicker
                  label="Status"
                  value={status}
                  onChange={handleStatusChange}
                  options={STATUS_OPTIONS}
                />
              )}

              {!isNew && (
                <div className="border-t border-[#F0F0F0] pt-4">
                  <ConfirmDeleteDialog
                    trigger={
                      <Button type="button" variant="destructive">
                        <Trash2 className="size-4" />
                        Formular löschen
                      </Button>
                    }
                    title={`„${name}“ löschen?`}
                    description="Wird in den Papierkorb verschoben und kann von dort wiederhergestellt werden."
                    onConfirm={handleDelete}
                  />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div onClick={() => setActiveTab("aufbau")}>
          {selectedId === SUBMIT_SENTINEL ? (
            <SubmitButtonPropertiesPanel
              text={submitButtonText}
              align={submitButtonAlign}
              redirectUrl={redirectUrl}
              onTextChange={setSubmitButtonText}
              onAlignChange={setSubmitButtonAlign}
              onRedirectUrlChange={setRedirectUrl}
            />
          ) : (
            <FieldPropertiesPanel
              selected={selected}
              selectedIndex={selectedIndex}
              total={fields.length}
              onUpdate={updateField}
              onRemove={removeField}
            />
          )}
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vorschau</DialogTitle>
          </DialogHeader>
          <FormCanvas
            name={name}
            slug={slug}
            fields={fields}
            submitButtonText={submitButtonText}
            submitButtonAlign={submitButtonAlign}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
