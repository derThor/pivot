import { Image as ImageIcon } from "lucide-react";
import { RichTextDisplay } from "@/components/rich-text-display";
import { resolveImageSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { ContentTypeField, GlobalModule, MediaVariant } from "@/lib/api-server";

// Löst eine Modul-Instanz auf ihren *effektiven* Modul-Typ + Werte auf:
// bei einer normalen Instanz unverändert die eigenen Werte, bei einer
// Referenz auf ein globales Modul (`globalModuleId` gesetzt) live die
// aktuellen Werte des referenzierten `GlobalModule` – kein Snapshot, jede
// Änderung am globalen Modul wirkt sich dadurch sofort überall aus, wo es
// eingebunden ist (anders als z.B. `ImageFieldValue`, das bewusst ein
// Snapshot ist). Strukturell statt über den `ModuleInstance`-Typ selbst
// getippt, damit dieses (auch serverseitig genutzte) Modul nicht von der
// "use client"-Komponente `block-editor-field.tsx` abhängen muss.
export function resolveInstanceValues(
  instance: {
    moduleTypeId: string;
    values: Record<string, unknown>;
    globalModuleId?: string;
  },
  globalModules: GlobalModule[],
): { moduleTypeId: string; values: Record<string, unknown> } {
  if (!instance.globalModuleId) {
    return { moduleTypeId: instance.moduleTypeId, values: instance.values };
  }
  const globalModule = globalModules.find(
    (g) => g.id === instance.globalModuleId,
  );
  if (!globalModule) {
    return { moduleTypeId: instance.moduleTypeId, values: {} };
  }
  return { moduleTypeId: globalModule.moduleTypeId, values: globalModule.values };
}

export type ImageAlign = "none" | "full" | "left" | "center" | "right";

export interface ImageFieldValue {
  url: string;
  // Breite in Prozent der verfügbaren Spaltenbreite (10-100), per
  // Zieh-Griff im Block-Editor gesetzt. `undefined` = 100 (volle Breite
  // der Spalte, aber noch nicht "full" – siehe `align`).
  width?: number;
  align?: ImageAlign;
  // Herkunfts-Medium + dessen zum Upload-Zeitpunkt generierte
  // Responsive-Varianten (siehe media-image-processing.service.ts) –
  // wird beim Auswählen im ImagePickerDialog mitgespeichert, damit die
  // Ausgabe (`BlockFieldOutput`) ein `<picture>` mit WebP/AVIF-`srcSet`
  // rendern kann, ohne zur Laufzeit erneut die Medienbibliothek
  // abzufragen. Ältere/einfache Werte haben das nicht – Fallback bleibt
  // ein einfaches `<img>`.
  mediaId?: string;
  variants?: MediaVariant[];
  // Serverseitig generiertes quadratisches Thumbnail (siehe
  // media-image-processing.service.ts, Zuschnitt-Anker = Fokuspunkt).
  // Wird vom "Kacheln"-Baustein (`TilesGridOutput`) statt des Originals
  // verwendet, damit im Raster nicht unnötig große Bilder geladen werden.
  thumbnailUrl?: string;
  // Fokuspunkt des Quell-Mediums (0-1, siehe Media.focalX/focalY) – wird
  // beim Auswählen mitgespeichert und als CSS `object-position`
  // angewendet, wenn `object-cover` das Bild beschneidet (Original ist
  // hier weiterhin die volle Auflösung, nur der sichtbare Ausschnitt
  // richtet sich nach dem Fokuspunkt statt der Bildmitte).
  focalX?: number;
  focalY?: number;
}

// Ein Eintrag eines Repeater-Felds (z.B. eine FAQ-Frage oder ein
// Galerie-Bild) – analog zu `ModuleInstance` selbst (id + values), damit
// dieselbe stabile-Keys-Logik beim Hinzufügen/Entfernen/Umsortieren
// greift.
export interface RepeaterItem {
  id: string;
  values: Record<string, unknown>;
}

export function toRepeaterItems(raw: unknown): RepeaterItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const obj = entry as Record<string, unknown>;
    if (typeof obj.id !== "string") return [];
    const values =
      obj.values && typeof obj.values === "object"
        ? (obj.values as Record<string, unknown>)
        : {};
    return [{ id: obj.id, values }];
  });
}

