import type { Metadata } from "next";
import { getLicenseState } from "@/lib/api-server";
import { mediaUrl } from "@/lib/media";

// Meta-Tag-Marker, den WebsiteMonitorService (Master-seitige Live-
// Überwachung, siehe knowledge-base/platform/master-slave-licensing.md)
// im HTML sucht, um eine korrekt angezeigte Wartungsseite von einer
// tatsächlich noch live laufenden Installation zu unterscheiden.
export const metadata: Metadata = {
  title: "Wartungsarbeiten",
  other: { "pivot-maintenance": "true" },
};

const DEFAULT_TITLE = "Gleich wieder da.";
const DEFAULT_MESSAGE =
  "Wir aktualisieren die Website. Ihre Daten bleiben unberührt — in wenigen Minuten ist alles wieder erreichbar.";
const DEFAULT_ACCENT = "#BCE64D";

// Gleiche grobe Helligkeitsschätzung wie bei der Akzentfarbe-Auswahl unter
// Einstellungen → Darstellung (settings-form.tsx) – die Wartungsseite nutzt
// dieselbe Akzentfarbe als Hintergrund und muss ihre Textfarbe entsprechend
// anpassen, egal welche Farbe der Kunde gewählt hat.
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

/** Standard-Wartungsseite für alle ausgelieferten Installationen
 * (Nutzervorgabe, 2026-08-24, nach Bildvorlage) – wird von middleware.ts
 * für alle geschützten Routen (Dashboard, Login, Registrierung) angezeigt,
 * sobald diese Installation im Client-Modus gesperrt ist. Titel/Text unter
 * Einstellungen → Wartungsseite editierbar; Logo/Firmenname/Kontaktdaten/
 * Akzentfarbe kommen automatisch aus den bestehenden Firmen-/Darstellungs-
 * Einstellungen – keine eigene Konfiguration nötig, jede Installation zeigt
 * automatisch ihre eigene Marke. Bezieht ALLES ausschließlich über
 * `getLicenseState()` (`/license/state`), NICHT über `getPublicSettings()`
 * (`/settings/public`) – letzteres ist während einer echten Sperre selbst
 * blockiert (siehe `LicenseEnforcementGuard`), wäre also ausgerechnet dann
 * leer, wenn diese Seite tatsächlich gebraucht wird. */
export default async function LockedPage() {
  const state = await getLicenseState();
  const branding =
    state?.mode === "slave" && state.status === "locked" ? state : null;

  const title = branding?.maintenanceTitle || DEFAULT_TITLE;
  const message = branding?.maintenanceMessage || DEFAULT_MESSAGE;

  const accent = branding?.accentColor || DEFAULT_ACCENT;
  const isLight = isLightColor(accent);
  const textColor = isLight ? "#0B1220" : "#FFFFFF";
  const mutedColor = isLight ? "rgba(11,18,32,0.6)" : "rgba(255,255,255,0.7)";
  const borderColor = isLight ? "rgba(11,18,32,0.15)" : "rgba(255,255,255,0.2)";

  const companyName = branding?.companyName || "Pivot";
  const companyLogoUrl = branding?.companyLogoUrl;
  const companyCity = branding?.companyCity;
  const companyEmail = branding?.companyEmail;
  const companyPhone = branding?.companyPhone;
  const hasContact = Boolean(companyEmail || companyPhone || companyCity);

  return (
    <div
      className="flex min-h-screen flex-col px-6 py-6 sm:px-12 sm:py-8"
      style={{ backgroundColor: accent, color: textColor }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {/* Nutzervorgabe, 2026-08-24: "das Logo oben links soll immer
           * Pivot sein" – bewusst fest die Pivot-Marke, unabhängig von der
           * Firma der jeweiligen Installation (die steht stattdessen im
           * Footer, siehe unten). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- statisches Asset unter public/, kein next/image nötig */}
          <img
            src="/brand/logo-collapsed.png"
            alt="Pivot"
            className="size-8 rounded-lg object-contain"
          />
          <span className="text-base font-semibold">Pivot</span>
        </div>
        <span
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs font-medium"
          style={{
            backgroundColor: isLight ? textColor : "rgba(255,255,255,0.15)",
            color: isLight ? accent : "#FFFFFF",
          }}
        >
          <span className="size-1.5 rounded-full bg-current" />
          503
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-16">
        <div className="max-w-2xl text-left">
          <p
            className="text-xs font-semibold tracking-[0.2em] uppercase"
            style={{ color: mutedColor }}
          >
            Wartungsarbeiten
          </p>
          <h1 className="mt-4 text-6xl font-bold tracking-tight sm:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-md text-lg" style={{ color: mutedColor }}>
            {message}
          </p>
        </div>
      </div>

      {hasContact && (
        <div
          className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor }}
        >
          <div className="flex flex-wrap gap-8">
            {companyEmail && (
              <div>
                <p
                  className="text-[10px] font-semibold tracking-[0.15em] uppercase"
                  style={{ color: mutedColor }}
                >
                  E-Mail
                </p>
                <a
                  href={`mailto:${companyEmail}`}
                  className="text-sm font-medium underline underline-offset-2"
                >
                  {companyEmail}
                </a>
              </div>
            )}
            {companyPhone && (
              <div>
                <p
                  className="text-[10px] font-semibold tracking-[0.15em] uppercase"
                  style={{ color: mutedColor }}
                >
                  Telefon
                </p>
                <a
                  href={`tel:${companyPhone.replace(/\s+/g, "")}`}
                  className="text-sm font-medium underline underline-offset-2"
                >
                  {companyPhone}
                </a>
              </div>
            )}
          </div>
          {/* Nutzervorgabe, 2026-08-25: hinterlegtes Logo aus Einstellungen
           * → Darstellung nutzen, falls vorhanden – sonst wie bisher der
           * Firmenname (das Logo oben links bleibt trotzdem immer Pivot). */}
          {companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Server Component, next/image braucht hier keinen Mehrwert
            <img
              src={mediaUrl({ url: companyLogoUrl })}
              alt={companyName}
              className="h-6 w-auto object-contain sm:h-7"
            />
          ) : (
            <p className="text-sm" style={{ color: mutedColor }}>
              {[companyName, companyCity].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
