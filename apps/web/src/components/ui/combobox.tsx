"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"

const Combobox = ComboboxPrimitive.Root

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        "flex h-12 w-full min-w-0 items-center rounded-lg border border-[#D4D4D4] bg-transparent px-3.5 py-1 text-base leading-[2.5rem] transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

// Portaliert (rendert in `document.body`, nicht im DOM-Fluss des
// aufrufenden Dialogs) – anders als ein selbstgebautes `absolute`-Div
// bläht das Popup damit keinen umgebenden Dialog mehr auf und erzeugt
// keinen ungewollten inneren Scrollbalken (Nutzer-Bugreport, 2026-08-21,
// siehe `navigation-item-dialog.tsx`). 1:1 an `select.tsx`s
// `SelectContent` angelehnt (gleiche Positioner-/Popup-Klassen), damit
// beide Popup-Typen optisch identisch wirken.
function ComboboxContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50 w-(--anchor-width)"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "relative isolate z-50 max-h-(--available-height) w-full min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn("p-1", className)}
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
    </ComboboxPrimitive.Item>
  )
}

// `Empty` blendet sich automatisch ein/aus je nachdem, ob die `items`-Liste
// der Root leer ist (siehe Base-UI-Doku) – bewusst KEIN eigenes
// bedingtes Rendering hier, nur der Inhalt wird je nach Ladezustand vom
// Aufrufer gesetzt (leer während einer laufenden Suche, sonst "Keine
// Treffer.").
function ComboboxEmpty({
  className,
  ...props
}: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "px-3 py-2 text-sm text-muted-foreground empty:m-0 empty:p-0",
        className
      )}
      {...props}
    />
  )
}

function ComboboxStatus({
  className,
  ...props
}: ComboboxPrimitive.Status.Props) {
  return (
    <ComboboxPrimitive.Status
      data-slot="combobox-status"
      className={cn(
        "px-3 py-2 text-sm text-muted-foreground empty:m-0 empty:p-0",
        className
      )}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
}
