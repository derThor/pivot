"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "pivot-theme";
const THEME_ATTR = "data-pivot-theme";

/** Dark-Mode-Umschalter in der Topbar (Nutzervorgabe, 2026-08-25) – exakte
 * Geometrie nach Vorgabe: Track 82×36px, Knopf 28px, Positionen
 * left:4/left:50 (Knopf) bzw. left:36/left:10 (Label), volle Rundung.
 * Alle Farben referenzieren Tokens aus globals.css, keine Hex-Literale.
 * Zustand liegt bewusst NICHT in React-State als Quelle der Wahrheit,
 * sondern im `data-pivot-theme`-Attribut auf <html> (vom Blocking-Script in
 * layout.tsx bereits vor dem ersten Paint gesetzt, siehe dortiger
 * Kommentar) – der `useEffect` synchronisiert React nur EINMAL nach dem
 * Mount aus dem bereits vorhandenen DOM-Zustand, damit Server- und
 * Client-Erst-Render identisch bleiben (kein Hydration-Mismatch). */
export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Muss synchron NACH dem Mount aus dem DOM lesen statt aus einem
    // lazy useState-Initializer: Server und der erste Client-Render
    // müssen identisch "light" zeigen (kein `document` beim SSR), sonst
    // Hydration-Mismatch. Das Blocking-Script in layout.tsx hat das
    // Attribut zu diesem Zeitpunkt schon korrekt gesetzt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.getAttribute(THEME_ATTR) === "dark");
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.setAttribute(THEME_ATTR, "dark");
    } else {
      document.documentElement.removeAttribute(THEME_ATTR);
    }
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={
        isDark ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln"
      }
      onClick={toggle}
      className={cn(
        "relative mx-2 h-9 w-[82px] shrink-0 rounded-full bg-pivot-switch-track-dark transition-colors",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-[11px] font-semibold tracking-wide transition-[left] duration-200",
          isDark ? "left-[10px] text-white" : "left-9 text-muted-foreground",
        )}
      >
        {isDark ? "DARK" : "LIGHT"}
      </span>
      <span
        className={cn(
          "absolute top-1 flex size-7 items-center justify-center rounded-full shadow-sm transition-[left] duration-200",
          isDark
            ? "left-[50px] bg-primary text-primary-foreground"
            : "left-1 bg-card text-muted-foreground",
        )}
      >
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </span>
    </button>
  );
}
