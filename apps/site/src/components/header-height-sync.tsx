"use client";

import { useEffect, useRef } from "react";

/** Schreibt die tatsächliche Höhe des Kopfbereichs nach
 * `--header-height` (Nutzervorgabe, 2026-09-03: "die Headerhöhe wird bei
 * Vollbild angehängt, kann das abgerechnet werden? denk an mobil").
 *
 * Ein Aufmacher auf "volle Fensterhöhe" rechnet damit `100vh` minus
 * Kopfzeile – sonst ragt er genau um deren Höhe unter den Bildschirmrand,
 * und man muss scrollen, um ihn ganz zu sehen.
 *
 * **Warum gemessen und nicht als fester Wert im CSS:** der Kopfbereich
 * bricht auf schmalen Geräten um (Logo oben, Menü darunter) und wird dann
 * deutlich höher. Ein Festwert wäre genau dort falsch, wo der Bildschirm
 * am knappsten ist. Der `ResizeObserver` erfasst jede Änderung – Umbruch,
 * Drehung des Geräts, Zoom.
 *
 * Bis das erste Mal gemessen ist, gilt der Rückfallwert `0px` aus
 * globals.css: dann ist der Aufmacher kurz zu hoch statt zu kurz, was
 * niemand bemerkt. */
export function HeaderHeightSync() {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = anchorRef.current?.closest("header");
    if (!header) return;

    const apply = () => {
      document.documentElement.style.setProperty(
        "--header-height",
        `${Math.round(header.getBoundingClientRect().height)}px`,
      );
    };
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return <span ref={anchorRef} hidden />;
}
