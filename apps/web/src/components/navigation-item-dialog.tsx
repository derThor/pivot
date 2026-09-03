"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
} from "@/components/ui/combobox";
import { SegmentedPicker } from "@/components/segmented-picker";
import type {
  CategoryListItem,
  ContentListItem,
  NavigationItemNode,
} from "@/lib/api-server";
import { bff } from "@/lib/bff";

const targetTypeOptions: Record<string, string> = {
  content: "Inhalt",
  category: "Kategorie",
  external: "Externe URL",
};

/** Darstellung der Kategorie-Übersichtsseite – sitzt bewusst hier am
 * Menüpunkt und nicht
 * an der Kategorie (Nutzerentscheidung, 2026-09-02), damit dieselbe
 * Kategorie in zwei Menüs unterschiedlich aussehen kann. */
// Der gespeicherte Wert heißt weiterhin BLOCKS – nur die Beschriftung
// ist "Blog" (Nutzervorgabe, 2026-09-03). Den Datenbank-Wert umzubenennen
// hieße, jede bestehende Einstellung zu migrieren, ohne dass jemand etwas
// davon hätte.
const CATEGORY_LAYOUT_OPTIONS = [
  { value: "LIST" as const, label: "Liste" },
  { value: "BLOCKS" as const, label: "Blog" },
];

const CATEGORY_LAYOUT_DESCRIPTION: Record<string, string> = {
  LIST: "Kompakt: nur Titel und Datum je Seite.",
  BLOCKS:
    "Jeder Beitrag ausgeschrieben, untereinander. Ein „Weiterlesen“-Baustein im Beitrag kürzt ihn bis dorthin.",
};

/** Aussehen des Punkts im Header der Website (Nutzerentscheidung,
 * 2026-09-02). Damit sind Handlungsaufrufe wie "Anmelden" oder "Demo
 * buchen" ganz normale Menüpunkte statt fest verdrahteter Knöpfe. Gilt
 * für alle Zielarten, deshalb außerhalb der Kategorie-Verzweigung. */
const APPEARANCE_OPTIONS = [
  { value: "LINK" as const, label: "Link" },
  { value: "TEXT_BUTTON" as const, label: "Textknopf" },
  { value: "ACCENT_BUTTON" as const, label: "Akzentknopf" },
];

const APPEARANCE_DESCRIPTION: Record<string, string> = {
  LINK: "Gewöhnlicher Menüpunkt in der Menüzeile.",
  TEXT_BUTTON: "Rechts abgesetzt, kräftiger, ohne Fläche.",
  ACCENT_BUTTON: "Rechts abgesetzt, mit farbiger Fläche.",
};

/** Welche Zielart der Dialog beim Öffnen zeigt. Ausschlaggebend ist das
 * tatsächlich gesetzte Feld – `content` ist der Standard beim Anlegen. */
function initialTargetType(item?: NavigationItemNode): string {
  if (item?.categoryId) return "category";
  if (item?.externalUrl) return "external";
  return "content";
}

const MIN_QUERY_LENGTH = 3;

interface ContentSearchResult {
  id: string;
  title: string;
  slug: string;
  contentTypeName: string;
}

interface ContentPickerItem {
  value: string;
  label: string;
  slug: string;
  contentTypeName: string;
}

/** Kombiniert Browsen und Live-Suche (Nutzervorgabe, 2026-08-21: "so muss
 * ich ja genau wissen, wonach ich suchen will" – eine reine Suche ohne
 * Browse-Möglichkeit war eine Verschlechterung gegenüber der alten
 * `<Select>`-Liste, siehe knowledge-base/content/navigation-management.md).
 * Ohne Eingabe bzw. unterhalb `MIN_QUERY_LENGTH` wird `browseItems`
 * (client-seitig gefiltert, falls schon etwas getippt wurde) gezeigt – die
 * bereits ohnehin geladene, auf 100 Einträge begrenzte Liste. Ab
 * `MIN_QUERY_LENGTH` übernimmt die echte Server-Suche
 * (`GET /content/search`, gleiches Muster wie `header-search.tsx`), die
 * auch Inhalte jenseits der 100er-Grenze findet.
 *
 * Nutzt seit der Nachbesserung (Nutzer-Bugreport, gleicher Tag: "das ist
 * nicht gut", Screenshot eines aufgeblähten Dialogs mit innerem
 * Scrollbalken) die echte Base-UI-`Combobox`-Primitive statt eines
 * selbstgebauten `absolute`-Divs – das Popup ist dadurch portaliert
 * (rendert in `document.body`), bläht den umgebenden Dialog also nicht
 * mehr auf. Gleiches Muster wie `select.tsx`/`dropdown-menu.tsx`, die aus
 * demselben Grund bereits portaliert sind. */