// Bild-Felder wurden ursprünglich als reiner URL-String gespeichert
// (siehe Vorläufer in page-designer.md) – ältere/einfache Werte bleiben
// dadurch abwärtskompatibel lesbar.
export function toImageValue(raw: unknown): ImageFieldValue {
  if (typeof raw === "string") return { url: raw };
  if (raw && typeof raw === "object" && "url" in (raw as Record<string, unknown>)) {
    const obj = raw as Record<string, unknown>;
    const align = obj.align;
    return {
      url: typeof obj.url === "string" ? obj.url : "",
      width: typeof obj.width === "number" ? obj.width : undefined,
      align:
        align === "full" || align === "left" || align === "center" || align === "right"
          ? align
          : "none",
      mediaId: typeof obj.mediaId === "string" ? obj.mediaId : undefined,
      variants: Array.isArray(obj.variants) ? (obj.variants as MediaVariant[]) : undefined,
      thumbnailUrl: typeof obj.thumbnailUrl === "string" ? obj.thumbnailUrl : undefined,
      focalX: typeof obj.focalX === "number" ? obj.focalX : undefined,
      focalY: typeof obj.focalY === "number" ? obj.focalY : undefined,
    };
  }
  return { url: "" };
}

// CSS `object-position`-Wert aus dem Fokuspunkt, oder `undefined`
// (= Browser-Default Bildmitte), wenn keiner gesetzt ist.
export function focalObjectPosition(
  img: Pick<ImageFieldValue, "focalX" | "focalY">,
): string | undefined {
  if (img.focalX == null || img.focalY == null) return undefined;
  return `${img.focalX * 100}% ${img.focalY * 100}%`;
}

export interface BlockLayoutValue {
  width?: number;
  align?: ImageAlign;
}

// Bestimmt Breite/Ausrichtung eines ganzen Blocks (nicht nur eines
// einzelnen Felds). Drei Fälle:
// 1. Modul mit Bild-Feld + weiteren Feldern (z.B. "Bild + Text"): der
//    Block selbst bleibt immer 100% breit – das Bild-Feld floatet dafür
//    *innerhalb* des Blocks, der Text im selben Block wickelt sich darum.
// 2. Modul mit genau einem Bild-Feld (z.B. "Bild"): die Block-Größe
//    *ist* die Bildgröße, aus dem Feldwert gelesen (siehe
//    `toImageValue`) – kein separates `layout` nötig.
// 3. Alle anderen Module (Rich-Text, CTA-Button, Zitat, …): Breite/
//    Ausrichtung kommen aus `instance.layout` (per Zieh-Griff am Block
//    selbst gesetzt).
export function resolveBlockLayout(
  contentFields: ContentTypeField[],
  values: Record<string, unknown>,
  layout: BlockLayoutValue | undefined,
): { align: ImageAlign; width: number; hasIntraBlockImage: boolean } {
  const imageFields = contentFields.filter((f) => f.type === "image");
  if (imageFields.length > 0 && contentFields.length > 1) {
    return { align: "none", width: 100, hasIntraBlockImage: true };
  }
  if (imageFields.length === 1) {
    const img = toImageValue(values[imageFields[0].name]);
    const align = img.align ?? "none";
    return { align, width: align === "full" ? 100 : (img.width ?? 100), hasIntraBlockImage: false };
  }
  const align = layout?.align ?? "none";
  return { align, width: align === "full" ? 100 : (layout?.width ?? 100), hasIntraBlockImage: false };
}

// Erkennt Module mit mehreren Bild-Feldern (z.B. den "Kacheln"-Baustein)
// generisch über die Feldanzahl, nicht über den Modul-Slug – funktioniert
// dadurch automatisch auch für künftige Module mit mehreren Bild-Feldern.
export function isTilesModule(contentFields: ContentTypeField[]): boolean {
  return contentFields.filter((f) => f.type === "image").length > 1;
}

