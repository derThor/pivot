import { Image as ImageIcon } from "lucide-react";
import { RichTextDisplay } from "@/components/rich-text-display";
import { resolveImageSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { ContentTypeField } from "@/lib/api-server";

export type ImageAlign = "none" | "full" | "left" | "center" | "right";

export interface ImageFieldValue {
  url: string;
  // Breite in Prozent der verfügbaren Spaltenbreite (10-100), per
  // Zieh-Griff im Block-Editor gesetzt. `undefined` = 100 (volle Breite
  // der Spalte, aber noch nicht "full" – siehe `align`).
  width?: number;
  align?: ImageAlign;
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
    };
  }
  return { url: "" };
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
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolveImageSrc(img.url)}
        alt=""
        style={applyOwnLayout ? { width: `${width}%` } : undefined}
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