function ContentPicker({
  id,
  initialTitle,
  browseItems,
  onChange,
}: {
  id?: string;
  initialTitle: string;
  browseItems: ContentListItem[];
  onChange: (id: string, title: string) => void;
}) {
  // Auswahl UND Schließen des Popups feuern bei einem Klick auf einen
  // Eintrag im selben React-Batch – ohne diesen Guard würde
  // `onOpenChange`s Zurücksetzen auf `initialTitle` (alter, noch nicht
  // aktualisierter Prop-Wert) das gerade in `onValueChange` gesetzte
  // Ergebnis wieder überschreiben (Reihenfolge beider Handler nicht
  // garantiert).
  const justSelectedRef = useRef(false);
  const [query, setQuery] = useState(initialTitle);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<
    ContentSearchResult[] | null
  >(null);

  const trimmed = query.trim();
  const isSearching = trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!isSearching) return;
    setIsLoading(true);
    const timeout = setTimeout(async () => {
      const res = await fetch(
        bff(`/api/content/search?q=${encodeURIComponent(trimmed)}&limit=8`),
      );
      const data = await res.json().catch(() => null);
      setSearchResults(Array.isArray(data) ? data : []);
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [isSearching, trimmed]);

  const browseResults: ContentPickerItem[] = browseItems
    .filter((c) => c.title.toLowerCase().includes(trimmed.toLowerCase()))
    .map((c) => ({
      value: c.id,
      label: c.title,
      slug: c.slug,
      contentTypeName: c.contentType.name,
    }));
  const searchItems: ContentPickerItem[] = (searchResults ?? []).map((r) => ({
    value: r.id,
    label: r.title,
    slug: r.slug,
    contentTypeName: r.contentTypeName,
  }));
  const items = isSearching ? searchItems : browseResults;

  return (
    <Combobox
      items={items}
      filter={null}
      inputValue={query}
      onInputValueChange={setQuery}
      openOnInputClick
      onValueChange={(item: ContentPickerItem | null) => {
        if (!item) return;
        justSelectedRef.current = true;
        onChange(item.value, item.label);
        setQuery(item.label);
      }}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return;
        // Getipptes ohne Auswahl beim Schließen verwerfen – der zuletzt
        // bestätigte Titel bleibt bestehen, statt einen Text stehen zu
        // lassen, der zu keiner ausgewählten `contentId` mehr passt. Nicht
        // nach einer echten Auswahl (siehe Guard oben).
        if (justSelectedRef.current) {
          justSelectedRef.current = false;
          return;
        }
        setQuery(initialTitle);
      }}
    >
      <ComboboxInput
        id={id}
        placeholder="Inhalt suchen oder aus der Liste wählen …"
      />
      <ComboboxContent>
        {isSearching && isLoading ? (
          <ComboboxStatus>Suche…</ComboboxStatus>
        ) : (
          <>
            <ComboboxEmpty>Keine Treffer.</ComboboxEmpty>
            <ComboboxList>
              {(item: ContentPickerItem) => (
                <ComboboxItem key={item.value} value={item}>
                  <span className="w-full truncate font-medium">
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.contentTypeName} · /{item.slug}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </>
        )}
      </ComboboxContent>
    </Combobox>
  );
}

