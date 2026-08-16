"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  Component,
  FileText,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Maximize2,
  MousePointerClick,
  Pencil,
  Quote,
  Ruler,
  Search,
  SeparatorHorizontal,
  Square,
  Trash2,
  Video as VideoIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BlockFieldOutput,
  BlockSpacingWrapper,
  CoverOutput,
  DividerOutput,
  TilesGridOutput,
  blockLayoutClasses,
  focalObjectPosition,
  isComplexModuleType,
  isCoverModuleType,
  isDividerModule,
  isGalleryModuleType,
  isTilesModule,
  resolveBlockLayout,
  resolveInstanceValues,
  toImageValue,
  toVideoValue,
  videoEmbedSrc,
  SPACING_SIDES,
  type BlockLayoutValue,
  type BoxSpacing,
  type ImageAlign,
  type ImageFieldValue,
  type ResponsiveSpacing,
  type SpacingSide,
} from "@/components/block-field-output";
import { ImagePickerDialog } from "@/components/image-picker-dialog";
import { VideoPickerDialog } from "@/components/video-picker-dialog";
import { InsertSharedBlockDialog } from "@/components/insert-shared-block-dialog";
import { ModuleFieldInput } from "@/components/module-field-input";
import { resolveImageSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import { toGallerySettings } from "@/lib/gallery-settings";
import type { GlobalModule, ModuleType } from "@/lib/api-server";

const ALIGN_OPTIONS: { value: ImageAlign; label: string; icon: typeof Square }[] = [
  { value: "none", label: "Keine", icon: Square },
  { value: "full", label: "Volle Breite", icon: Maximize2 },
  { value: "left", label: "Linksbündig", icon: AlignLeft },
  { value: "center", label: "Zentrieren", icon: AlignCenter },
  { value: "right", label: "Rechtsbündig", icon: AlignRight },
];

// Bild-Feld im Editor: per Zieh-Griff (unten rechts) frei skalierbar –
// im Gegensatz zu allen anderen Feldtypen bewusst NICHT rein lesend, auf
// ausdrücklichen Nutzerwunsch ("Größe per Drag&Drop ändern"). Klick auf
// das Bild selbst löst bewusst KEIN Bearbeiten-Popup aus (das Bild hat
// seine eigene direkte Bedienung: Griff + die Ausrichtungs-/Ersetzen-
// Buttons in der gemeinsamen Block-Toolbar oben, siehe Elternteil).
// Sichtbarkeit des Griffs hängt am äußeren `group` des Blocks – bewusst
// KEIN eigener, verschachtelter Hover-Bereich, sonst entstehen zwei
// unabhängig ein-/ausblendende Overlays übereinander.
function EditableImageField({
  value,
  onChange,
  onReplace,
  // false bei Modulen, die NUR aus diesem einen Bild-Feld bestehen (z.B.
  // "Bild"): dort übernimmt bereits der äußere Block-Wrapper Breite/Float
  // (siehe `resolveBlockLayout`, liest denselben Feldwert) – würde dieses
  // Element seine eigene Breite zusätzlich anwenden, würde doppelt
  // verkleinert (z.B. 40% eines bereits auf 40% geschrumpften Elternteils).
  applyOwnLayout = true,
}: {
  value: unknown;
  onChange: (value: ImageFieldValue) => void;
  onReplace: () => void;
  applyOwnLayout?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const img = toImageValue(value);

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const container = wrapperRef.current?.parentElement;
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;
    const startX = e.clientX;
    const startWidth = img.align === "full" ? 100 : (img.width ?? 100);
    setResizing(true);

    function onMove(ev: PointerEvent) {
      const deltaPct = ((ev.clientX - startX) / containerWidth) * 100;
      const nextWidth = Math.round(Math.min(100, Math.max(15, startWidth + deltaPct)));
      onChange({ ...img, width: nextWidth, align: img.align === "full" ? "none" : img.align });
    }
    function onUp() {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (!img.url) return null;

  const width = img.align === "full" ? 100 : (img.width ?? 100);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative",
        applyOwnLayout &&
          cn(
            // Echtes Float statt flex/justify-*, damit nachfolgender Text
            // (z.B. beim "Bild + Text"-Baustein) neben dem Bild umbricht.
            img.align === "left" && "float-left mr-4 mb-2",
            img.align === "right" && "float-right ml-4 mb-2",
            img.align === "center" && "mx-auto",
          ),
        !applyOwnLayout && "w-full",
      )}
      style={applyOwnLayout ? { width: `${width}%` } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveImageSrc(img.url)}
        alt=""
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        style={{ objectPosition: focalObjectPosition(img) }}
        className="block max-h-[36rem] w-full rounded-md object-cover"
      />
      <button
        type="button"
        draggable={false}
        onClick={(e) => {
          e.stopPropagation();
          onReplace();
        }}
        className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        Ersetzen
      </button>
      <div
        onPointerDown={startResize}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        className={cn(
          "absolute right-0.5 bottom-0.5 size-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-orange-500 opacity-0 shadow transition-opacity group-hover:opacity-100",
          resizing && "opacity-100",
        )}
      />
    </div>
  );
}

