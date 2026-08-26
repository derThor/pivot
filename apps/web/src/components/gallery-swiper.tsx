"use client";

import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper/types";
import {
  Autoplay,
  EffectCards,
  EffectCoverflow,
  EffectCreative,
  EffectCube,
  EffectFade,
  EffectFlip,
  Navigation,
  Pagination,
  Scrollbar,
  Thumbs,
} from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/scrollbar";
import "swiper/css/thumbs";
import "swiper/css/effect-fade";
import "swiper/css/effect-cube";
import "swiper/css/effect-coverflow";
import "swiper/css/effect-cards";
import "swiper/css/effect-flip";
import "swiper/css/effect-creative";

import { resolveImageSrc } from "@/lib/media";
import {
  LOOP_INCOMPATIBLE_EFFECTS,
  SINGLE_SLIDE_EFFECTS,
  type GallerySettings,
} from "@/lib/gallery-settings";
import { cn } from "@/lib/utils";

export interface GallerySwiperImage {
  url: string;
  focalX?: number;
  focalY?: number;
  caption?: string;
}

/** Rendert eine Galerie als konfigurierbaren Swiper-Slider – Effekt/
 * Autoplay/Navigation/Pagination kommen aus den pro-Galerie gesetzten
 * `GallerySettings` (siehe gallery-settings.ts, direkt in der jeweiligen
 * Galerie unter /dashboard/content/galleries editierbar). */
export function GallerySwiper({
  images,
  settings,
  className,
  // Im Seiten-Designer-Canvas ist der ganze Block per natives HTML5-DnD
  // ziehbar (Umsortieren) – Swipers eigene Touch-/Maus-Ziehlogik für die
  // Slides würde dieselben Zeigerereignisse abgreifen und den Drag zum
  // Umsortieren verhindern. Dort wird das Wisch-Ziehen deshalb deaktiviert
  // (Pfeile/Punkte/Autoplay/Effekt bleiben trotzdem sichtbar) – in der
  // echten Ausgabe (Vorschau/Live-Seite) bleibt es an.
  allowTouchMove = true,
  // Nur für die Live-Vorschau im Galerie-Editor gedacht (Nutzervorgabe,
  // 2026-08-15): begrenzt die Slide-Höhe fest statt über `aspect-video` zu
  // gehen, damit hochformatige Bilder dort nicht die ganze Karte sprengen.
  // Ohne Angabe unverändertes Verhalten (16:9), betrifft also nicht die
  // öffentliche Ausgabe/den Seiten-Designer.
  maxHeight,
}: {
  images: GallerySwiperImage[];
  settings: GallerySettings;
  className?: string;
  allowTouchMove?: boolean;
  maxHeight?: number;
}) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperInstance | null>(null);

  if (images.length === 0) return null;

  const isSingleSlideEffect = SINGLE_SLIDE_EFFECTS.includes(settings.effect);
  const showThumbnails = settings.thumbnails && images.length > 1;

  return (
    <div className={cn("gallery-swiper-wrapper w-full", className)}>
      <Swiper
        // Swiper initialisiert sein Effekt-Modul (Fade/Cube/Coverflow/
        // Cards/Flip/Creative) nur beim ersten Mount – ein späteres Ändern
        // der `effect`-Prop allein aktualisiert die zugehörigen Transform-/
        // Perspektive-Styles nicht sauber (kaputtes Layout bis Neuladen).
        // `key` erzwingt bei jedem Effekt-Wechsel einen echten Remount der
        // Swiper-Instanz.
        key={settings.effect}
        modules={[
          Navigation,
          Pagination,
          Autoplay,
          Scrollbar,
          Thumbs,
          EffectFade,
          EffectCube,
          EffectCoverflow,
          EffectCards,
          EffectFlip,
          EffectCreative,
        ]}
        effect={settings.effect}
        // Ohne eigene Konfiguration hat der "creative"-Effekt keinen
        // sichtbaren Übergang (Swiper-Default ist ein Identitäts-Transform,
        // siehe effect-creative.mjs) – dieses Preset (vorheriges Bild nach
        // links/hinten mit Schatten, nächstes von rechts) ist eines von
        // Swipers eigenen offiziellen Demo-Presets, keine erfundene
        // Konfiguration.
        creativeEffect={
          settings.effect === "creative"
            ? {
                prev: { shadow: true, translate: ["-20%", 0, -1] },
                next: { translate: ["100%", 0, 0] },
              }
            : undefined
        }
        slidesPerView={isSingleSlideEffect ? 1 : settings.slidesPerView}
        spaceBetween={isSingleSlideEffect ? 0 : settings.spaceBetween}
        // Für manche Effekte bricht `loop` die Pfeil-/Punkt-Navigation
        // (siehe LOOP_INCOMPATIBLE_EFFECTS) – unabhängig von der
        // Endlosschleife-Einstellung immer aus.
        loop={
          settings.loop &&
          images.length > 1 &&
          !LOOP_INCOMPATIBLE_EFFECTS.includes(settings.effect)
        }
        navigation={settings.navigation}
        pagination={settings.pagination ? { clickable: true } : false}
        scrollbar={settings.scrollbar ? { draggable: true } : false}
        thumbs={showThumbnails ? { swiper: thumbsSwiper } : undefined}
        autoplay={
          settings.autoplay
            ? { delay: settings.autoplayDelay, disableOnInteraction: false }
            : false
        }
        allowTouchMove={allowTouchMove}
        simulateTouch={allowTouchMove}
        className="w-full rounded-md"
      >
        {images.map((img, index) => (
          <SwiperSlide key={`${img.url}-${index}`}>
            <figure
              className={cn(
                "relative w-full overflow-hidden rounded-md bg-muted",
                maxHeight == null && "aspect-video",
              )}
              style={maxHeight != null ? { height: maxHeight } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveImageSrc(img.url)}
                alt=""
                style={{
                  objectPosition:
                    img.focalX != null && img.focalY != null
                      ? `${img.focalX * 100}% ${img.focalY * 100}%`
                      : undefined,
                }}
                className="size-full object-cover"
              />
              {settings.showCaptions && img.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-sm text-white">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          </SwiperSlide>
        ))}
      </Swiper>
      {showThumbnails && (
        <Swiper
          onSwiper={setThumbsSwiper}
          watchSlidesProgress
          slidesPerView={Math.min(images.length, 6)}
          spaceBetween={8}
          className="gallery-swiper-thumbs mt-2 w-full"
        >
          {images.map((img, index) => (
            <SwiperSlide key={`thumb-${img.url}-${index}`}>
              <div className="aspect-square cursor-pointer overflow-hidden rounded-md bg-muted opacity-60 transition-opacity hover:opacity-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveImageSrc(img.url)}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}
      <style jsx global>{`
        .gallery-swiper-wrapper {
          --swiper-theme-color: #f97316;
        }
        .gallery-swiper-thumbs .swiper-slide-thumb-active > div {
          opacity: 1;
          outline: 2px solid var(--swiper-theme-color);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
