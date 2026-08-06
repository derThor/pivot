"use client";

import { useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

import { cn } from "@/lib/utils";

export function ResizableImageNodeView({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { src, alt, align, width } = node.attrs as {
    src: string;
    alt?: string;
    align?: string;
    width?: string;
  };
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  function handleResizeStart(event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const startX = event.clientX;
    const startWidth = wrapper.getBoundingClientRect().width;
    const containerWidth =
      wrapper.parentElement?.getBoundingClientRect().width ?? startWidth;

    setIsResizing(true);

    function onPointerMove(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;
      const newWidthPx = Math.max(60, startWidth + deltaX);
      const percent = Math.min(
        100,
        Math.max(10, Math.round((newWidthPx / containerWidth) * 100)),
      );
      updateAttributes({ width: `${percent}%` });
    }

    function onPointerUp() {
      setIsResizing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  return (
    <NodeViewWrapper
      as="span"
      ref={wrapperRef}
      data-align={align}
      style={width ? { width } : undefined}
      className={cn(
        "group relative",
        // Ohne manuelle Breite deckelt der Wrapper selbst (relativ zum
        // umgebenden Absatz); das Bild bekommt nur max-w-full relativ
        // zum Wrapper. So schrumpft der Wrapper (und damit der
        // Auswahl-Rahmen) exakt auf die tatsächliche Bildgröße, statt
        // wegen eines prozentual breiten Kindes auf die volle Deckel-
        // Breite aufzublähen.
        !width && (align === "left" || align === "right" ? "max-w-[50%]" : "max-w-full"),
        align === "left" && "float-left mr-3 inline-block",
        align === "right" && "float-right ml-3 inline-block",
        (!align || align === "center") && "block w-fit mx-auto",
        selected && "outline outline-2 outline-offset-2 outline-primary",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        draggable={false}
        className={cn(
          "block h-auto max-w-full rounded-md",
          // Mit manueller Breite trägt der Wrapper die feste Breite,
          // das Bild füllt ihn dann komplett aus.
          width && "w-full",
        )}
      />
      {selected && (
        <span
          // Das Image-Node-Schema setzt `draggable: true` (zum
          // Verschieben des Bildes im Text) – ohne explizites
          // `draggable={false}` hier würde ein Pointerdown auf dem
          // Ziehpunkt vom Browser als natives HTML5-Drag des ganzen
          // Bildes interpretiert statt als Resize.
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={handleResizeStart}
          className={cn(
            "absolute right-0 bottom-0 size-3 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-full border-2 border-background bg-primary",
            isResizing && "bg-primary/70",
          )}
        />
      )}
    </NodeViewWrapper>
  );
}