export interface ModuleInstance {
  id: string;
  moduleTypeId: string;
  values: Record<string, unknown>;
  // Nur für Module OHNE eigenes Bild-Feld relevant (Rich-Text, CTA-Button,
  // Zitat, …) – Breite/Ausrichtung des ganzen Blocks, siehe
  // `resolveBlockLayout` in block-field-output.tsx.
  layout?: BlockLayoutValue;
  // Gesetzt, wenn dieser Block ein "globales Modul" referenziert statt
  // eigenen Inhalt zu tragen (`values` ist dann leer/ungenutzt) – die
  // tatsächlichen Werte kommen live aus `GlobalModule.values` (siehe
  // `resolveInstanceValues` in block-field-output.tsx). Nur zentral über
  // den "Globale Module"-Tab im Content-Editor bearbeitbar (siehe
  // `onOpenGlobalModulesTab`), hier nur einfüg-/entfernbar.
  globalModuleId?: string;
}

const ICONS: Record<string, typeof Component> = {
  FileText,
  Image: ImageIcon,
  Columns2,
  MousePointerClick,
  Quote,
  LayoutGrid,
  SeparatorHorizontal,
  HelpCircle,
  Images,
  Video: VideoIcon,
  LayoutTemplate,
};

function iconFor(moduleType: ModuleType | undefined) {
  return (moduleType?.icon && ICONS[moduleType.icon]) || Component;
}

function exampleValues(moduleType: ModuleType): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of moduleType.schema.fields) {
    if (field.example !== undefined) result[field.name] = field.example;
  }
  return result;
}

// Payload-Schema für den nativen HTML5-DnD-Transfer: `new:<moduleTypeId>`
// beim Ziehen aus der Palette, `move:<instanceId>` beim Umsortieren eines
// bereits platzierten Blocks.
function DropZone({
  active,
  onDrop,
  large,
  children,
  className,
}: {
  active: boolean;
  onDrop: (payload: string) => void;
  // Größere Trefferfläche (z.B. der komplette Leerzustand) statt eines
  // schmalen Trennstrichs zwischen zwei Blöcken.
  large?: boolean;
  children?: ReactNode;
  // Für an einen einzelnen (geflotteten) Block angehängte Drop-Zonen
  // (siehe unten): überschreibt Positionierung/Größe der Standard-Variante.
  className?: string;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        if (!active) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!active) return;
        e.preventDefault();
        setOver(false);
        onDrop(e.dataTransfer.getData("text/plain"));
      }}
      className={cn(
        "flow-root rounded transition-colors",
        large ? "min-h-32 clear-both" : "h-2",
        active && !large && "h-6",
        // Während eines aktiven Drags ist jede gültige Einfüge-Position
        // sichtbar (schwacher Rahmen/Hintergrund) – wer nicht schon weiß,
        // wo man droppen kann, sieht sonst gar nichts. Direkt getroffene
        // Zone (`over`) sticht zusätzlich kräftiger hervor.
        active &&
          (over
            ? "bg-orange-100 outline-2 outline-dashed outline-orange-400 dark:bg-orange-500/15"
            : "bg-orange-50/60 outline outline-dashed outline-orange-200 dark:bg-orange-500/5 dark:outline-orange-500/20"),
        className,
      )}
    >
      {children}
    </div>
  );
}

const SPACING_SIDE_LABELS: Record<SpacingSide, string> = {
  top: "Oben",
  right: "Rechts",
  bottom: "Unten",
  left: "Links",
};

// Vier Eingabefelder für einen Breakpoint (Mobil oder Desktop) eines
// Innen-/Außenabstands – als Kreuz angeordnet (Oben/Rechts/Unten/Links um
// ein Mittelfeld, wie ein Box-Modell), statt einer schlichten 4er-Reihe –
// macht auf den ersten Blick klar, welches Feld welche Seite meint (siehe
// Spacing-Dialog unten).
function SpacingCrossInputs({
  idPrefix,
  box,
  onChange,
}: {
  idPrefix: string;
  box: BoxSpacing | undefined;
  onChange: (side: SpacingSide, value: string) => void;
}) {
  function field(side: SpacingSide) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Label htmlFor={`${idPrefix}-${side}`} className="text-xs text-muted-foreground">
          {SPACING_SIDE_LABELS[side]}
        </Label>
        <Input
          id={`${idPrefix}-${side}`}
          type="number"
          min={0}
          value={box?.[side] ?? ""}
          onChange={(e) => onChange(side, e.target.value)}
          // Kein festes `w-*`: die Basis-`Input`-Komponente bringt schon
          // `w-full min-w-0` mit – ein fester Pixelwert hier würde das
          // überschreiben und auf sehr schmalen Bildschirmen erzwungenes
          // horizontales Scrollen verursachen (das Feld könnte nicht mehr
          // schrumpfen, egal wie wenig Platz tatsächlich da ist).
          className="min-w-0 text-center"
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 items-center justify-items-center gap-2">
      <div />
      {field("top")}
      <div />
      {field("left")}
      <Square className="size-5 text-muted-foreground" aria-hidden />
      {field("right")}
      <div />
      {field("bottom")}
      <div />
    </div>
  );
}

