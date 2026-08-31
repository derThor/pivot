// Kanonische Definitionen – apps/web/src/lib/api-server.ts re-exportiert
// diese drei Typen von hier, statt sie doppelt zu pflegen (siehe dortiger
// Kommentar).

export interface ContentTypeField {
  name: string;
  type: string;
  required?: boolean;
  // Nur für Modul-Felder relevant: Feld ist eine Einstellung (z.B. Alt-Text,
  // Link-Ziel) statt echter, sichtbarer Inhalt – wird im Block-Editor daher
  // nicht inline auf der Fläche gerendert, sondern im Optionen-Popup.
  option?: boolean;
  // Nur für Modul-Felder relevant: reine CSS-Darstellungs-Hinweise für die
  // Inline-Vorschau im Block-Editor. "cover" gilt nur für `type: "image"`-
  // Felder: markiert das Bild eines Cover-Bausteins als Vollflächen-
  // Hintergrund statt normaler Fließ-/Ausrichtungs-Logik (siehe
  // isCoverModuleType in block-recognizers.ts).
  variant?: "button" | "quote" | "caption" | "cover";
  // Nur für Modul-Felder relevant: Beispielwert, mit dem eine neu
  // eingefügte Modul-Instanz vorbefüllt wird.
  example?: unknown;
  // Nur für `type: "repeater"`: Schema der Unterfelder pro Listen-Eintrag.
  fields?: ContentTypeField[];
}

export interface GlobalModule {
  id: string;
  name: string;
  values: Record<string, unknown>;
  settings?: Record<string, unknown> | null;
  moduleTypeId: string;
  moduleType: { id: string; name: string; icon: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface MediaVariant {
  id: string;
  width: number;
  format: string;
  url: string;
  size: number;
}

export type ImageAlign = "none" | "full" | "left" | "center" | "right";

export interface ImageFieldValue {
  url: string;
  width?: number;
  align?: ImageAlign;
  mediaId?: string;
  variants?: MediaVariant[];
  thumbnailUrl?: string;
  focalX?: number;
  focalY?: number;
}

export interface RepeaterItem {
  id: string;
  values: Record<string, unknown>;
}

export interface VideoFieldValue {
  url: string;
  mediaId?: string;
}

export type SpacingSide = "top" | "right" | "bottom" | "left";

export const SPACING_SIDES: readonly SpacingSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

export type BoxSpacing = Partial<Record<SpacingSide, number>>;

export interface ResponsiveSpacing {
  mobile?: BoxSpacing;
  desktop?: BoxSpacing;
}

export interface BlockLayoutValue {
  width?: number;
  align?: ImageAlign;
  padding?: ResponsiveSpacing;
  margin?: ResponsiveSpacing;
}
