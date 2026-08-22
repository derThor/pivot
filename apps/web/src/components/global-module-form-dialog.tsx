"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import { ModuleFieldInput } from "@/components/module-field-input";
import {
  GallerySwiper,
  type GallerySwiperImage,
} from "@/components/gallery-swiper";
import {
  isGalleryModuleType,
  toImageValue,
  toRepeaterItems,
} from "@/components/block-field-output";
import {
  GALLERY_EFFECTS,
  GALLERY_EFFECT_LABELS,
  LOOP_INCOMPATIBLE_EFFECTS,
  SINGLE_SLIDE_EFFECTS,
  toGallerySettings,
  type GallerySettings,
} from "@/lib/gallery-settings";
import type {
  ContentTypeField,
  GlobalModule,
  ModuleType,
} from "@/lib/api-server";

function buildPreviewImages(
  repeaterField: ContentTypeField | undefined,
  values: Record<string, unknown>,
): GallerySwiperImage[] {
  if (!repeaterField) return [];
  const subFields = repeaterField.fields ?? [];
  const imageField = subFields.find((f) => f.type === "image");
  const captionField = subFields.find((f) => f.type !== "image");
  const items = toRepeaterItems(values[repeaterField.name]);
  return items.flatMap((item) => {
    const img = imageField ? toImageValue(item.values[imageField.name]) : null;
    if (!img?.url) return [];
    const caption = captionField
      ? String(item.values[captionField.name] ?? "")
      : "";
    return [{ url: img.url, focalX: img.focalX, focalY: img.focalY, caption }];
  });
}

/** Anzeige-Einstellungen einer Galerie (Swiper-Effekt/Autoplay/Navigation/
 * Pagination) – direkt in der jeweiligen Galerie gesetzt statt zentral im
 * Modul-Typ-Schema, da sich verschiedene Galerien unterschiedlich
 * verhalten sollen. Inklusive Live-Vorschau mit den echten Bildern. */
