import type { CSSProperties, ReactNode } from "react";
import { Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { RichTextDisplay } from "./rich-text-display";
import { GallerySwiper } from "./gallery-swiper";
import { resolveImageSrc } from "./media";
import { cn } from "./cn";
import {
  DEFAULT_GALLERY_SETTINGS,
  type GallerySettings,
} from "./gallery-settings";
import type {
  BlockHeightValue,
  BlockLayoutValue,
  ContentTypeField,
  ImageFit,
} from "./types";
import {
  focalObjectPosition,
  isGalleryRepeater,
  spacingStyleVars,
  toImageValue,
  toRepeaterItems,
  toVideoValue,
  videoEmbedSrc,
} from "./block-values";

/** Rendert den eigentlichen Block-Inhalt in einem eigenen Wrapper, der den
 * nutzerdefinierten Innen-/Außenabstand trägt (siehe `.block-spacing` in
 * globals.css der jeweiligen App) – bewusst ein zusätzlicher, innerer
 * Wrapper statt die Werte direkt auf den äußeren (Float-/Breiten-/Drag-)
 * Wrapper zu setzen, damit sich das nicht mit dessen eigenen
 * Tailwind-Klassen überschneidet. Ohne gesetzte Werte hat die Klasse
 * keine sichtbare Wirkung. */
export function BlockSpacingWrapper({
  layout,
  className,
  children,
}: {
  layout: BlockLayoutValue | undefined;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("block-spacing", className)}
      style={
        {
          ...spacingStyleVars(layout?.padding, "padding"),
          ...spacingStyleVars(layout?.margin, "margin"),
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
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

export function DividerOutput() {
  return <hr className="my-6 border-t border-border" />;
}

// Vollflächiges Hero-/Cover-Modul: Hintergrundbild, Überschrift, optionaler
// Untertext und optionaler Button, alle mittig übereinander. Feldrollen
// werden über Typ/Variant statt fester Feldnamen bestimmt, damit der
// Baustein wie alle anderen rein über sein Schema erkannt wird.
/** CSS-Klasse je Bild-Füllung. Als feste Zuordnung statt zusammengebauter
 * Klassennamen, damit Tailwind sie im Quelltext findet. */
const FIT_CLASS: Record<ImageFit, string> = {
  cover: "object-cover",
  contain: "object-contain",
  fill: "object-fill",
};

export function CoverOutput({
  contentFields,
  values,
  height,
}: {
  contentFields: ContentTypeField[];
  values: Record<string, unknown>;
  /** Höhe aus `BlockLayoutValue` (Nutzervorgabe, 2026-09-03). Ohne
   * Angabe bleibt es bei der bisherigen Mindesthöhe von 320px. */
  height?: BlockHeightValue;
}) {
  const imageField = contentFields.find(
    (f) => f.type === "image" && f.variant === "cover",
  );
  const buttonField = contentFields.find((f) => f.variant === "button");
  const textFields = contentFields.filter(
    (f) =>
      f !== imageField &&
      f !== buttonField &&
      (f.type === "string" || f.type === "text"),
  );
  const headingField = textFields[0];
  const subtextField = textFields[1];

  const img = imageField ? toImageValue(values[imageField.name]) : null;
  const heading = headingField ? String(values[headingField.name] ?? "") : "";
  const subtext = subtextField ? String(values[subtextField.name] ?? "") : "";
  const buttonLabel = buttonField ? String(values[buttonField.name] ?? "") : "";

  // `minHeight` statt `height`: der Text im Cover darf die Fläche
  // wachsen lassen, wenn er länger ist als die eingestellte Höhe – sonst
  // stünde er über den Rand hinaus.
  const heightStyle =
    height === "screen"
      ? // Kopfzeile abziehen (Nutzervorgabe, 2026-09-03): sie steht ueber
        // dem Aufmacher, reines 100vh liefe genau um ihre Hoehe unter den
        // Bildschirmrand. Der Wert wird auf der Website zur Laufzeit
        // gemessen (header-height-sync.tsx); wo es ihn nicht gibt -- etwa
        // im Seiten-Designer -- greift der Rueckfall 0px und es bleibt bei
        // vollen 100vh.
        { minHeight: "calc(100vh - var(--header-height, 0px))" }
      : typeof height === "number"
        ? { minHeight: `${height}px` }
        : undefined;

  return (
    <div
      style={heightStyle}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-md bg-muted",
        // Vorgabe nur, solange nichts eingestellt ist.
        height === undefined && "min-h-80",
      )}
    >
      {img?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveImageSrc(img.url)}
          alt=""
          style={{ objectPosition: focalObjectPosition(img) }}
          className={cn(
            "absolute inset-0 size-full",
            FIT_CLASS[img.fit ?? "cover"],
          )}
        />
      ) : (
        <ImageIcon className="absolute size-10 text-muted-foreground" />
      )}
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex max-w-2xl flex-col items-center gap-3 px-6 py-12 text-center text-white">
        <h2 className="text-3xl font-bold text-balance">{heading || "…"}</h2>
        {subtext && (
          <p className="text-lg text-white/90 text-balance">{subtext}</p>
        )}
        {buttonLabel && (
          <span className="mt-2 inline-flex w-fit rounded-md bg-gradient-to-r from-orange-400 to-rose-500 px-4 py-2 text-sm font-medium text-white">
            {buttonLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// Rendert ein einzelnes Modul-Feld so, wie es "wirklich aussieht" – kein
// Input/Textarea, keine Formular-Chrome. Gemeinsam genutzt vom
// Block-Editor (mit Platzhaltern für leere Felder, damit man sieht, wo
// man klicken kann) und der öffentlichen Website (ohne Platzhalter – ein
// leeres Feld zeigt auf der echten Seite auch nichts).
export function BlockFieldOutput({
  field,
  value,
  showPlaceholders = false,
  // false, wenn ein umgebender Block-Wrapper Breite/Ausrichtung bereits
  // selbst übernimmt (Modul besteht NUR aus diesem Bild-Feld, siehe
  // `resolveBlockLayout`) – sonst würde die Breite doppelt angewendet.
  applyOwnLayout = true,
  // Nur für Galerie-Repeater relevant: rendert den echten Swiper-Slider
  // statt der statischen Vorschau-Raster-Ansicht.
  interactive = false,
  gallerySettings,
  swiperAllowTouchMove = true,
  // Formular-Baustein: das eigentliche Rendern eines Formulars braucht
  // App-spezifische UI-Bausteine und einen App-spezifischen Übermittlungs-
  // weg (BFF-Proxy-Route) – dieses Paket bleibt dadurch UI-Kit-agnostisch
  // und funktioniert identisch im Backend (apps/web, übergibt
  // `FormBlockRender`) und im künftigen Frontend (apps/site, eigene
  // Implementierung). Ohne Angabe wird der Formular-Baustein einfach
  // nicht gerendert, statt eine Ausnahme zu werfen.
  renderForm,
  // false im Backend (Seiten-Designer und Vorschau): dort säße ein Bild
  // in voller Fensterbreite quer über die ganze Anwendung, über Sidebar
  // und Formularspalten hinweg. Es wird dann wie "volle Breite"
  // dargestellt; der gespeicherte Wert bleibt unberührt.
  allowBleed = true,
}: {
  field: ContentTypeField;
  value: unknown;
  showPlaceholders?: boolean;
  applyOwnLayout?: boolean;
  allowBleed?: boolean;
  interactive?: boolean;
  gallerySettings?: GallerySettings;
  swiperAllowTouchMove?: boolean;
  renderForm?: (formId: string) => ReactNode;
}) {
  const stringValue = typeof value === "string" ? value : "";

  if (field.type === "form") {
    if (!showPlaceholders && !stringValue) return null;
    return renderForm ? renderForm(stringValue) : null;
  }

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
    // "Volle Fensterbreite" muss auch HIER greifen, nicht nur am
    // Block-Wrapper (Nutzer-Bugreport, 2026-09-03: "volle fensterbreite
    // gestellt, nichts hat sich verändert"). Hat ein Modul außer dem Bild
    // noch weitere Felder – der mitgelieferte "Bild"-Baustein hat einen
    // Alt-Text –, gilt das Bild als blockintern: der Wrapper bleibt
    // neutral und die Ausrichtung wird am Bild selbst angewandt (siehe
    // resolveBlockLayout). Ohne diesen Zweig lief "randlos" bei genau den
    // Bausteinen ins Leere, für die man es am ehesten benutzt.
    //
    // Die Inline-Breite entfällt dabei bewusst: sie würde `w-screen`
    // schlagen, weil Inline-Angaben jede Klasse überstimmen.
    const isBleed = img.align === "bleed" && allowBleed;
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
            ...(applyOwnLayout && !isBleed && { width: `${width}%` }),
            objectPosition: focalObjectPosition(img),
          }}
          className={cn(
            "block max-h-[36rem] object-cover",
            // Randlos verliert die Ecken-Rundung: ein Element, das bündig
            // an beiden Fensterrändern sitzt, hat dort nichts zu runden.
            !isBleed && "rounded-md",
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
                isBleed &&
                  "w-screen max-w-none ml-[calc(50%-50vw)] mr-[calc(50%-50vw)]",
              ),
          )}
        />
      </picture>
    );
  }

  if (field.type === "video") {
    const video = toVideoValue(value);
    if (!video.url) {
      if (!showPlaceholders) return null;
      return (
        <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed py-10 text-sm text-muted-foreground">
          <VideoIcon className="size-6" />
          Kein Video
        </div>
      );
    }
    const embedSrc = videoEmbedSrc(video.url);
    if (embedSrc) {
      return (
        <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
          <iframe
            src={embedSrc}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        </div>
      );
    }
    return (
      <video
        src={resolveImageSrc(video.url)}
        controls
        className="block max-h-[36rem] w-full rounded-md bg-black"
      />
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

      if (interactive) {
        const images = items.flatMap((item) => {
          const img = imageField
            ? toImageValue(item.values[imageField.name])
            : null;
          if (!img?.url) return [];
          const caption = captionField
            ? String(item.values[captionField.name] ?? "")
            : "";
          return [
            { url: img.url, focalX: img.focalX, focalY: img.focalY, caption },
          ];
        });
        return (
          <GallerySwiper
            images={images}
            settings={gallerySettings ?? DEFAULT_GALLERY_SETTINGS}
            allowTouchMove={swiperAllowTouchMove}
          />
        );
      }

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
    // nötig, funktioniert dadurch identisch serverseitig gerendert.
    const summaryField = subFields.find(
      (f) => f.type === "string" || f.type === "text",
    );
    // Boolean-Unterfelder (z.B. "published") steuern nur Sichtbarkeit,
    // sind kein darstellbarer Inhalt.
    const bodyFields = subFields.filter(
      (f) => f.name !== summaryField?.name && f.type !== "boolean",
    );
    // Fehlender Wert (Einträge von vor Einführung des Felds) gilt als
    // veröffentlicht.
    const publishField = subFields.find((f) => f.type === "boolean");
    const visibleItems = publishField
      ? items.filter((item) => item.values[publishField.name] !== false)
      : items;
    return (
      <div className="divide-y divide-border rounded-md border">
        {visibleItems.map((item) => (
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
