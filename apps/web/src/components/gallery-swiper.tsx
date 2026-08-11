"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import {
  Autoplay,
  EffectCards,
  EffectCoverflow,
  EffectCube,
  EffectFade,
  Navigation,
  Pagination,
} from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-fade";
import "swiper/css/effect-cube";
import "swiper/css/effect-coverflow";
import "swiper/css/effect-cards";

import { resolveImageSrc } from "@/lib/media";
import {
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
}: {
  images: GallerySwiperImage[];
  settings: GallerySettings;
  className?: string;
  allowTouchMove?: boolean;
}) {
  if (images.length === 0) return null;

  const isSingleSlideEffect = SINGLE_SLIDE_EFFECTS.includes(settings.effect);

  return (
    <div className={cn("gallery-swiper-wrapper w-full", className)}>
      <Swiper
        modules={[Navigation, Pagination, Autoplay, EffectFade, EffectCube, EffectCoverflow, EffectCards]}
        effect={settings.effect}
        slidesPerView={isSingleSlideEffect ? 1 : settings.slidesPerView}
        spaceBetween={isSingleSlideEffect ? 0 : settings.spaceBetween}
        loop={settings.loop && images.length > 1}
        navigation={settings.navigation}
        pagination={settings.pagination ? { clickable: true } : false}
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
            <figure className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
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
              {img.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-sm text-white">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          </SwiperSlide>
        ))}
      </Swiper>
      <style jsx global>{`
        .gallery-swiper-wrapper {
          --swiper-theme-color: #f97316;
        }
      `}</style>
    </div>
  );
}