export function NavigationItemDialog({
  navigationId,
  contentItems,
  categoryItems,
  parentId = null,
  item,
  trigger,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  navigationId: string;
  contentItems: ContentListItem[];
  categoryItems: CategoryListItem[];
  parentId?: string | null;
  /** Vorhandener Eintrag zum Bearbeiten (PATCH) statt Anlegen (POST). */
  item?: NavigationItemNode;
  trigger?: React.ReactElement;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(item);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [label, setLabel] = useState(item?.label ?? "");
  const [targetType, setTargetType] = useState(initialTargetType(item));
  const [contentId, setContentId] = useState(item?.contentId ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "");
  const [categoryLayout, setCategoryLayout] = useState<"LIST" | "BLOCKS">(
    item?.categoryLayout ?? "LIST",
  );
  const [appearance, setAppearance] = useState<
    "LINK" | "TEXT_BUTTON" | "ACCENT_BUTTON"
  >(item?.appearance ?? "LINK");
  const [externalUrl, setExternalUrl] = useState(item?.externalUrl ?? "");
  const [openInNewTab, setOpenInNewTab] = useState(item?.openInNewTab ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contentTitleById = Object.fromEntries(
    contentItems.map((c) => [c.id, c.title]),
  );
  // `Select` erwartet zusätzlich zu den `SelectItem`s eine value→Label-Map
  // für die Anzeige im geschlossenen Zustand (gleiches Muster wie
  // `targetTypeOptions` darüber).
  const categoryLabels: Record<string, string> = Object.fromEntries(
    categoryItems.map((c) => [c.id, c.name]),
  );
  const [contentTitle, setContentTitle] = useState(
    item?.contentId ? (contentTitleById[item.contentId] ?? "") : "",
  );

  function resetForm() {
    setLabel(item?.label ?? "");
    setTargetType(initialTargetType(item));
    setContentId(item?.contentId ?? "");
    setContentTitle(
      item?.contentId ? (contentTitleById[item.contentId] ?? "") : "",
    );
    setCategoryId(item?.categoryId ?? "");
    setCategoryLayout(item?.categoryLayout ?? "LIST");
    setAppearance(item?.appearance ?? "LINK");
    setExternalUrl(item?.externalUrl ?? "");
    setOpenInNewTab(item?.openInNewTab ?? false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(
        isEditing
          ? bff(`/api/navigations/${navigationId}/items/${item!.id}`)
          : bff(`/api/navigations/${navigationId}/items`),
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            openInNewTab,
            appearance,
            ...(!isEditing && { parentId }),
            // Die drei Ziele schließen sich aus – die jeweils anderen
            // werden explizit auf `null` gesetzt, sonst bliebe beim
            // Umschalten das alte Ziel stehen (siehe Kommentar in
            // NavigationService.updateItem()).
            ...(targetType === "content"
              ? { contentId, categoryId: null, externalUrl: null }
              : targetType === "category"
                ? {
                    categoryId,
                    categoryLayout,
                    contentId: null,
                    externalUrl: null,
                  }
                : { externalUrl, contentId: null, categoryId: null }),
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      setOpen(false);
      if (!isEditing) resetForm();
      if (isEditing) toastEdited();
      else toastCreated(`„${label}“ wurde hinzugefügt.`);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      {!hideTrigger && trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Menüpunkt bearbeiten" : "Menüpunkt hinzufügen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-item-label" required>
              Label
            </Label>
            <Input
              id="nav-item-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nav-item-target-type">Ziel</Label>
            <Select
              value={targetType}
              onValueChange={(value) => setTargetType(value ?? "content")}
              items={targetTypeOptions}
            >
              <SelectTrigger id="nav-item-target-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(targetTypeOptions).map(([value, lbl]) => (
                  <SelectItem key={value} value={value}>
                    {lbl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {targetType === "content" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nav-item-content" required>
                Inhalt
              </Label>
              <ContentPicker
                key={contentTitle}
                id="nav-item-content"
                initialTitle={contentTitle}
                browseItems={contentItems}
                onChange={(id, title) => {
                  setContentId(id);
                  setContentTitle(title);
                }}
              />
            </div>
          ) : targetType === "category" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nav-item-category" required>
                  Kategorie
                </Label>
                <Select
                  value={categoryId}
                  onValueChange={(value) => setCategoryId(value ?? "")}
                  items={categoryLabels}
                >
                  <SelectTrigger id="nav-item-category" className="w-full">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryItems.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Der Menüpunkt zeigt auf die Übersichtsseite der Kategorie –
                  dort stehen alle veröffentlichten Seiten dieser Kategorie
                  untereinander.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <SegmentedPicker
                  label="Darstellung"
                  options={CATEGORY_LAYOUT_OPTIONS}
                  value={categoryLayout}
                  onChange={setCategoryLayout}
                />
                <p className="text-xs text-muted-foreground">
                  {CATEGORY_LAYOUT_DESCRIPTION[categoryLayout]}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nav-item-url" required>
                Externe URL
              </Label>
              <Input
                id="nav-item-url"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://…"
                required
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <SegmentedPicker
              label="Darstellung im Header"
              options={APPEARANCE_OPTIONS}
              value={appearance}
              onChange={setAppearance}
            />
            <p className="text-xs text-muted-foreground">
              {APPEARANCE_DESCRIPTION[appearance]} Im Footer bleibt jeder Punkt
              ein Link.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="nav-item-new-tab"
              className="size-5 rounded-md"
              checked={openInNewTab}
              onCheckedChange={(checked) => setOpenInNewTab(checked === true)}
            />
            <Label htmlFor="nav-item-new-tab" className="text-sm font-normal">
              In neuem Tab öffnen
            </Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-button-border"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Speichert…"
                : isEditing
                  ? "Speichern"
                  : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
