"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

/** Alter Speicherort. Wird seit 2026-09-02 nur noch EINMAL gelesen, um
 * bestehende Nutzer ins Cookie zu übernehmen – geschrieben wird er nicht
 * mehr (siehe `migrate` unten). */
const STORAGE_KEY = "pivot-theme";

/** Maßgeblicher Speicherort seit 2026-09-02. Ein Cookie reist bei jedem
 * Seitenaufruf mit, das Root-Layout kann `data-pivot-theme` deshalb
 * serverseitig ins HTML schreiben – das frühere Blocking-Script im
 * `<head>` entfällt damit ersatzlos (siehe layout.tsx). Gleiches Muster
 * und dieselben Cookie-Optionen wie beim Eingeklappt-Zustand der Sidebar
 * (`sidebar_state` in ui/sidebar.tsx). */
const COOKIE_NAME = "pivot_theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const THEME_ATTR = "data-pivot-theme";

function writeThemeCookie(value: "dark" | "light") {
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}`;
}

function hasThemeCookie() {
  return document.cookie
    .split("; ")
    .some((entry) => entry.startsWith(`${COOKIE_NAME}=`));
}

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
    const root = document.documentElement;

    // Einmalige Übernahme für Nutzer, die ihr Theme noch im localStorage
    // haben und noch kein Cookie besitzen. Kostet bei genau diesem einen
    // Seitenaufruf einen sichtbaren Wechsel von hell nach dunkel – ab dem
    // nächsten liefert der Server das Attribut schon mit. Bewusst kein
    // Blocking-Script mehr, um das zu vermeiden: genau das war die
    // Ursache der React-Warnung "Encountered a script tag while
    // rendering React component".
    if (!hasThemeCookie()) {
      const stored = (() => {
        try {
          return localStorage.getItem(STORAGE_KEY);
        } catch {
          return null;
        }
      })();
      if (stored === "dark" || stored === "light") {
        writeThemeCookie(stored);
        if (stored === "dark") root.setAttribute(THEME_ATTR, "dark");
        else root.removeAttribute(THEME_ATTR);
      }
    }

    // Quelle der Wahrheit bleibt das Attribut auf <html> – es kommt jetzt
    // serverseitig aus dem Cookie. React wird nur EINMAL nach dem Mount
    // daraus synchronisiert, damit Server- und Client-Erst-Render
    // identisch bleiben (kein Hydration-Mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(root.getAttribute(THEME_ATTR) === "dark");
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.setAttribute(THEME_ATTR, "dark");
    } else {
      document.documentElement.removeAttribute(THEME_ATTR);
    }
    writeThemeCookie(next ? "dark" : "light");
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