// Read-only-Darstellung eines Kacheln-artigen Moduls: festes 2-Spalten-
// Raster, jede Kachel quadratisch zugeschnitten (CSS `object-cover`,
// bevorzugt das serverseitig generierte quadratische Thumbnail). Bewusst
// ohne die Breiten-/Ausrichtungs-/Float-Logik von `BlockFieldOutput`s
// Bild-Zweig – Kacheln sitzen immer fest im Raster.
export function TilesGridOutput({
  contentFields,
  values,
}: {
  contentFields: ContentTypeField[];
  values: Record<string, unknown>;
}) {
  const imageFields = contentFields.filter((f) => f.type === "image");
  return (
    <div className="grid grid-cols-2 gap-2">
      {imageFields.map((field) => {
        const img = toImageValue(values[field.name]);
        if (!img.url) return null;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={field.name}
            src={resolveImageSrc(img.thumbnailUrl ?? img.url)}
            alt=""
            className="aspect-square w-full rounded-md object-cover"
          />
        );
      })}
    </div>
  );
}

// Erkennt Module ohne jegliches sichtbares Feld (der "Trenner"-Baustein)
// – wie bei `isTilesModule` über die Form statt über den Modul-Slug.
export function isDividerModule(contentFields: ContentTypeField[]): boolean {
  return contentFields.length === 0;
}

export function DividerOutput() {
  return <hr className="my-6 border-t border-border" />;
}

// Erkennt Repeater-Felder, deren Unterfelder ein Bild enthalten (die
// "Bildergalerie") – Form-Erkennung statt Slug, analog zu `isTilesModule`.
// Ein Repeater ohne Bild-Unterfeld (z.B. FAQ) wird stattdessen als
// Akkordeon gerendert (siehe `BlockFieldOutput`).
export function isGalleryRepeater(field: ContentTypeField): boolean {
  return (
    field.type === "repeater" &&
    (field.fields ?? []).some((f) => f.type === "image")
  );
}

// Gemeinsame Positionierungs-Klassen für einen Block-Wrapper: echtes
// Float bei links/rechts (damit ein nachfolgender Block ohne eigene
// Ausrichtung daneben umbrechen kann), `clear-both` sonst (Standardfall
// – ein Block ohne explizite Ausrichtung soll sich nie unerwartet neben
// ein vorheriges Float quetschen).
export function blockLayoutClasses(align: ImageAlign) {
  return cn(
    align === "left" && "float-left mr-4 mb-3",
    align === "right" && "float-right ml-4 mb-3",
    align === "center" && "mx-auto clear-both",
    (align === "none" || align === "full") && "clear-both",
  );
}

