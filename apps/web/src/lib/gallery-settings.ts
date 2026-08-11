// Anzeige-Einstellungen einer einzelnen Galerie (GlobalModule.settings) –
// steuert den Swiper-Slider in der Ausgabe (siehe gallery-swiper.tsx).
// Bewusst pro Galerie-Instanz statt pro Modul-Typ, da unterschiedliche
// Galerien auf derselben Seite unterschiedlich wirken sollen (z.B. eine
// Referenzen-Galerie mit Autoplay, eine Produktgalerie ohne).

export const GALLERY_EFFECTS = [
  "slide",
  "fade",
  "cube",
  "coverflow",
  "cards",
] as const;

export type GalleryEffect = (typeof GALLERY_EFFECTS)[number];

export const GALLERY_EFFECT_LABELS: Record<GalleryEffect, string> = {
  slide: "Slide",
  fade: "Überblenden",
  cube: "Würfel",
  coverflow: "Coverflow",
  cards: "Karten",
};

// Effekte, bei denen Swiper technisch nur eine Slide gleichzeitig zeigen
// kann – `slidesPerView` wird für diese in der Ausgabe ignoriert.
export const SINGLE_SLIDE_EFFECTS: readonly GalleryEffect[] = [
  "fade",
  "cube",
  "cards",
];

export interface GallerySettings {
  effect: GalleryEffect;
  slidesPerView: number;
  spaceBetween: number;
  loop: boolean;
  autoplay: boolean;
  autoplayDelay: number;
  navigation: boolean;
  pagination: boolean;
}

export const DEFAULT_GALLERY_SETTINGS: GallerySettings = {
  effect: "slide",
  slidesPerView: 3,
  spaceBetween: 16,
  loop: false,
  autoplay: false,
  autoplayDelay: 4000,
  navigation: true,
  pagination: true,
};

function isGalleryEffect(value: unknown): value is GalleryEffect {
  return GALLERY_EFFECTS.includes(value as GalleryEffect);
}

/** Parst gespeicherte (möglicherweise unvollständige/veraltete) Settings,
 * fällt Feld für Feld auf die Defaults zurück statt das ganze Objekt zu
 * verwerfen. */
export function toGallerySettings(raw: unknown): GallerySettings {
  if (!raw || typeof raw !== "object") return DEFAULT_GALLERY_SETTINGS;
  const obj = raw as Record<string, unknown>;
  return {
    effect: isGalleryEffect(obj.effect) ? obj.effect : DEFAULT_GALLERY_SETTINGS.effect,
    slidesPerView:
      typeof obj.slidesPerView === "number" && obj.slidesPerView > 0
        ? obj.slidesPerView
        : DEFAULT_GALLERY_SETTINGS.slidesPerView,
    spaceBetween:
      typeof obj.spaceBetween === "number" && obj.spaceBetween >= 0
        ? obj.spaceBetween
        : DEFAULT_GALLERY_SETTINGS.spaceBetween,
    loop: typeof obj.loop === "boolean" ? obj.loop : DEFAULT_GALLERY_SETTINGS.loop,
    autoplay:
      typeof obj.autoplay === "boolean" ? obj.autoplay : DEFAULT_GALLERY_SETTINGS.autoplay,
    autoplayDelay:
      typeof obj.autoplayDelay === "number" && obj.autoplayDelay > 0
        ? obj.autoplayDelay
        : DEFAULT_GALLERY_SETTINGS.autoplayDelay,
    navigation:
      typeof obj.navigation === "boolean" ? obj.navigation : DEFAULT_GALLERY_SETTINGS.navigation,
    pagination:
      typeof obj.pagination === "boolean" ? obj.pagination : DEFAULT_GALLERY_SETTINGS.pagination,
  };
}
