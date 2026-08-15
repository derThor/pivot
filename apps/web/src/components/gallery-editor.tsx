"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ImagePickerDialog } from "@/components/image-picker-dialog";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { GallerySwiper, type GallerySwiperImage } from "@/components/gallery-swiper";
import {
  toRepeaterItems,
  toImageValue,
  type RepeaterItem,
} from "@/components/block-field-output";
import {
  toGallerySettings,
  GALLERY_EFFECTS,
  GALLERY_EFFECT_LABELS,
  LOOP_INCOMPATIBLE_EFFECTS,
  SINGLE_SLIDE_EFFECTS,
  type GallerySettings,
} from "@/lib/gallery-settings";
import { resolveImageSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { GlobalModule, ModuleType } from "@/lib/api-server";

const darkTextClassName = "text-[#132033]";
const cardClassName =
  "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#E6E6E6]";

function SettingsSwitchRow({
  label,
  checked,
  onCheckedChange,
  id,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
        <Label htmlFor={id}>{label}</Label>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Vollständige Bearbeiten-Seite für eine Bildergalerie statt Popup
 * (Nutzervorgabe, 2026-08-15, 1:1 nach Bildvorlage): Live-Vorschau,
 * Bilder-Grid mit Drag&Drop-Sortierung (natives HTML5-DnD, gleiches
 * Muster wie navigation-explorer.tsx) und Anzeige-Einstellungen.
 * Alle Änderungen (Bilder hinzufügen/entfernen/sortieren, Einstellungen)
 * bleiben lokal, bis "Speichern" geklickt wird – ein PATCH für alles. */
export function GalleryEditor({
  gallery,
  moduleType,
}: {
  gallery: GlobalModule;
  moduleType: ModuleType;
}) {
  const router = useRouter();
  const repeaterField = moduleType.schema.fields.find(
    (f) => f.type === "repeater",
  );
  const subFields = repeaterField?.fields ?? [];
  const imageFieldName = subFields.find((f) => f.type === "image")?.name ?? "image";
  const captionFieldName = subFields.find((f) => f.type === "text")?.name;

  const [items, setItems] = useState<RepeaterItem[]>(() =>
    repeaterField ? toRepeaterItems(gallery.values[repeaterField.name]) : [],
  );
  const [settings, setSettings] = useState<GallerySettings>(() =>
    toGallerySettings(gallery.settings),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [captionTarget, setCaptionTarget] = useState<RepeaterItem | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!repeaterField) {
    return (
      <p className="text-sm text-muted-foreground">
        Galerie-Modul-Typ hat kein gültiges Bild-Feld.
      </p>
    );
  }

  const repeaterFieldName = repeaterField.name;
  const isSingleSlideEffect = SINGLE_SLIDE_EFFECTS.includes(settings.effect);
  const isLoopIncompatible = LOOP_INCOMPATIBLE_EFFECTS.includes(settings.effect);

  function setSetting<K extends keyof GallerySettings>(
    key: K,
    value: GallerySettings[K],
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  // Bei Effekten, die kein `loop` unterstützen (siehe
  // LOOP_INCOMPATIBLE_EFFECTS), die Endlosschleife automatisch ausschalten
  // statt sie nur unwirksam anzuzeigen (Nutzervorgabe, 2026-08-15) – sonst
  // stünde der Schalter weiterhin "an", obwohl er nichts mehr bewirkt.
  function handleEffectChange(effect: GallerySettings["effect"]) {
    setSettings((prev) => ({
      ...prev,
      effect,
      loop: LOOP_INCOMPATIBLE_EFFECTS.includes(effect) ? false : prev.loop,
    }));
  }

  const previewImages: GallerySwiperImage[] = items.flatMap((item) => {
    const img = toImageValue(item.values[imageFieldName]);
    if (!img.url) return [];
    return [
      {
        url: img.url,
        focalX: img.focalX,
        focalY: img.focalY,
        caption: captionFieldName
          ? String(item.values[captionFieldName] ?? "")
          : undefined,
      },
    ];
  });

  function handleAddImage(url: string, _alt?: string, media?: { id: string }) {
    const newId = crypto.randomUUID();
    setItems((prev) => [
      ...prev,
      { id: newId, values: { [imageFieldName]: { url, mediaId: media?.id } } },
    ]);
    setSelectedId(newId);
    setPickerOpen(false);
  }

  function handleDeleteImage(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedId((current) =>
      current === id ? (items.find((item) => item.id !== id)?.id ?? null) : current,
    );
  }

  // Klick (nicht Ziehen – ein abgeschlossener HTML5-Drag löst kein
  // anschließendes `click` aus) öffnet das Beschreibung-Popup für dieses
  // Bild (Nutzervorgabe, 2026-08-15).
  function openCaptionEditor(item: RepeaterItem) {
    setSelectedId(item.id);
    setCaptionTarget(item);
    setCaptionDraft(
      captionFieldName ? String(item.values[captionFieldName] ?? "") : "",
    );
  }

  function handleSaveCaption() {
    if (!captionTarget || !captionFieldName) {
      setCaptionTarget(null);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === captionTarget.id
          ? { ...item, values: { ...item.values, [captionFieldName]: captionDraft } }
          : item,
      ),
    );
    setCaptionTarget(null);
  }

  function handleDrop(targetId: string) {
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      const fromIndex = next.findIndex((i) => i.id === draggedId);
      const toIndex = next.findIndex((i) => i.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggedId(null);
  }

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/global-modules/${gallery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: { ...gallery.values, [repeaterFieldName]: items },
          settings,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setSaveError(errBody?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      toastEdited(`„${gallery.name}“ wurde gespeichert.`);
      router.push("/dashboard/content/galleries");
      router.refresh();
    } catch {
      setSaveError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className={cn("text-2xl font-semibold tracking-tight break-words", darkTextClassName)}>
            Galerie · {gallery.name}
          </h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </div>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className={cardClassName}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={cn("text-[15px] font-semibold", darkTextClassName)}>
              Live-Vorschau
            </h2>
            <span className="shrink-0 rounded-md bg-[#ECECEC] px-2 py-0.5 text-[11px] font-medium text-[#526074]">
              Effekt: {GALLERY_EFFECT_LABELS[settings.effect]}
            </span>
          </div>
          <div className="mt-4">
            {previewImages.length > 0 ? (
              <GallerySwiper images={previewImages} settings={settings} maxHeight={400} />
            ) : (
              <div className="flex h-[400px] w-full items-center justify-center rounded-md bg-[#F2F2F2] text-sm text-muted-foreground">
                Noch keine Bilder in dieser Galerie.
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between gap-2">
            <h3 className={cn("text-sm font-semibold", darkTextClassName)}>
              Bilder in dieser Galerie
            </h3>
            <span className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? "Eintrag" : "Einträge"}
              {items.length > 1 && " · ziehen zum Sortieren"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
            {items.map((item, index) => {
              const img = toImageValue(item.values[imageFieldName]);
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverId(item.id);
                  }}
                  onDragLeave={() =>
                    setDragOverId((current) => (current === item.id ? null : current))
                  }
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(item.id);
                  }}
                  onClick={() => openCaptionEditor(item)}
                  className={cn(
                    "group relative aspect-square cursor-grab overflow-hidden rounded-xl bg-[#F2F2F2] ring-1 ring-[#E6E6E6] active:cursor-grabbing",
                    selectedId === item.id && "ring-2 ring-[#BCE64D]",
                    dragOverId === item.id &&
                      draggedId !== item.id &&
                      "ring-2 ring-[#BCE64D]",
                  )}
                >
                  {img.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImageSrc(img.url)}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                  <span className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-[10px] font-medium text-white">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteImage(item.id);
                    }}
                    aria-label="Bild entfernen"
                    className="absolute top-1.5 right-1.5 hidden size-5 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/90 group-hover:flex"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label="Bild hinzufügen"
              className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#D5D5D5] text-[#8C8C8C] transition-colors hover:border-[#BCE64D] hover:text-[#132033]"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>

        <div className={cn(cardClassName, "flex h-fit flex-col gap-4")}>
          <h2 className={cn("text-[15px] font-semibold", darkTextClassName)}>
            Anzeige-Einstellungen
          </h2>

          <div className="flex flex-col gap-1.5">
            <Label>Effekt</Label>
            <Select
              value={settings.effect}
              onValueChange={(value) =>
                handleEffectChange(value as GallerySettings["effect"])
              }
              items={Object.fromEntries(
                GALLERY_EFFECTS.map((effect) => [effect, GALLERY_EFFECT_LABELS[effect]]),
              )}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Effekt wählen" />
              </SelectTrigger>
              <SelectContent>
                {GALLERY_EFFECTS.map((effect) => (
                  <SelectItem key={effect} value={effect}>
                    {GALLERY_EFFECT_LABELS[effect]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-editor-slides-per-view">Sichtbar gleichzeitig</Label>
            <Input
              id="gallery-editor-slides-per-view"
              type="number"
              min={1}
              max={6}
              disabled={isSingleSlideEffect}
              value={settings.slidesPerView}
              onChange={(e) => setSetting("slidesPerView", Number(e.target.value) || 1)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-editor-space-between">Abstand (px)</Label>
            <Input
              id="gallery-editor-space-between"
              type="number"
              min={0}
              max={100}
              disabled={isSingleSlideEffect}
              value={settings.spaceBetween}
              onChange={(e) => setSetting("spaceBetween", Number(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-editor-autoplay-delay">Auto-Wechsel (ms)</Label>
            <Input
              id="gallery-editor-autoplay-delay"
              type="number"
              min={500}
              step={500}
              disabled={!settings.autoplay}
              value={settings.autoplayDelay}
              onChange={(e) => setSetting("autoplayDelay", Number(e.target.value) || 500)}
            />
          </div>

          <SettingsSwitchRow
            id="gallery-editor-navigation"
            label="Pfeile anzeigen"
            checked={settings.navigation}
            onCheckedChange={(checked) => setSetting("navigation", checked)}
          />
          <SettingsSwitchRow
            id="gallery-editor-pagination"
            label="Punkte anzeigen"
            checked={settings.pagination}
            onCheckedChange={(checked) => setSetting("pagination", checked)}
          />
          <SettingsSwitchRow
            id="gallery-editor-autoplay"
            label="Auto-Wechsel"
            checked={settings.autoplay}
            onCheckedChange={(checked) => setSetting("autoplay", checked)}
          />
          <SettingsSwitchRow
            id="gallery-editor-loop"
            label="Endlosschleife"
            checked={settings.loop}
            onCheckedChange={(checked) => setSetting("loop", checked)}
            disabled={isLoopIncompatible}
            hint={
              isLoopIncompatible
                ? `Bei „${GALLERY_EFFECT_LABELS[settings.effect]}“ nicht möglich (Navigation würde brechen).`
                : undefined
            }
          />
          {captionFieldName && (
            <SettingsSwitchRow
              id="gallery-editor-show-captions"
              label="Beschreibung anzeigen"
              checked={settings.showCaptions}
              onCheckedChange={(checked) => setSetting("showCaptions", checked)}
            />
          )}
        </div>
      </div>

      <ImagePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAddImage}
      />

      <Dialog
        open={captionTarget !== null}
        onOpenChange={(open) => !open && setCaptionTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Beschreibung</DialogTitle>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-editor-caption">Bildunterschrift</Label>
            <Textarea
              id="gallery-editor-caption"
              rows={3}
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
              placeholder="Optionale Bildunterschrift…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCaptionTarget(null)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={handleSaveCaption}>
              Übernehmen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