export function BlockEditorField({
  value,
  onChange,
  moduleTypes,
  globalModules,
}: {
  value: ModuleInstance[];
  onChange: (value: ModuleInstance[]) => void;
  moduleTypes: ModuleType[];
  globalModules: GlobalModule[];
}) {
  const [search, setSearch] = useState("");
  const [draggingPaletteId, setDraggingPaletteId] = useState<string | null>(null);
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [spacingInstanceId, setSpacingInstanceId] = useState<string | null>(null);
  const [resizingLayoutId, setResizingLayoutId] = useState<string | null>(null);
  const [imagePicker, setImagePicker] = useState<{
    instanceId: string;
    fieldName: string;
  } | null>(null);
  const [videoPicker, setVideoPicker] = useState<{
    instanceId: string;
    fieldName: string;
  } | null>(null);
  // Beim Ziehen eines FAQ-/Galerie-Bausteins auf die Fläche (siehe
  // isComplexModuleType) wird nicht sofort eingefügt, sondern erst per
  // `InsertSharedBlockDialog` ausgewählt/angelegt – Position merken, bis
  // der Dialog aufgelöst ist.
  const [pendingInsert, setPendingInsert] = useState<{
    index: number;
    moduleType: ModuleType;
    // Gesetzt, wenn über der Einfüge-Markierung eines links/rechts
    // ausgerichteten Blocks fallen gelassen wurde (siehe `handleDropAt`)
    // – der neu angelegte Block übernimmt dieselbe Ausrichtung, statt
    // "Keine" zu bleiben, sonst reiht er sich optisch nicht in dieselbe
    // Zeile ein.
    matchAlign?: ImageAlign;
  } | null>(null);
  // Referenz-Breite für alle Zieh-Größenänderungen (Bild-Feld UND
  // Block-Layout) – bewusst EIN gemeinsamer Ref auf die stabile
  // Canvas-Spalte statt je Block/Feld eine eigene Messung, sonst würde
  // ein bereits verkleinerter Block seine eigene (falsche, weil schon
  // geschrumpfte) Breite als 100%-Basis für weiteres Ziehen nehmen.
  const columnRef = useRef<HTMLDivElement>(null);

  const isDragging = draggingPaletteId !== null || draggingInstanceId !== null;

  // Vorab berechnete Ausrichtung jeder Instanz – wird gebraucht, um beim
  // Rendern zu wissen, ob der vorherige/nächste Block geflotet ist (siehe
  // Drop-Zonen-Logik unten): eine separate Drop-Zone *zwischen* zwei
  // Blöcken funktioniert mit CSS-Floats nicht zuverlässig (Floats schieben
  // nachfolgende normale Blockelemente im Fluss nicht nach unten, die
  // Drop-Zone würde dadurch an der falschen Stelle rendern) – für
  // geflotete Blöcke wird die Einfüge-Markierung deshalb direkt an den
  // (bereits korrekt positionierten) Block selbst angehängt statt als
  // eigenes Geschwister-Element.
  const instanceAligns = value.map((instance) => {
    const resolved = resolveInstanceValues(instance, globalModules);
    const moduleType = moduleTypes.find((mt) => mt.id === resolved.moduleTypeId);
    const contentFields = moduleType?.schema.fields.filter((f) => !f.option) ?? [];
    return resolveBlockLayout(contentFields, resolved.values, instance.layout).align;
  });
  function isFloatedAlign(align: ImageAlign | undefined) {
    return align === "left" || align === "right";
  }

  const filteredTypes = moduleTypes.filter((mt) =>
    mt.name.toLowerCase().includes(search.toLowerCase()),
  );

  function insertAt(index: number, moduleType: ModuleType, matchAlign?: ImageAlign) {
    const instance: ModuleInstance = {
      id: crypto.randomUUID(),
      moduleTypeId: moduleType.id,
      values: exampleValues(moduleType),
      ...(matchAlign && { layout: { align: matchAlign } }),
    };
    const next = [...value];
    next.splice(index, 0, instance);
    onChange(next);
  }

  // Fügt eine Referenz auf ein globales Modul ein statt eigenen Inhalt –
  // `values` bleibt leer, die tatsächlichen Werte werden immer live über
  // `globalModuleId` aufgelöst (siehe `resolveInstanceValues`).
  // `moduleTypeId` wird trotzdem gespiegelt (Modul-Typ eines globalen
  // Moduls ist nach dem Anlegen unveränderlich, siehe global-module-
  // dialog.tsx) – reine Bequemlichkeit für Stellen, die es ohne Auflösung
  // lesen, keine zweite Quelle der Wahrheit.
  function insertGlobalAt(index: number, globalModule: GlobalModule, matchAlign?: ImageAlign) {
    const instance: ModuleInstance = {
      id: crypto.randomUUID(),
      moduleTypeId: globalModule.moduleTypeId,
      globalModuleId: globalModule.id,
      values: {},
      ...(matchAlign && { layout: { align: matchAlign } }),
    };
    const next = [...value];
    next.splice(index, 0, instance);
    onChange(next);
  }

  function moveTo(instanceId: string, targetIndex: number, matchAlign?: ImageAlign) {
    const fromIndex = value.findIndex((i) => i.id === instanceId);
    if (fromIndex === -1) return;
    const next = [...value];
    const [moved] = next.splice(fromIndex, 1);
    const insertIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
    // Beim Fallenlassen auf die Einfüge-Markierung eines links/rechts
    // ausgerichteten Blocks übernimmt der verschobene Block dieselbe
    // Ausrichtung – seine bisherige Breite bleibt dabei erhalten (die
    // meist schon reduziert war, wenn er selbst ausgerichtet war), sonst
    // reiht er sich trotz korrekter Position optisch nicht in dieselbe
    // Zeile ein.
    const updated = matchAlign
      ? { ...moved, layout: { ...moved.layout, align: matchAlign } }
      : moved;
    next.splice(insertIndex, 0, updated);
    onChange(next);
  }

  function handleDropAt(index: number, payload: string, matchAlign?: ImageAlign) {
    if (payload.startsWith("new:")) {
      const moduleType = moduleTypes.find((mt) => mt.id === payload.slice(4));
      if (!moduleType) return;
      const contentFields = moduleType.schema.fields.filter((f) => !f.option);
      if (isComplexModuleType(contentFields)) {
        setPendingInsert({ index, moduleType, matchAlign });
      } else {
        insertAt(index, moduleType, matchAlign);
      }
    } else if (payload.startsWith("move:")) {
      moveTo(payload.slice(5), index, matchAlign);
    }
  }

  function updateModule(id: string, values: Record<string, unknown>) {
    onChange(value.map((instance) => (instance.id === id ? { ...instance, values } : instance)));
  }

  function updateField(instanceId: string, fieldName: string, fieldValue: unknown) {
    const instance = value.find((i) => i.id === instanceId);
    if (!instance) return;
    updateModule(instanceId, { ...instance.values, [fieldName]: fieldValue });
  }

  function removeModule(id: string) {
    onChange(value.filter((instance) => instance.id !== id));
    setEditingInstanceId((current) => (current === id ? null : current));
  }

  function updateInstanceLayout(instanceId: string, layout: BlockLayoutValue) {
    onChange(value.map((instance) => (instance.id === instanceId ? { ...instance, layout } : instance)));
  }

  // Aktualisiert Innen- (`padding`) oder Außenabstand (`margin`) für eine
  // einzelne Seite (oben/rechts/unten/links) bei einem Breakpoint (Mobil/
  // Desktop) – leeres Feld löscht den Wert dieser Seite wieder (kein
  // eigener Wert = keine Wirkung, siehe `.block-spacing` in globals.css).
  function updateSpacing(
    instanceId: string,
    kind: "padding" | "margin",
    breakpoint: keyof ResponsiveSpacing,
    side: SpacingSide,
    rawValue: string,
  ) {
    const instance = value.find((i) => i.id === instanceId);
    if (!instance) return;
    const numericValue = rawValue.trim() === "" ? undefined : Number(rawValue);
    const currentResponsive = instance.layout?.[kind];
    const nextBox: BoxSpacing = { ...currentResponsive?.[breakpoint], [side]: numericValue };
    const nextResponsive: ResponsiveSpacing = { ...currentResponsive, [breakpoint]: nextBox };
    updateInstanceLayout(instanceId, { ...instance.layout, [kind]: nextResponsive });
  }

  // Block-weite Größenänderung per Zieh-Griff (für Module ohne eigenes
  // Bild-Feld, z.B. Zitat) – analog zu `EditableImageField.startResize`,
  // schreibt aber in `instance.layout` statt in einen Feldwert.
  function startLayoutResize(e: React.PointerEvent, instance: ModuleInstance, currentWidth: number) {
    e.preventDefault();
    e.stopPropagation();
    const containerWidth = columnRef.current?.getBoundingClientRect().width;
    if (!containerWidth) return;
    const startX = e.clientX;
    setResizingLayoutId(instance.id);

    function onMove(ev: PointerEvent) {
      const deltaPct = ((ev.clientX - startX) / containerWidth!) * 100;
      const nextWidth = Math.round(Math.min(100, Math.max(15, currentWidth + deltaPct)));
      updateInstanceLayout(instance.id, {
        align: instance.layout?.align === "full" ? "none" : (instance.layout?.align ?? "none"),
        width: nextWidth,
      });
    }
    function onUp() {
      setResizingLayoutId(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const editingInstance = value.find((i) => i.id === editingInstanceId);
  const editingType = moduleTypes.find((mt) => mt.id === editingInstance?.moduleTypeId);
  const spacingInstance = value.find((i) => i.id === spacingInstanceId);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-8">
      {/* `overflow-y-auto` erzwingt laut CSS-Spec auch `overflow-x: auto`
          (nicht `visible`), sobald eine Achse nicht `visible` ist – ein
          `overflow-x-visible` daneben würde also ignoriert. Einzige echte
          Lösung gegen abgeschnittene Schatten: Innenabstand, der dem
          Schatten Platz gibt, bevor der Container ihn kappt. */}
      <div className="flex w-full shrink-0 flex-col gap-3 self-start md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:w-60 md:overflow-y-auto md:p-2">
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bausteine durchsuchen"
            className="pl-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filteredTypes.map((moduleType) => {
            const Icon = iconFor(moduleType);
            return (
              <div
                key={moduleType.id}
                draggable
                onDragStart={(e) => {
                  setDraggingPaletteId(moduleType.id);
                  e.dataTransfer.setData("text/plain", `new:${moduleType.id}`);
                }}
                onDragEnd={() => setDraggingPaletteId(null)}
                className={cn(
                  "flex cursor-grab flex-col items-center gap-1.5 rounded-lg border bg-card p-3 text-center shadow-md transition-colors hover:border-orange-400 active:cursor-grabbing",
                  draggingPaletteId === moduleType.id && "opacity-50",
                )}
              >
                <Icon className="size-5 text-orange-500" />
                <span className="text-xs font-medium">{moduleType.name}</span>
              </div>
            );
          })}
          {filteredTypes.length === 0 && (
            <p className="col-span-2 text-xs text-muted-foreground">
              Keine Bausteine gefunden.
            </p>
          )}
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-1 flex-col rounded-lg border bg-white shadow-card dark:bg-neutral-950">
        {/* `flow-root` statt `flex flex-col`: Blöcke mit Links-/
            Rechtsbündig floaten (siehe `blockLayoutClasses`) – Flex-Kinder
            ignorieren `float` komplett, außerdem fängt `flow-root` das
            Float innerhalb der Canvas ein statt es nach außen "auslaufen"
            zu lassen. */}
        <div ref={columnRef} className="flow-root px-6 py-4">
          {value.length === 0 ? (
            <DropZone active={isDragging} onDrop={(p) => handleDropAt(0, p)} large>
              <div className="flex h-full flex-col items-center justify-center gap-1 py-12 text-center text-sm text-muted-foreground">
                <p>Noch keine Bausteine.</p>
                <p>Baustein von links hierher ziehen.</p>
              </div>
            </DropZone>
          ) : !isFloatedAlign(instanceAligns[0]) ? (
            <DropZone
              active={isDragging}
              onDrop={(p) => handleDropAt(0, p)}
              className="clear-both"
            />
          ) : null}

          {value.map((instance, index) => {
            // FAQ/Galerie-Bausteine sind immer Referenzen auf eine zentral
            // gepflegte Bibliothek (siehe `resolveInstanceValues`) – Inhalt
            // hier nur lesend, Bearbeiten ausschließlich über die
            // "FAQs"-/"Galerien"-Unterseite bei "Seiten" bzw. beim Einfügen.
            const isGlobal = Boolean(instance.globalModuleId);
            const resolved = resolveInstanceValues(instance, globalModules);
            const moduleType = moduleTypes.find((mt) => mt.id === resolved.moduleTypeId);
            const Icon = iconFor(moduleType);
            const contentFields = moduleType?.schema.fields.filter((f) => !f.option) ?? [];
            const isTiles = isTilesModule(contentFields);
            const isDivider = isDividerModule(contentFields);
            const isCover = isCoverModuleType(contentFields);
            const imageField = contentFields.find((f) => f.type === "image");
            const imageValue = imageField
              ? toImageValue(resolved.values[imageField.name])
              : null;
            const blockLayout = resolveBlockLayout(contentFields, resolved.values, instance.layout);
            // Kein eigenes Bild-Feld (Rich-Text, CTA-Button, Zitat, …):
            // Ausrichtung/Größe des ganzen Blocks kommen aus
            // `instance.layout` – eigener Zieh-Griff + Menü unten.
            const hasBlockLayoutControls = !imageField;
            const currentAlign =
              ALIGN_OPTIONS.find(
                (o) => o.value === (imageField ? (imageValue?.align ?? "none") : blockLayout.align),
              ) ?? ALIGN_OPTIONS[0];
            return (
              <Fragment key={instance.id}>
                <div
                  style={{ width: `${blockLayout.width}%` }}
                  className={cn(
                    "block-layout group relative rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border focus-within:border-orange-400",
                    blockLayoutClasses(blockLayout.align, blockLayout.width),
                    draggingInstanceId === instance.id && "opacity-40",
                  )}
                >
                  {isDragging && isFloatedAlign(blockLayout.align) && (
                    // Links-/rechts ausgerichtete (geflotete) Blöcke können
                    // im Designer nebeneinander stehen (auch zu dritt oder
                    // mehr) – eine separate Drop-Zone *zwischen* solchen
                    // Blöcken funktioniert mit CSS-Floats nicht zuverlässig
                    // (siehe `instanceAligns` oben). Die Einfüge-Markierung
                    // hängt deshalb direkt am eigenen, bereits korrekt
                    // positionierten Block – oberhalb, in der Zeile, wo
                    // sonst die (während des Ziehens ausgeblendete)
                    // Toolbar sitzt.
                    <DropZone
                      active={isDragging}
                      onDrop={(p) => handleDropAt(index, p, blockLayout.align)}
                      className="absolute inset-x-0 -top-3 z-20 h-3"
                    />
                  )}
                  <div
                    className={cn(
                      "absolute -top-3 left-2 z-10 flex items-center gap-0.5 rounded-md border bg-card px-1 py-0.5 opacity-0 shadow-card transition-opacity",
                      // Während irgendein Block gezogen wird, bleibt JEDE
                      // Toolbar ausgeblendet – sonst kollidiert die
                      // schwebende Toolbar (per `-top-3` bewusst oberhalb
                      // des eigenen Blocks positioniert) sichtbar mit der
                      // währenddessen größeren, aktiven Drop-Zone darüber
                      // (siehe DropZone `active && !large && "h-6"`).
                      // Betrifft nicht nur FAQ/Galerie, sondern jeden
                      // Baustein-Typ.
                      !isDragging &&
                        "group-hover:opacity-100 group-focus-within:opacity-100",
                    )}
                  >
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", `move:${instance.id}`);
                        // React-State (und damit ein Re-Render vieler
                        // Bausteine) NICHT synchron im dragstart-Handler
                        // setzen: der Browser erstellt direkt im Anschluss
                        // an dragstart synchron seinen Drag-Bild-Snapshot –
                        // kollidiert das mit einem eigenen, teuren
                        // Re-Render (z.B. durch Rich-Text-/Galerie-
                        // Bausteine), kann das den Tab abstürzen lassen
                        // (per echtem Browsertest reproduziert). Per
                        // setTimeout(0) läuft der State-Update erst, nachdem
                        // der Browser seinen Snapshot fertig hat.
                        setTimeout(() => setDraggingInstanceId(instance.id), 0);
                      }}
                      onDragEnd={() => setDraggingInstanceId(null)}
                      className="flex cursor-grab items-center px-0.5 active:cursor-grabbing"
                    >
                      <GripVertical className="size-3.5 text-muted-foreground" />
                    </span>
                    <span
                      data-block-drag-label
                      className="flex items-center gap-1 px-1 text-xs text-muted-foreground"
                    >
                      <Icon className="size-3.5" />
                      {moduleType?.name}
                    </span>
                    {isGlobal && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Zentral gepflegten Eintrag bearbeiten"
                        title={`Wird zentral unter „${isGalleryModuleType(contentFields) ? "Galerien" : "FAQs"}“ gepflegt – zum Bearbeiten öffnen`}
                        onClick={(e) => e.stopPropagation()}
                        render={
                          <Link
                            href={`${
                              isGalleryModuleType(contentFields)
                                ? "/dashboard/content/galleries"
                                : "/dashboard/content/faqs"
                            }/${instance.globalModuleId}`}
                            target="_blank"
                          />
                        }
                      >
                        <Pencil />
                      </Button>
                    )}
                    {imageField && !isTiles && !isCover && !isGlobal && (
                      <>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Ausrichtung"
                                onClick={(e) => e.stopPropagation()}
                              />
                            }
                          >
                            <currentAlign.icon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {ALIGN_OPTIONS.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateField(instance.id, imageField.name, {
                                    ...toImageValue(instance.values[imageField.name]),
                                    align: option.value,
                                  });
                                }}
                              >
                                <option.icon />
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagePicker({ instanceId: instance.id, fieldName: imageField.name });
                          }}
                        >
                          {imageValue?.url ? "Ersetzen" : "Bild wählen"}
                        </Button>
                      </>
                    )}
                    {hasBlockLayoutControls && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Ausrichtung"
                              onClick={(e) => e.stopPropagation()}
                            />
                          }
                        >
                          <currentAlign.icon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {ALIGN_OPTIONS.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateInstanceLayout(instance.id, {
                                  ...instance.layout,
                                  align: option.value,
                                });
                              }}
                            >
                              <option.icon />
                              {option.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Innen-/Außenabstand"
                      title="Innen-/Außenabstand"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpacingInstanceId(instance.id);
                      }}
                    >
                      <Ruler />
                    </Button>
                    {!isGlobal && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Bearbeiten"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingInstanceId(instance.id);
                        }}
                      >
                        <Pencil />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Entfernen"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeModule(instance.id);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <BlockSpacingWrapper layout={instance.layout}>
                  {moduleType && isTiles && !isGlobal && (
                    // Kacheln-artiges Modul (mehrere Bild-Felder, z.B. der
                    // "Kacheln"-Baustein): festes 2-Spalten-Raster statt
                    // der Float-/Resize-Logik von EditableImageField –
                    // jede Kachel ist immer quadratisch und fest im Raster
                    // platziert, kein individuelles Ausrichten/Skalieren.
                    <div className="grid grid-cols-2 gap-2">
                      {contentFields.map((field) => {
                        const img = toImageValue(resolved.values[field.name]);
                        if (!img.url) {
                          return (
                            <button
                              key={field.name}
                              type="button"
                              draggable={false}
                              onClick={(e) => {
                                e.stopPropagation();
                                setImagePicker({ instanceId: instance.id, fieldName: field.name });
                              }}
                              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-sm text-muted-foreground transition-colors hover:border-orange-400"
                            >
                              <ImageIcon className="size-6" />
                              Bild wählen
                            </button>
                          );
                        }
                        return (
                          <div
                            key={field.name}
                            className="group/tile relative aspect-square overflow-hidden rounded-md"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resolveImageSrc(img.thumbnailUrl ?? img.url)}
                              alt=""
                              draggable={false}
                              className="size-full object-cover"
                            />
                            {/* Kleiner Button in der Ecke statt (wie vorher)
                                die ganze Kachel als Overlay abzudecken – ein
                                `inset-0`-Button über der kompletten Fläche
                                ließ praktisch keinen Platz mehr übrig, um
                                den Baustein per Drag&Drop zu greifen. */}
                            <button
                              type="button"
                              draggable={false}
                              onClick={(e) => {
                                e.stopPropagation();
                                setImagePicker({ instanceId: instance.id, fieldName: field.name });
                              }}
                              className="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover/tile:opacity-100"
                            >
                              Ersetzen
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {moduleType && isDivider && (
                    <div className="py-2">
                      <DividerOutput />
                    </div>
                  )}
                  {moduleType && isCover && !isGlobal && (
                    // Wie Kacheln: feste, read-only Vorschau statt der
                    // Feld-für-Feld-Bearbeitung unten – Hintergrundbild
                    // fließt bei Cover nicht neben dem Text, sondern liegt
                    // vollflächig dahinter, das passt nicht zur
                    // EditableImageField-Float-Logik. Bearbeitet wird über
                    // den Stift-Button (Dialog unten).
                    <CoverOutput contentFields={contentFields} values={instance.values} />
                  )}
                  {moduleType && !isTiles && !isDivider && !isCover && !isGlobal && (
                    // `flow-root` statt `flex flex-col`: Bild-Felder mit
                    // Links-/Rechtsbündig floaten (siehe EditableImageField)
                    // – Flex-Kinder ignorieren `float` komplett, außerdem
                    // fängt `flow-root` das Float korrekt innerhalb dieses
                    // Blocks ein, statt in nachfolgende Blöcke "auszulaufen".
                    <div className="flow-root space-y-3">
                      {contentFields.map((field) => {
                        if (field.type === "video") {
                          const video = toVideoValue(instance.values[field.name]);
                          if (!video.url) {
                            return (
                              <button
                                key={field.name}
                                type="button"
                                draggable={false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVideoPicker({ instanceId: instance.id, fieldName: field.name });
                                }}
                                className="block w-full overflow-hidden rounded-md border border-dashed text-left transition-colors hover:border-orange-400"
                              >
                                <div className="flex flex-col items-center justify-center gap-1 py-10 text-sm text-muted-foreground">
                                  <VideoIcon className="size-6" />
                                  Video auswählen
                                </div>
                              </button>
                            );
                          }
                          const embedSrc = videoEmbedSrc(video.url);
                          return (
                            <div key={field.name} className="relative">
                              {/* Im Designer-Canvas bewusst OHNE native
                                  Steuerleiste/iframe-Interaktion (`controls`
                                  weggelassen, iframe mit `pointer-events-none`)
                                  – Browser-eigene Video-/Embed-Bedienelemente
                                  können Maus-Events abfangen, bevor sie den
                                  Drag am Baustein-Rahmen auslösen. In der
                                  echten Ausgabe (BlockFieldOutput) bleibt
                                  alles voll interaktiv. */}
                              {embedSrc ? (
                                <div className="pointer-events-none aspect-video w-full overflow-hidden rounded-md bg-black">
                                  <iframe
                                    src={embedSrc}
                                    title="Video"
                                    tabIndex={-1}
                                    className="size-full"
                                  />
                                </div>
                              ) : (
                                 
                                <video
                                  src={resolveImageSrc(video.url)}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  draggable={false}
                                  className="pointer-events-none block max-h-[36rem] w-full rounded-md bg-black"
                                />
                              )}
                              <button
                                type="button"
                                draggable={false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVideoPicker({ instanceId: instance.id, fieldName: field.name });
                                }}
                                className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                Ersetzen
                              </button>
                            </div>
                          );
                        }
                        if (field.type !== "image") {
                          return (
                            <BlockFieldOutput
                              key={field.name}
                              field={field}
                              value={instance.values[field.name]}
                              showPlaceholders
                            />
                          );
                        }
                        const img = toImageValue(instance.values[field.name]);
                        if (!img.url) {
                          return (
                            <button
                              key={field.name}
                              type="button"
                              draggable={false}
                              onClick={(e) => {
                                e.stopPropagation();
                                setImagePicker({ instanceId: instance.id, fieldName: field.name });
                              }}
                              className="block w-full overflow-hidden rounded-md border border-dashed text-left transition-colors hover:border-orange-400"
                            >
                              <div className="flex flex-col items-center justify-center gap-1 py-10 text-sm text-muted-foreground">
                                <ImageIcon className="size-6" />
                                Bild auswählen
                              </div>
                            </button>
                          );
                        }
                        return (
                          <EditableImageField
                            key={field.name}
                            value={instance.values[field.name]}
                            onChange={(next) => updateField(instance.id, field.name, next)}
                            onReplace={() =>
                              setImagePicker({ instanceId: instance.id, fieldName: field.name })
                            }
                            applyOwnLayout={contentFields.length > 1}
                          />
                        );
                      })}
                    </div>
                  )}
                  {isGlobal && isTiles && (
                    <TilesGridOutput
                      contentFields={contentFields}
                      values={resolved.values}
                    />
                  )}
                  {isGlobal && !isTiles && !isDivider && (
                    <div className="flow-root space-y-3">
                      {contentFields.map((field) => (
                        <BlockFieldOutput
                          key={field.name}
                          field={field}
                          value={resolved.values[field.name]}
                          showPlaceholders
                          interactive
                          gallerySettings={toGallerySettings(resolved.settings)}
                          swiperAllowTouchMove={false}
                        />
                      ))}
                    </div>
                  )}
                  </BlockSpacingWrapper>
                  {hasBlockLayoutControls && (
                    <div
                      onPointerDown={(e) =>
                        startLayoutResize(e, instance, blockLayout.width)
                      }
                      onDragStart={(e) => e.preventDefault()}
                      draggable={false}
                      className={cn(
                        "absolute right-0.5 bottom-0.5 size-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-orange-500 opacity-0 shadow transition-opacity group-hover:opacity-100",
                        resizingLayoutId === instance.id && "opacity-100",
                      )}
                    />
                  )}
                </div>
                {!isFloatedAlign(instanceAligns[index + 1]) && (
                  <DropZone
                    active={isDragging}
                    onDrop={(p) => handleDropAt(index + 1, p)}
                    className="clear-both"
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      <Dialog
        open={editingInstanceId !== null}
        onOpenChange={(open) => !open && setEditingInstanceId(null)}
      >
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingType?.name ?? "Baustein bearbeiten"}</DialogTitle>
          </DialogHeader>
          {editingInstance && editingType && (
            <div className="flex flex-col gap-4 overflow-y-auto">
              {editingType.schema.fields.map((field) => (
                <ModuleFieldInput
                  key={field.name}
                  field={field}
                  value={editingInstance.values[field.name]}
                  onChange={(fieldValue) =>
                    updateField(editingInstance.id, field.name, fieldValue)
                  }
                />
              ))}
              <Button type="button" onClick={() => setEditingInstanceId(null)}>
                Fertig
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={spacingInstanceId !== null}
        onOpenChange={(open) => !open && setSpacingInstanceId(null)}
      >
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>Innen-/Außenabstand</DialogTitle>
          </DialogHeader>
          {spacingInstance && (
            <div className="flex flex-col gap-5 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                Mobil-Wert gilt als Standard, der Desktop-Wert überschreibt ihn
                je Seite ab 640px Bildschirmbreite. Leer lassen für keinen
                eigenen Wert.
              </p>
              <div className="flex flex-col gap-2">
                <Label>Innenabstand (px)</Label>
                {/* `flex-wrap` statt Container-Query: bricht rein anhand
                    des tatsächlich beim Rendern verfügbaren Platzes um,
                    unabhängig von Breiten-Messungen des (portalierten)
                    Dialogs – Mobil-/Desktop-Kreuz stehen nebeneinander,
                    sobald beide nebeneinander passen (min. ~16rem je
                    Kreuz), sonst untereinander. */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex min-w-64 flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Mobil
                    </span>
                    <SpacingCrossInputs
                      idPrefix="padding-mobile"
                      box={spacingInstance.layout?.padding?.mobile}
                      onChange={(side, v) =>
                        updateSpacing(spacingInstance.id, "padding", "mobile", side, v)
                      }
                    />
                  </div>
                  <div className="flex min-w-64 flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Desktop
                    </span>
                    <SpacingCrossInputs
                      idPrefix="padding-desktop"
                      box={spacingInstance.layout?.padding?.desktop}
                      onChange={(side, v) =>
                        updateSpacing(spacingInstance.id, "padding", "desktop", side, v)
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Außenabstand (px)</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex min-w-64 flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Mobil
                    </span>
                    <SpacingCrossInputs
                      idPrefix="margin-mobile"
                      box={spacingInstance.layout?.margin?.mobile}
                      onChange={(side, v) =>
                        updateSpacing(spacingInstance.id, "margin", "mobile", side, v)
                      }
                    />
                  </div>
                  <div className="flex min-w-64 flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Desktop
                    </span>
                    <SpacingCrossInputs
                      idPrefix="margin-desktop"
                      box={spacingInstance.layout?.margin?.desktop}
                      onChange={(side, v) =>
                        updateSpacing(spacingInstance.id, "margin", "desktop", side, v)
                      }
                    />
                  </div>
                </div>
              </div>
              <Button type="button" onClick={() => setSpacingInstanceId(null)}>
                Fertig
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ImagePickerDialog
        open={imagePicker !== null}
        onOpenChange={(open) => !open && setImagePicker(null)}
        onSelect={(url, _alt, item) => {
          if (!imagePicker) return;
          const instance = value.find((i) => i.id === imagePicker.instanceId);
          if (!instance) return;
          const current = toImageValue(instance.values[imagePicker.fieldName]);
          updateField(imagePicker.instanceId, imagePicker.fieldName, {
            ...current,
            url,
            mediaId: item?.id,
            variants: item?.variants,
            thumbnailUrl: item?.thumbnailUrl ?? undefined,
            focalX: item?.focalX ?? undefined,
            focalY: item?.focalY ?? undefined,
          });
          setImagePicker(null);
        }}
      />

      <VideoPickerDialog
        open={videoPicker !== null}
        onOpenChange={(open) => !open && setVideoPicker(null)}
        onSelect={(url, item) => {
          if (!videoPicker) return;
          updateField(videoPicker.instanceId, videoPicker.fieldName, {
            url,
            mediaId: item?.id,
          });
          setVideoPicker(null);
        }}
      />

      <InsertSharedBlockDialog
        open={pendingInsert !== null}
        onOpenChange={(open) => !open && setPendingInsert(null)}
        moduleType={pendingInsert?.moduleType ?? null}
        items={
          pendingInsert
            ? globalModules.filter((gm) => gm.moduleTypeId === pendingInsert.moduleType.id)
            : []
        }
        onSelect={(globalModule) => {
          if (pendingInsert) {
            insertGlobalAt(pendingInsert.index, globalModule, pendingInsert.matchAlign);
          }
          setPendingInsert(null);
        }}
      />
    </div>
  );
}
