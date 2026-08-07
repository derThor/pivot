"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  Component,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Maximize2,
  MousePointerClick,
  Pencil,
  Quote,
  Search,
  Square,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  blockLayoutClasses,
  resolveBlockLayout,
  toImageValue,
  type BlockLayoutValue,
  type ImageAlign,
  type ImageFieldValue,
} from "@/components/block-field-output";
import { ImagePickerDialog } from "@/components/image-picker-dialog";
import { ModuleFieldInput } from "@/components/module-field-input";
import { resolveImageSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { ModuleType } from "@/lib/api-server";

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
  // false bei Modulen, die NUR aus diesem einen Bild-Feld bestehen (z.B.
  // "Bild"): dort übernimmt bereits der äußere Block-Wrapper Breite/Float
  // (siehe `resolveBlockLayout`, liest denselben Feldwert) – würde dieses
  // Element seine eigene Breite zusätzlich anwenden, würde doppelt
  // verkleinert (z.B. 40% eines bereits auf 40% geschrumpften Elternteils).
  applyOwnLayout = true,
}: {
  value: unknown;
  onChange: (value: ImageFieldValue) => void;
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
        className="block max-h-[36rem] w-full rounded-md object-cover"
      />
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
}

const ICONS: Record<string, typeof Component> = {
  FileText,
  Image: ImageIcon,
  Columns2,
  MousePointerClick,
  Quote,
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
}: {
  active: boolean;
  onDrop: (payload: string) => void;
  // Größere Trefferfläche (z.B. der komplette Leerzustand) statt eines
  // schmalen Trennstrichs zwischen zwei Blöcken.
  large?: boolean;
  children?: ReactNode;
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
        "rounded transition-colors",
        large ? "min-h-32" : "h-2",
        active && !large && "h-6",
        over
          ? "bg-orange-100 dark:bg-orange-500/10"
          : active
            ? "bg-orange-50/50 dark:bg-orange-500/5"
            : "bg-transparent",
        active && "outline-2 outline-dashed outline-orange-300",
      )}
    >
      {children}
    </div>
  );
}

