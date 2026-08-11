"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModuleFieldInput } from "@/components/module-field-input";
import { GallerySwiper, type GallerySwiperImage } from "@/components/gallery-swiper";
import {
  isGalleryModuleType,
  toImageValue,
  toRepeaterItems,
} from "@/components/block-field-output";
import {
  GALLERY_EFFECTS,
  GALLERY_EFFECT_LABELS,
  SINGLE_SLIDE_EFFECTS,
  toGallerySettings,
  type GallerySettings,
} from "@/lib/gallery-settings";
import type { ContentTypeField, GlobalModule, ModuleType } from "@/lib/api-server";

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
    const caption = captionField ? String(item.values[captionField.name] ?? "") : "";
    return [{ url: img.url, focalX: img.focalX, focalY: img.focalY, caption }];
  });
}

/** Anzeige-Einstellungen einer Galerie (Swiper-Effekt/Autoplay/Navigation/
 * Pagination) – direkt in der jeweiligen Galerie gesetzt statt zentral im
 * Modul-Typ-Schema, da sich verschiedene Galerien unterschiedlich
 * verhalten sollen. Inklusive Live-Vorschau mit den echten Bildern. */
function GallerySettingsEditor({
  settings,
  onChange,
  previewImages,
}: {
  settings: GallerySettings;
  onChange: (next: GallerySettings) => void;
  previewImages: GallerySwiperImage[];
}) {
  const isSingleSlideEffect = SINGLE_SLIDE_EFFECTS.includes(settings.effect);

  function set<K extends keyof GallerySettings>(key: K, value: GallerySettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anzeige-Einstellungen</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Effekt</Label>
            <Select
              value={settings.effect}
              onValueChange={(value) => set("effect", value as GallerySettings["effect"])}
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
          <div className="flex flex-col gap-2">
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
              onChange={(e) => set("slidesPerView", Number(e.target.value) || 1)}
            />
            {isSingleSlideEffect && (
              <p className="text-xs text-muted-foreground">
                Bei „{GALLERY_EFFECT_LABELS[settings.effect]}“ ist immer nur ein Bild
                gleichzeitig sichtbar.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-space-between">Abstand zwischen Bildern (px)</Label>
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
          <div className="flex flex-col gap-2">
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
              onChange={(e) => set("autoplayDelay", Number(e.target.value) || 500)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="gallery-loop"
              checked={settings.loop}
              onCheckedChange={(checked) => set("loop", checked)}
            />
            <Label htmlFor="gallery-loop">Endlosschleife</Label>
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
        </div>

        {previewImages.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label>Vorschau</Label>
            <GallerySwiper images={previewImages} settings={settings} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Vorschau erscheint, sobald mindestens ein Bild hinzugefügt wurde.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Eigenständige Anlegen-/Bearbeiten-Seite statt Popup – mehr Platz für
 * Repeater-Felder (Galerie-Bilder, FAQ-Einträge), siehe
 * dashboard/content/galleries/ bzw. .../faqs/, jeweils new/ und
 * /[id]/page.tsx. `globalModule` gesetzt -> Bearbeiten-Modus (PATCH),
 * sonst Anlegen (POST). Im Designer bleibt das schnelle Einfügen/Anlegen
 * weiterhin ein Popup (siehe insert-shared-block-dialog.tsx) – eigener,
 * unabhängiger Ablauf für den Blockeinfüge-Moment, nicht für die
 * zentrale Verwaltung. */
export function GlobalModulePageForm({
  moduleType,
  globalModule,
  redirectTo,
}: {
  moduleType: ModuleType;
  globalModule?: GlobalModule;
  redirectTo: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(globalModule);
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
        : { name, moduleTypeId: moduleType.id, values, ...(isGallery && { settings }) };

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
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="global-module-page-name">Name</Label>
            <Input
              id="global-module-page-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Interner Name zur Wiedererkennung"
            />
          </div>
          {fields.map((field) => (
            <ModuleFieldInput
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(v) =>
                setValues((prev) => ({ ...prev, [field.name]: v }))
              }
              // Nur hier (FAQ-/Galerie-Detailseiten): Rich-Text-Unterfelder
              // in den Kacheln bekommen eine feste, scrollbare Höhe, damit
              // ein langer Text nicht die Kachel-Höhe sprengt und das Grid
              // uneinheitlich macht (siehe module-field-input.tsx).
              richTextMaxHeight="16rem"
            />
          ))}
        </CardContent>
      </Card>
      {isGallery && (
        <GallerySettingsEditor
          settings={settings}
          onChange={setSettings}
          previewImages={buildPreviewImages(repeaterField, values)}
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Speichert…"
            : isEditing
              ? "Änderungen speichern"
              : "Anlegen"}
        </Button>
        <Button type="button" variant="outline" render={<Link href={redirectTo} />}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
