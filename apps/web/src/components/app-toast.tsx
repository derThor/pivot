"use client";

import { AlertTriangle, CircleCheck, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type ToastVariant = "created" | "edited" | "deleted" | "warning";

const VARIANT_CONFIG: Record<
  ToastVariant,
  {
    icon: typeof CircleCheck;
    border: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  created: {
    icon: CircleCheck,
    border: "border-l-green-500",
    iconBg: "bg-green-100",
    iconColor: "text-green-700",
  },
  edited: {
    icon: Pencil,
    border: "border-l-lime-600",
    iconBg: "bg-lime-100",
    iconColor: "text-lime-700",
  },
  deleted: {
    icon: Trash2,
    border: "border-l-destructive",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
  },
  // Gleiche Amber-Töne wie ui/system-message.tsx' "warning"-Variante
  // (Nutzervorgabe: SystemMessage-Farben sind kanonisch, auch als Toast).
  warning: {
    icon: AlertTriangle,
    border: "border-l-amber-500",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
};

/** Eigenes Toast-Layout statt Sonners Standard-Varianten (Nutzervorgabe,
 * 2026-08-15, 1:1 nach Bildvorlage): farbiger linker Rand + passend
 * eingefärbtes Icon in einem Kreis, fette Titelzeile, gedämpfte
 * Beschreibungszeile, eigener Schließen-Button. Wird über `toast.custom`
 * gerendert statt über die eingebauten `toast.success`/`toast.error`-Typen,
 * da deren Icon-Anpassung (siehe ui/sonner.tsx) keinen farbigen Rand und
 * keinen separaten Icon-Kreis pro Aktion (erstellt/bearbeitet/gelöscht)
 * unterstützt. */
function ActionToast({
  id,
  variant,
  title,
  description,
}: {
  id: string | number;
  variant: ToastVariant;
  title: string;
  description?: string;
}) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;
  return (
    <div
      className={cn(
        "flex w-full max-w-sm items-start gap-3 rounded-xl border border-l-4 bg-popover p-4 shadow-lg",
        config.border,
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          config.iconBg,
          config.iconColor,
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-popover-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        aria-label="Schließen"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Meldung nach erfolgreichem Anlegen – `description` optional, Default
 * deckt den generischen Fall ab, einzelne Aufrufer können konkreter sein
 * (z.B. `„Allgemeines“ wurde angelegt.`). */
export function toastCreated(description = "Der Eintrag wurde angelegt.") {
  toast.custom((id) => (
    <ActionToast
      id={id}
      variant="created"
      title="Erfolgreich erstellt"
      description={description}
    />
  ));
}

export function toastEdited(
  description = "Deine Änderungen wurden gespeichert.",
) {
  toast.custom((id) => (
    <ActionToast
      id={id}
      variant="edited"
      title="Erfolgreich bearbeitet"
      description={description}
    />
  ));
}

// Für Testmails/Ähnliches (Nutzervorgabe, 2026-08-30: "soll email
// erfolgreich gesendet ... in dem toast stehen" – toastEdited() zeigte
// dafür bisher missverständlich "Erfolgreich bearbeitet").
export function toastSent(description = "Die E-Mail wurde versendet.") {
  toast.custom((id) => (
    <ActionToast
      id={id}
      variant="created"
      title="E-Mail erfolgreich gesendet"
      description={description}
    />
  ));
}

export function toastDeleted(description = "Der Eintrag wurde entfernt.") {
  toast.custom((id) => (
    <ActionToast
      id={id}
      variant="deleted"
      title="Erfolgreich gelöscht"
      description={description}
    />
  ));
}

// Für dauerhaft geltende, aber bewusst NICHT dauerhaft anzuzeigende Hinweise
// (Nutzervorgabe, 2026-08-25: "soll sich hier nicht gemerkt werden ... bei
// jedem neuen Seitenaufruf erneut geladen werden") – im Unterschied zu
// toastCreated/-Edited/-Deleted mit variablem Titel, da es hier keinen
// einzelnen "Erfolgreich X"-Standardfall gibt. `id`/`duration` optional:
// bei fester `id` aktualisiert ein erneuter Aufruf (z.B. bei jeder
// Navigation) denselben, noch offenen Toast statt ihn zu duplizieren –
// erst nach dem Wegklicken erscheint er wieder neu (Nutzervorgabe,
// 2026-08-25: "soll immer angezeigt werden, nicht ausgeblendet").
export function toastWarning(
  title: string,
  description?: string,
  options?: { id?: string; duration?: number },
) {
  toast.custom(
    (id) => (
      <ActionToast
        id={id}
        variant="warning"
        title={title}
        description={description}
      />
    ),
    options,
  );
}