export function BlockEditorField({
  value,
  onChange,
  moduleTypes,
}: {
  value: ModuleInstance[];
  onChange: (value: ModuleInstance[]) => void;
  moduleTypes: ModuleType[];
}) {
  const [search, setSearch] = useState("");
  const [draggingPaletteId, setDraggingPaletteId] = useState<string | null>(null);
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [resizingLayoutId, setResizingLayoutId] = useState<string | null>(null);
  const [imagePicker, setImagePicker] = useState<{
    instanceId: string;
    fieldName: string;
  } | null>(null);
  // Referenz-Breite für alle Zieh-Größenänderungen (Bild-Feld UND
  // Block-Layout) – bewusst EIN gemeinsamer Ref auf die stabile
  // Canvas-Spalte statt je Block/Feld eine eigene Messung, sonst würde
  // ein bereits verkleinerter Block seine eigene (falsche, weil schon
  // geschrumpfte) Breite als 100%-Basis für weiteres Ziehen nehmen.
  const columnRef = useRef<HTMLDivElement>(null);

  const isDragging = draggingPaletteId !== null || draggingInstanceId !== null;

  const filteredTypes = moduleTypes.filter((mt) =>
    mt.name.toLowerCase().includes(search.toLowerCase()),
  );

  function insertAt(index: number, moduleType: ModuleType) {
    const instance: ModuleInstance = {
      id: crypto.randomUUID(),
      moduleTypeId: moduleType.id,
      values: exampleValues(moduleType),
    };
    const next = [...value];
    next.splice(index, 0, instance);
    onChange(next);
  }

  function moveTo(instanceId: string, targetIndex: number) {
    const fromIndex = value.findIndex((i) => i.id === instanceId);
    if (fromIndex === -1) return;
    const next = [...value];
    const [moved] = next.splice(fromIndex, 1);
    const insertIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
    next.splice(insertIndex, 0, moved);
    onChange(next);
  }

  function handleDropAt(index: number, payload: string) {
    if (payload.startsWith("new:")) {
      const moduleType = moduleTypes.find((mt) => mt.id === payload.slice(4));
      if (moduleType) insertAt(index, moduleType);
    } else if (payload.startsWith("move:")) {
      moveTo(payload.slice(5), index);
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

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex w-full shrink-0 flex-col gap-3 self-start md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:w-60 md:overflow-y-auto">
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
                  "flex cursor-grab flex-col items-center gap-1.5 rounded-lg border bg-card p-3 text-center shadow-card transition-colors hover:border-orange-400 active:cursor-grabbing",
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

      <div className="mx-auto flex w-full max-w-3xl flex-col rounded-lg border bg-white shadow-card dark:bg-neutral-950">
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
          ) : (
            <DropZone active={isDragging} onDrop={(p) => handleDropAt(0, p)} />
          )}

          {value.map((instance, index) => {
            const moduleType = moduleTypes.find((mt) => mt.id === instance.moduleTypeId);
            const Icon = iconFor(moduleType);
            const contentFields = moduleType?.schema.fields.filter((f) => !f.option) ?? [];
            const imageField = contentFields.find((f) => f.type === "image");
            const imageValue = imageField
              ? toImageValue(instance.values[imageField.name])
              : null;
            const blockLayout = resolveBlockLayout(contentFields, instance.values, instance.layout);
            // Kein eigenes Bild-Feld (Rich-Text, CTA-Button, Zitat, …):
            // Ausrichtung/Größe des ganzen Blocks kommen aus
            // `instance.layout` – eigener Zieh-Griff + Menü unten.
            const hasBlockLayoutControls = !imageField;
            const currentAlign =
              ALIGN_OPTIONS.find(
                (o) => o.value === (imageField ? (imageValue?.align ?? "none") : blockLayout.align),
              ) ?? ALIGN_OPTIONS[0];
            return (
              <div key={instance.id}>
                <div
                  draggable
                  onDragStart={(e) => {
                    setDraggingInstanceId(instance.id);
                    e.dataTransfer.setData("text/plain", `move:${instance.id}`);
                  }}
                  onDragEnd={() => setDraggingInstanceId(null)}
                  style={{ width: `${blockLayout.width}%` }}
                  className={cn(
                    "group relative cursor-grab rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border focus-within:border-orange-400 active:cursor-grabbing",
                    blockLayoutClasses(blockLayout.align),
                    draggingInstanceId === instance.id && "opacity-40",
                  )}
                >
                  <div className="absolute -top-3 left-2 z-10 flex items-center gap-0.5 rounded-md border bg-card px-1 py-0.5 opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <span className="flex cursor-grab items-center px-0.5 active:cursor-grabbing">
                      <GripVertical className="size-3.5 text-muted-foreground" />
                    </span>
                    <span className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
                      <Icon className="size-3.5" />
                      {moduleType?.name}
                    </span>
                    {imageField && (
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
                      aria-label="Bearbeiten"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingInstanceId(instance.id);
                      }}
                    >
                      <Pencil />
                    </Button>
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
                  {moduleType && (
                    // `flow-root` statt `flex flex-col`: Bild-Felder mit
                    // Links-/Rechtsbündig floaten (siehe EditableImageField)
                    // – Flex-Kinder ignorieren `float` komplett, außerdem
                    // fängt `flow-root` das Float korrekt innerhalb dieses
                    // Blocks ein, statt in nachfolgende Blöcke "auszulaufen".
                    <div className="flow-root space-y-3">
                      {contentFields.map((field) => {
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
                            applyOwnLayout={contentFields.length > 1}
                          />
                        );
                      })}
                    </div>
                  )}
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
                <DropZone active={isDragging} onDrop={(p) => handleDropAt(index + 1, p)} />
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={editingInstanceId !== null}
        onOpenChange={(open) => !open && setEditingInstanceId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingType?.name ?? "Baustein bearbeiten"}</DialogTitle>
          </DialogHeader>
          {editingInstance && editingType && (
            <div className="flex flex-col gap-4">
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

      <ImagePickerDialog
        open={imagePicker !== null}
        onOpenChange={(open) => !open && setImagePicker(null)}
        onSelect={(url) => {
          if (!imagePicker) return;
          const instance = value.find((i) => i.id === imagePicker.instanceId);
          if (!instance) return;
          const current = toImageValue(instance.values[imagePicker.fieldName]);
          updateField(imagePicker.instanceId, imagePicker.fieldName, { ...current, url });
          setImagePicker(null);
        }}
      />
    </div>
  );
}
