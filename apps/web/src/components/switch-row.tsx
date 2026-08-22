"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Label/Beschreibung links, Schalter rechts, in einer grauen Zeile –
 * ursprünglich in settings-form.tsx, extrahiert (2026-08-18), da der
 * Datenschutzbeauftragter-Tab dieselbe Zeile für seine drei Schalter
 * braucht. `description` ist hier optional (der Sicherheit-Tab nutzt sie
 * immer, der DSB-Tab nur bei einem der drei Schalter). `className`
 * überschreibt bei Bedarf Rahmen/Hintergrund (Nutzervorgabe, 2026-08-22:
 * weißer statt grauer Hintergrund NUR im aufgeklappten Job-Panel unter
 * Einstellungen → Jobs, da der Panel-Hintergrund dort selbst schon
 * akzentfarben getönt ist – überall sonst bleibt der graue Standard). */
export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <Label
          className={
            disabled ? "text-sm text-muted-foreground" : "text-sm"
          }
        >
          {label}
        </Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