// Rendert ein einzelnes Modul-Feld so, wie es "wirklich aussieht" – kein
// Input/Textarea, keine Formular-Chrome. Gemeinsam genutzt vom
// Block-Editor (mit Platzhaltern für leere Felder, damit man sieht, wo
// man klicken kann) und der öffentlichen Vorschau-Seite (ohne
// Platzhalter – ein leeres Feld zeigt auf der echten Seite auch nichts).
export function BlockFieldOutput({
  field,
  value,
  showPlaceholders = false,
  // false, wenn ein umgebender Block-Wrapper Breite/Ausrichtung bereits
  // selbst übernimmt (Modul besteht NUR aus diesem Bild-Feld, siehe
  // `resolveBlockLayout`) – sonst würde die Breite doppelt angewendet
  // (z.B. 40% eines bereits auf 40% geschrumpften Elternteils).
  applyOwnLayout = true,
}: {
  field: ContentTypeField;
  value: unknown;
  showPlaceholders?: boolean;
  applyOwnLayout?: boolean;
}) {
  const stringValue = typeof value === "string" ? value : "";

  if (field.type === "image") {
    const img = toImageValue(value);
    if (!img.url) {
      if (!showPlaceholders) return null;
      return (
        <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-10 text-sm text-muted-foreground">
          <ImageIcon className="size-6" />
          Kein Bild
        </div>
      );
    }
    const width = img.align === "full" ? 100 : (img.width ?? 100);
    return (
      <picture>
        {(["avif", "webp"] as const).map((format) => {
          const set = img.variants?.filter((v) => v.format === format) ?? [];
          if (set.length === 0) return null;
          return (
            <source
              key={format}
              type={`image/${format}`}
              srcSet={set
                .map((v) => `${resolveImageSrc(v.url)} ${v.width}w`)
                .join(", ")}
            />
          );
        })}
        <img
          src={resolveImageSrc(img.url)}
          alt=""
          style={{
            ...(applyOwnLayout && { width: `${width}%` }),
            objectPosition: focalObjectPosition(img),
          }}
          className={cn(
            "block max-h-[36rem] rounded-md object-cover",
            !applyOwnLayout && "w-full",
            applyOwnLayout &&
              cn(
                // Echtes Float statt flex/justify-*, damit nachfolgender
                // Text (z.B. beim "Bild + Text"-Baustein) neben dem Bild
                // umbricht, statt immer in einer eigenen Zeile darunter zu
                // stehen.
                img.align === "left" && "float-left mr-4 mb-2",
                img.align === "right" && "float-right ml-4 mb-2",
                img.align === "center" && "mx-auto",
              ),
          )}
        />
      </picture>
    );
  }

  if (field.type === "repeater") {
    const items = toRepeaterItems(value);
    if (items.length === 0) {
      if (!showPlaceholders) return null;
      return (
        <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-10 text-sm text-muted-foreground">
          Noch keine Einträge
        </div>
      );
    }

    const subFields = field.fields ?? [];

    if (isGalleryRepeater(field)) {
      const imageField = subFields.find((f) => f.type === "image");
      const captionField = subFields.find((f) => f.type !== "image");
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item) => {
            const img = imageField
              ? toImageValue(item.values[imageField.name])
              : null;
            if (!img?.url) return null;
            return (
              <figure key={item.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveImageSrc(img.url)}
                  alt=""
                  style={{ objectPosition: focalObjectPosition(img) }}
                  className="aspect-square w-full rounded-md object-cover"
                />
                {captionField && (
                  <BlockFieldOutput
                    field={captionField}
                    value={item.values[captionField.name]}
                  />
                )}
              </figure>
            );
          })}
        </div>
      );
    }

    // Akkordeon (z.B. FAQ): erstes Text-Unterfeld ist die Summary, der
    // Rest klappt per nativem `<details>` auf – keine Client-JS-Logik
    // nötig, funktioniert dadurch identisch in der serverseitig
    // gerenderten Vorschau-Seite.
    const summaryField = subFields.find(
      (f) => f.type === "string" || f.type === "text",
    );
    const bodyFields = subFields.filter((f) => f.name !== summaryField?.name);
    return (
      <div className="divide-y divide-border rounded-md border">
        {items.map((item) => (
          <details key={item.id} className="p-4">
            <summary className="cursor-pointer list-none font-medium marker:content-none">
              {summaryField
                ? String(item.values[summaryField.name] ?? "") || "…"
                : "Eintrag"}
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {bodyFields.map((subField) => (
                <BlockFieldOutput
                  key={subField.name}
                  field={subField}
                  value={item.values[subField.name]}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    );
  }

  if (!stringValue && !showPlaceholders) return null;

  if (field.type === "richtext") {
    return <RichTextDisplay html={stringValue} />;
  }

  if (field.type === "text") {
    return (
      <p
        className={cn(
          "whitespace-pre-wrap text-base",
          field.variant === "quote" &&
            "border-l-2 border-orange-300 pl-4 text-lg italic",
        )}
      >
        {stringValue || "…"}
      </p>
    );
  }

  if (field.variant === "button") {
    return (
      <span className="inline-flex w-fit rounded-md bg-gradient-to-r from-orange-400 to-rose-500 px-4 py-2 text-sm font-medium text-white">
        {stringValue || field.name}
      </span>
    );
  }

  return (
    <p
      className={cn(
        "text-base",
        field.variant === "caption" && "text-sm text-muted-foreground",
      )}
    >
      {stringValue || "…"}
    </p>
  );
}
