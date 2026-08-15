"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type SystemMessageVariant = "info" | "success" | "warning" | "error" | "neutral";

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
  info: {
    container: "border-lime-200 bg-lime-50 dark:border-lime-900 dark:bg-lime-950/40",
    icon: "text-lime-700 dark:text-lime-500",
    title: "text-[#132033] dark:text-foreground",
    description: "text-muted-foreground",
    defaultIcon: Info,
  },
  success: {
    container: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40",
    icon: "text-green-600 dark:text-green-500",
    title: "text-green-800 dark:text-green-400",
    description: "text-green-700/80 dark:text-green-400/70",
    defaultIcon: CheckCircle2,
  },
  warning: {
    container: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    icon: "text-amber-600 dark:text-amber-500",
    title: "text-amber-800 dark:text-amber-400",
    description: "text-amber-700/80 dark:text-amber-400/70",
    defaultIcon: AlertTriangle,
  },
  error: {
    container: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
    icon: "text-red-600 dark:text-red-500",
    title: "text-red-700 dark:text-red-400",
    description: "text-red-600/80 dark:text-red-400/70",
    defaultIcon: XCircle,
  },
  neutral: {
    container: "border-border bg-muted/60 dark:bg-muted/30",
    icon: "text-muted-foreground",
    title: "text-[#132033] dark:text-foreground",
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
      className={cn("flex gap-3 rounded-xl border p-4", styles.container, className)}
    >
      {Icon && <Icon className={cn("mt-0.5 size-[18px] shrink-0", styles.icon)} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-semibold", styles.title)}>{title}</p>
          {dismissible && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Schließen"
              className={cn("shrink-0 transition-opacity hover:opacity-70", styles.icon)}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {description && (
          <p className={cn("mt-1 text-sm", styles.description)}>{description}</p>
        )}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