export function GallerySettingsEditor({
  settings,
  onChange,
  previewImages,
  // Nur relevant, wenn `showPreview` true ist (Standard): steuert dort, ob
  // Live-Vorschau oder Platzhaltertext gezeigt wird.
  showPreview = true,
}: {
  settings: GallerySettings;
  onChange: (next: GallerySettings) => void;
  previewImages: GallerySwiperImage[];
  // false: gesamter Vorschau-Bereich (inkl. Platzhaltertext) entfällt –
  // z.B. im schlanken Anlegen-Dialog (gallery-dialog.tsx), der noch gar
  // keine Bilder verwaltet, wäre der Platzhaltertext dort irreführend.
  showPreview?: boolean;
}) {
  const isSingleSlideEffect = SINGLE_SLIDE_EFFECTS.includes(settings.effect);
  const isLoopIncompatible = LOOP_INCOMPATIBLE_EFFECTS.includes(settings.effect);

  function set<K extends keyof GallerySettings>(
    key: K,
    value: GallerySettings[K],
  ) {
    onChange({ ...settings, [key]: value });
  }

  // Siehe gallery-editor.tsx: bei Effekten ohne `loop`-Unterstützung die
  // Endlosschleife automatisch ausschalten statt nur unwirksam anzuzeigen.
  function handleEffectChange(effect: GallerySettings["effect"]) {
    onChange({
      ...settings,
      effect,
      loop: LOOP_INCOMPATIBLE_EFFECTS.includes(effect) ? false : settings.loop,
    });
  }

  return (
    <Card className="border-none bg-transparent py-0 shadow-none">
      <CardHeader className="px-0">
        <CardTitle>Anzeige-Einstellungen</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-0">
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Effekt</Label>
            <Select
              value={settings.effect}
              onValueChange={(value) =>
                handleEffectChange(value as GallerySettings["effect"])
              }
              items={Object.fromEntries(
                GALLERY_EFFECTS.map((effect) => [
                  effect,
                  GALLERY_EFFECT_LABELS[effect],
                ]),
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
            <Label htmlFor="gallery-slides-per-view">
              Bilder gleichzeitig sichtbar
            </Label>
            <Input
              id="gallery-slides-per-view"
              type="number"
              min={1}
              max={6}
              disabled={isSingleSlideEffect}
              value={settings.slidesPerView}
              onChange={(e) =>
                set("slidesPerView", Number(e.target.value) || 1)
              }
            />
            {isSingleSlideEffect && (
              <p className="text-xs text-muted-foreground">
                Bei „{GALLERY_EFFECT_LABELS[settings.effect]}“ ist immer nur ein
                Bild gleichzeitig sichtbar.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-space-between">
              Abstand zwischen Bildern (px)
            </Label>
            <Input
              id="gallery-space-between"
              type="number"
              min={0}
              max={100}
              disabled={isSingleSlideEffect}
              value={settings.spaceBetween}
              onChange={(e) => set("spaceBetween", Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-autoplay-delay">
              Automatischer Wechsel nach (ms)
            </Label>
            <Input
              id="gallery-autoplay-delay"
              type="number"
              min={500}
              step={500}
              disabled={!settings.autoplay}
              value={settings.autoplayDelay}
              onChange={(e) =>
                set("autoplayDelay", Number(e.target.value) || 500)
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Switch
                id="gallery-loop"
                checked={settings.loop}
                disabled={isLoopIncompatible}
                onCheckedChange={(checked) => set("loop", checked)}
              />
              <Label htmlFor="gallery-loop">Endlosschleife</Label>
            </div>
            {isLoopIncompatible && (
              <p className="text-xs text-muted-foreground">
                Bei „{GALLERY_EFFECT_LABELS[settings.effect]}“ nicht möglich
                (Navigation würde brechen).
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="gallery-autoplay"
              checked={settings.autoplay}
              onCheckedChange={(checked) => set("autoplay", checked)}
            />
            <Label htmlFor="gallery-autoplay">Automatischer Wechsel</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="gallery-navigation"
              checked={settings.navigation}
              onCheckedChange={(checked) => set("navigation", checked)}
            />
            <Label htmlFor="gallery-navigation">Pfeile anzeigen</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="gallery-pagination"
              checked={settings.pagination}
              onCheckedChange={(checked) => set("pagination", checked)}
            />
            <Label htmlFor="gallery-pagination">Punkte anzeigen</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="gallery-show-captions"
              checked={settings.showCaptions}
              onCheckedChange={(checked) => set("showCaptions", checked)}
            />
            <Label htmlFor="gallery-show-captions">Beschreibung anzeigen</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="gallery-scrollbar"
              checked={settings.scrollbar}
              onCheckedChange={(checked) => set("scrollbar", checked)}
            />
            <Label htmlFor="gallery-scrollbar">Scrollbar anzeigen</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="gallery-thumbnails"
              checked={settings.thumbnails}
              onCheckedChange={(checked) => set("thumbnails", checked)}
            />
            <Label htmlFor="gallery-thumbnails">Vorschaubilder anzeigen</Label>
          </div>
        </div>

        {showPreview &&
          (previewImages.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label>Vorschau</Label>
              <GallerySwiper images={previewImages} settings={settings} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Vorschau erscheint, sobald mindestens ein Bild hinzugefügt wurde.
            </p>
          ))}
      </CardContent>
    </Card>
  );
}

/** Anlegen/Bearbeiten als Popup statt eigener Seite (Nutzervorgabe,
 * 2026-08-14) – anders als der Content-Editor ("Seiten", davon explizit
 * ausgenommen) sind FAQ-/Galerie-Einträge kompakt genug für einen breiten,
 * innen scrollbaren Dialog. `globalModule` gesetzt -> Bearbeiten-Modus
 * (PATCH), sonst Anlegen (POST). `hideTrigger` + kontrolliertes
 * `open`/`onOpenChange` fürs Öffnen aus einer Tabellenzeile heraus (siehe
 * global-modules-manager.tsx), analog zu role-form-dialog.tsx. */
export function GlobalModuleFormDialog({
  moduleType,
  globalModule,
  hideTrigger,
  triggerLabel,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  moduleType: ModuleType;
  globalModule?: GlobalModule;
  hideTrigger?: boolean;
  // Überschreibt den generischen Standard-Trigger-Text (z.B. "+ Neue
  // FAQ-Gruppe" auf der FAQ-Übersicht statt "Neuer Akkordeon/FAQ").
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(globalModule);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [name, setName] = useState(globalModule?.name ?? "");
  const [values, setValues] = useState<Record<string, unknown>>(
    globalModule?.values ?? {},
  );
  const [settings, setSettings] = useState<GallerySettings>(
    toGallerySettings(globalModule?.settings),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fields = moduleType.schema.fields.filter((f) => !f.option);
  const isGallery = isGalleryModuleType(moduleType.schema.fields);
  const repeaterField = fields.find((f) => f.type === "repeater");

  function reset() {
    setName(globalModule?.name ?? "");
    setValues(globalModule?.values ?? {});
    setSettings(toGallerySettings(globalModule?.settings));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Bitte einen Namen angeben.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/global-modules/${globalModule!.id}`
        : "/api/global-modules";
      const method = isEditing ? "PATCH" : "POST";
      const body = isEditing
        ? { name, values, ...(isGallery && { settings }) }
        : {
            name,
            moduleTypeId: moduleType.id,
            values,
            ...(isGallery && { settings }),
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setError(errBody?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      setOpen(false);
      if (!isEditing) reset();
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
        if (!next) reset();
      }}
    >
      {!hideTrigger && (
        <DialogTrigger render={<Button />}>
          <Plus />
          {triggerLabel ?? `Neu${isGallery ? "e" : "er"} ${moduleType.name}`}
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {moduleType.name} {isEditing ? "bearbeiten" : "anlegen"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          {/* `space-y-6` statt `flex flex-col gap-6`: siehe Kommentar in
              gallery-dialog.tsx – verschachtelte Flex-Spalten innerhalb
              dieses höhenbegrenzten `overflow-y-auto`-Bereichs quetschten
              sich sonst gegenseitig zusammen statt zu scrollen. */}
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="global-module-dialog-name" required>Name</Label>
              <Input
                id="global-module-dialog-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Interner Name zur Wiedererkennung"
              />
            </div>
            {(isGallery
              ? fields.filter((f) => f.type !== "repeater")
              : fields
            ).map((field) => (
              <ModuleFieldInput
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, [field.name]: v }))
                }
                richTextMaxHeight="12rem"
              />
            ))}
            {isGallery && (
              <GallerySettingsEditor
                settings={settings}
                onChange={setSettings}
                previewImages={buildPreviewImages(repeaterField, values)}
              />
            )}
            {isGallery && repeaterField && (
              <ModuleFieldInput
                field={repeaterField}
                value={values[repeaterField.name]}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, [repeaterField.name]: v }))
                }
                richTextMaxHeight="12rem"
              />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="shrink-0">
            {isSubmitting
              ? "Speichert…"
              : isEditing
                ? "Änderungen speichern"
                : "Anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
