"use client";

import { useState } from "react";

import { PaginationControls } from "@/components/pagination-controls";
import { formatName } from "@/lib/utils";
import type { ActivityLogEntry, ActivityLogResponse } from "@/lib/api-server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Gleiche Feldliste wie companyFields in company-view.tsx (dort die
 * kanonische Quelle für die Formular-Labels) – hier dupliziert, weil
 * describeActivity() nur die deutschen Kurztitel für die Timeline
 * braucht, nicht die vollen Formularfelder. */
const COMPANY_FIELD_LABELS: Record<string, string> = {
  companyName: "Firmenname",
  companyStreet: "Straße und Hausnummer",
  companyPostalCode: "PLZ",
  companyCity: "Ort",
  companyCountry: "Land",
  companyRepresentative: "Vertretungsberechtigte Person",
  companyEmail: "E-Mail",
  companyPhone: "Telefon",
  companyRegisterCourt: "Registergericht",
  companyRegisterNumber: "Handelsregisternummer",
  companyVatId: "USt-IdNr.",
  companySupervisoryAuthority: "Aufsichtsbehörde",
  companyDisputeResolution: "Streitschlichtung",
};

/** Übersetzt einen rohen AuditLog-Eintrag in Titel + Kategorie-/Akteur-Zeile
 * fürs "Verlauf"-Timeline (2b.14-Nachtrag). Bewusst im Frontend statt im
 * Backend formatiert – die deutschen UI-Texte gehören hierher, nicht in die
 * strukturierten `action`/`metadata`-Felder (gleiches Prinzip wie die
 * Toast-Texte in app-toast.tsx). */
function describeActivity(entry: ActivityLogEntry) {
  const actorName = formatName(entry.user) || "Unbekannt";
  const metadata = entry.metadata ?? {};

  switch (entry.action) {
    case "user.created":
      return {
        title: "Konto erstellt",
        category:
          metadata.method === "self_registered" ?
            "Selbst registriert"
          : `Angelegt von ${actorName}`,
      };
    case "user.role_changed": {
      const roleNames = Array.isArray(metadata.roleNames) ?
          (metadata.roleNames as string[]).join(", ")
        : "";
      return {
        title: `Rolle geändert zu ${roleNames}`,
        category: `von ${actorName}`,
      };
    }
    case "user.password_changed":
      return { title: "Passwort geändert", category: "Sicherheit" };
    case "user.2fa_enabled":
      return {
        title: "Zwei-Faktor-Authentifizierung aktiviert",
        category: "Sicherheit",
      };
    case "user.2fa_disabled":
      return {
        title: "Zwei-Faktor-Authentifizierung deaktiviert",
        category:
          entry.user.id === entry.entityId ? "Sicherheit" : (
            `von ${actorName}`
          ),
      };
    case "media.uploaded":
      return {
        title: `Medium hochgeladen${metadata.filename ? `: ${metadata.filename}` : ""}`,
        category: "Medien",
      };
    case "user.impersonate":
      return {
        title: "Sitzung durch Administrator übernommen",
        category: `von ${actorName}`,
      };
    case "company.field_updated": {
      const fieldLabel =
        COMPANY_FIELD_LABELS[metadata.field as string] ?? String(metadata.field);
      const verb = metadata.wasEmpty ? "ergänzt" : "aktualisiert";
      return {
        title: `${fieldLabel} ${verb}`,
        category: `Firma · von ${actorName}`,
      };
    }
    case "content.published":
      return {
        title:
          metadata.title ? `„${metadata.title}“ veröffentlicht` : (
            "Inhalt veröffentlicht"
          ),
        category: "Inhalte",
      };
    default:
      return { title: entry.action, category: actorName };
  }
}

export function UserActivityTimeline({
  userId,
  initialData,
}: {
  userId: string;
  initialData: ActivityLogResponse;
}) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);

  async function goToPage(page: number) {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/users/${userId}/activity?page=${page}&pageSize=${data.meta.pageSize}`,
      );
      const next = await res.json().catch(() => null);
      if (res.ok && next) {
        setData(next);
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (data.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Für dieses Konto liegt noch kein Aktivitätsverlauf vor.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol
        className={
          isLoading ? "flex flex-col opacity-50 transition-opacity" : (
            "flex flex-col transition-opacity"
          )
        }
      >
        {data.items.map((entry, index) => {
          const { title, category } = describeActivity(entry);
          const isLast = index === data.items.length - 1;
          const isLatest = data.meta.page === 1 && index === 0;
          return (
            <li key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={
                    isLatest ?
                      "mt-1.5 size-2.5 shrink-0 rounded-full bg-primary"
                    : "mt-1.5 size-2.5 shrink-0 rounded-full bg-muted-foreground/30"
                  }
                />
                {!isLast && <span className="w-px flex-1 bg-neutral-300" />}
              </div>
              <div className={isLast ? "pb-0" : "pb-6"}>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">
                  {category} · {formatDate(entry.createdAt)} ·{" "}
                  {formatTime(entry.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <PaginationControls
        page={data.meta.page}
        pageCount={data.meta.pageCount}
        onPageChange={goToPage}
      />
    </div>
  );
}
