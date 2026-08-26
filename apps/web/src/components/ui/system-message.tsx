"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type SystemMessageVariant =
  "info" | "success" | "warning" | "error" | "neutral";

const VARIANT_STYLES: Record<
  SystemMessageVariant,
  {
    container: string;
    icon: string;
    title: string;
    description: string;
    defaultIcon: React.ComponentType<{ className?: string }>;
  }
> = {
  // Nutzervorgabe, 2026-08-26: exakte bg/border/text/icon-Werte je Variante
  // für Light UND Dark Mode (Bildvorlage) – ersetzt die bisherigen
  // Tailwind-Näherungswerte durch die konkret vorgegebenen Hex-Codes.
  info: {
    container:
      "border-[#bfdbfe] bg-[#eff6ff] dark:border-[#33507f] dark:bg-[#1c2e4d]",
    icon: "text-[#1d4ed8] dark:text-[#a6c8fa]",
    title: "text-[#1e3a8a] dark:text-[#d8e6fa]",
    description: "text-[#1e3a8a]/80 dark:text-[#d8e6fa]/80",
    defaultIcon: Info,
  },
  success: {
    container:
      "border-[#bbf7d0] bg-[#f0fdf4] dark:border-[#2f6a4d] dark:bg-[#1b3b2a]",
    icon: "text-[#15803d] dark:text-[#8df0b4]",
    title: "text-[#14532d] dark:text-[#d7f5e3]",
    description: "text-[#14532d]/80 dark:text-[#d7f5e3]/80",
    defaultIcon: CheckCircle2,
  },
  warning: {
    container:
      "border-[#fde68a] bg-[#fffbeb] dark:border-[#6b5220] dark:bg-[#3d2f10]",
    icon: "text-[#b45309] dark:text-[#f6cf7e]",
    title: "text-[#78350f] dark:text-[#f8e6bd]",
    description: "text-[#78350f]/80 dark:text-[#f8e6bd]/80",
    defaultIcon: AlertTriangle,
  },
  error: {
    container:
      "border-[#fecaca] bg-[#fef2f2] dark:border-[#6b3030] dark:bg-[#3d1d1d]",
    icon: "text-[#dc2626] dark:text-[#fb9c9c]",
    title: "text-[#7f1d1d] dark:text-[#f9d7d7]",
    description: "text-[#7f1d1d]/80 dark:text-[#f9d7d7]/80",
    defaultIcon: XCircle,
  },
  neutral: {
    container: "border-border bg-muted/60",
    icon: "text-muted-foreground",
    title: "text-pivot-navy",
    description: "text-muted-foreground",
    defaultIcon: Info,
  },
};

/** Wiederverwendbarer Inline-Systemhinweis (Nutzervorgabe, 2026-08-15, 1:1
 * nach Bildvorlage) — für dauerhaft sichtbare Zustandsmeldungen innerhalb
 * einer Seite (z.B. "Wartungsmodus aktiv", "Speicher fast voll"), im
 * Unterschied zu den transienten Toasts aus `app-toast.tsx`. `icon={false}`
 * blendet das Icon aus (siehe Bildvorlage: die schließbaren Varianten
 * "Willkommen im neuen Dashboard" / "2 Webhooks schlagen fehl" haben keins). */
export function SystemMessage({
  variant,
  title,
  description,
  icon,
  dismissible,
  onDismiss,
  actions,
  className,
}: {
  variant: SystemMessageVariant;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }> | false;
  dismissible?: boolean;
  onDismiss?: () => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  const styles = VARIANT_STYLES[variant];
  const Icon = icon === false ? null : (icon ?? styles.defaultIcon);

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border p-4",
        styles.container,
        className,
      )}
    >
      {Icon && (
        <Icon className={cn("mt-0.5 size-[18px] shrink-0", styles.icon)} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-semibold", styles.title)}>{title}</p>
          {dismissible && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Schließen"
              className={cn(
                "shrink-0 transition-opacity hover:opacity-70",
                styles.icon,
              )}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {description && (
          <p className={cn("mt-1 text-sm", styles.description)}>
            {description}
          </p>
        )}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
