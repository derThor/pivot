"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { RowActionButtons } from "@/components/row-action-buttons";
import { cn } from "@/lib/utils";
import type { FormFieldOption, FormSubmission } from "@/lib/api-server";
import { bff } from "@/lib/bff";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (value == null || value === "") return "–";
  return String(value);
}

/** Zwei-Feld-Kurzfassung für die Listenzeile – die vollständigen Werte
 * stehen rechts im Detail-Panel. */
function summarize(
  values: Record<string, unknown>,
  fields: FormFieldOption[] | undefined,
): string {
  const relevant =
    fields?.filter((f) => f.type !== "section").slice(0, 2) ??
    Object.keys(values)
      .slice(0, 2)
      .map((id) => ({ id, label: id }) as FormFieldOption);
  return (
    relevant
      .map((f) => formatValue(values[f.id]))
      .filter((v) => v !== "–")
      .join(" · ") || "–"
  );
}

function isExpired(
  createdAt: string,
  retentionDays: number | null,
  now: number,
): boolean {
  if (retentionDays == null) return false;
  return (
    now - new Date(createdAt).getTime() > retentionDays * 24 * 60 * 60 * 1000
  );
}

/** Die eigentlichen Antwortzeilen einer Einsendung.
 *
 * Reihenfolge und Beschriftung kommen aus der Formular-Definition
 * (`Form.fields`), nicht aus den Schlüsseln des `values`-Objekts – sonst
 * stünde dort die technische Feld-Id statt "Ihre Nachricht", und die
 * Reihenfolge wäre die zufällige des JSON-Objekts.
 *
 * Felder vom Typ `section` sind rein darstellend (Überschrift im
 * Formular, kein Eingabewert, siehe form-field.types.ts) und werden
 * übersprungen. Werte, zu denen es KEINE Felddefinition mehr gibt, hängen
 * am Ende mit ihrer rohen Id dran: Wird ein Feld später aus dem Formular
 * entfernt, bleiben die schon eingegangenen Antworten trotzdem lesbar,
 * statt stillschweigend zu verschwinden. */
function SubmissionValues({
  values,
  fields,
}: {
  values: Record<string, unknown>;
  fields: FormFieldOption[] | undefined;
}) {
  const known = (fields ?? []).filter((f) => f.type !== "section");
  const knownIds = new Set(known.map((f) => f.id));
  const orphans = Object.keys(values).filter((id) => !knownIds.has(id));

  const rows = [
    ...known.map((f) => ({
      key: f.id,
      label: f.label || f.id,
      value: formatValue(values[f.id]),
      // Freitextfelder bekommen ihre eigene Zeile unter dem Label –
      // rechtsbündig abgeschnitten wäre eine Nachricht unlesbar.
      block: f.type === "textarea",
    })),
    ...orphans.map((id) => ({
      key: id,
      label: id,
      value: formatValue(values[id]),
      block: false,
    })),
  ];

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Diese Einsendung enthält keine Werte.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border text-sm">
      {rows.map((row) => {
        // Auch kurze Textfelder brechen um, sobald der Wert für die
        // schmale Seitenspalte zu lang ist (lange E-Mail-Adressen, URLs).
        const block = row.block || row.value.length > 40;
        return (
          <div
            key={row.key}
            className={cn(
              "py-2 first:pt-0 last:pb-0",
              block
                ? "flex flex-col gap-1"
                : "flex items-center justify-between gap-4",
            )}
          >
            <span className="shrink-0 text-muted-foreground">{row.label}</span>
            <span
              className={cn(
                "min-w-0",
                block
                  ? "whitespace-pre-wrap break-words"
                  : "truncate text-right",
              )}
            >
              {row.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Einsendungen als Liste+Detail auf einer Seite (Muster:
 * `data-subject-requests-panel.tsx`) – gemeinsam für die pro-Formular-
 * Ansicht (`/dashboard/forms/[id]/submissions`, `showForm=false`) und die
 * app-weite Sammelübersicht (`/dashboard/forms/submissions`,
 * `showForm=true`).
 *
 * Bewusst kein Popup (Nutzerentscheidung, 2026-09-02): Einsendungen
 * enthalten beliebig lange Freitexte, und die Medien-Bibliothek war
 * vorher schon vom Popup weg zur Detail-Seitenleiste umgebaut worden
 * (siehe media-library-redesign.md). Ebenso bewusst KEIN Deep-Link
 * (`?submission=`): Einsendungen tauchen in der globalen Suche nicht auf,
 * es gäbe also keinen echten Aufrufer dafür. */
export function SubmissionsExplorer({
  items,
  meta,
  fields,
  showForm = false,
  basePath,
  retentionDays = null,
  now,
}: {
  items: FormSubmission[];
  meta: { page: number; pageCount: number };
  /** Nur für `showForm=false` (pro-Formular-Ansicht) bekannt – in der
   * Sammelübersicht bringt jede Zeile ihre Felder über `form` mit. */
  fields?: FormFieldOption[];
  showForm?: boolean;
  basePath: string;
  /** `AppSettings.retentionFormSubmissionsDays` (Datenschutz-Einstellung) –
   * `null` = unbegrenzt, dann kein "Abgelaufen"-Badge. Löschen bleibt
   * bewusst manuell, das Badge markiert nur, was fällig wäre. */
  retentionDays?: number | null;
  /** Zeitstempel des Seitenaufrufs (`Date.now()` aus der Server-Komponente,
   * siehe `page.tsx`) statt direktem `Date.now()` hier – React-Compiler
   * verbietet impure Aufrufe im Render-Körper von Client-Components. */
  now: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Ein gemeinsamer Dialog für alle Zeilen (Muster: webhooks-manager.tsx)
  // statt eines eigenen pro Zeile – `RowActionButtons` bringt keinen
  // Trigger mit, sondern meldet nur die Absicht.
  const [deleteTarget, setDeleteTarget] = useState<FormSubmission | null>(null);

  // Beim Aufruf ist die erste Zeile ausgewählt (Nutzervorgabe,
  // 2026-09-02) – der Fallback auf `items[0]` erledigt das ohne Effekt
  // und fängt gleich drei Fälle mit ab: erster Aufruf (noch nichts
  // gewählt), Seitenwechsel (die gemerkte Id liegt auf der vorigen
  // Seite) und Löschen der gerade offenen Einsendung.
  //
  // Wichtig: diese automatische Vorauswahl markiert NICHT als gelesen –
  // das passiert nur in `select()`, also bei einem echten Klick. Sonst
  // würde schon das bloße Öffnen der Seite die neueste Einsendung
  // abhaken und den "unbearbeitet"-Zähler leerlaufen lassen.
  const selected = items.find((s) => s.id === selectedId) ?? items[0] ?? null;
  const selectedFields = fields ?? selected?.form?.fields;

  async function setRead(submission: FormSubmission, isRead: boolean) {
    await fetch(
      bff(`/api/forms/${submission.formId}/submissions/${submission.id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
      },
    );
    router.refresh();
  }

  /** Öffnen markiert automatisch als gelesen (Nutzerentscheidung,
   * 2026-09-02) – wie in einem Postfach, damit der "unbearbeitet"-Zähler
   * in der Formulare-Übersicht ohne Extraklick stimmt. Zurück auf
   * ungelesen geht weiterhin manuell über den Button im Detail-Panel. */
  function select(submission: FormSubmission) {
    setSelectedId(submission.id);
    if (!submission.isRead) void setRead(submission, true);
  }

  async function toggleRead(submission: FormSubmission) {
    await setRead(submission, !submission.isRead);
    toastEdited(
      submission.isRead ? "Als ungelesen markiert." : "Als gelesen markiert.",
    );
  }

  async function handleDelete(submission: FormSubmission) {
    await fetch(
      bff(`/api/forms/${submission.formId}/submissions/${submission.id}`),
      { method: "DELETE" },
    );
    if (selectedId === submission.id) setSelectedId(null);
    toastDeleted("Einsendung wurde gelöscht.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 3:2 statt des sonst üblichen `grid-cols-3`+`col-span-2`
          (Nutzervorgabe, 2026-09-02: "spalte rechts bei einsendungen
          breiter machen") – das Detail zeigt hier ALLE Feldwerte inklusive
          Freitext, ein Drittel Breite war dafür zu schmal. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <div className="overflow-hidden rounded-xl bg-card shadow-sm lg:col-span-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                {showForm && <TableHead>Formular</TableHead>}
                <TableHead>Inhalt</TableHead>
                <TableHead>Eingegangen</TableHead>
                <TableHead className="text-center">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showForm ? 5 : 4}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Keine Einsendungen gefunden.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((submission) => {
                  const isSelected = submission.id === selected?.id;
                  const expired = isExpired(
                    submission.createdAt,
                    retentionDays,
                    now,
                  );
                  return (
                    <TableRow
                      key={submission.id}
                      // Die ganze Zeile ist der Klickbereich zum Lesen –
                      // `data-state="selected"` ist die Auswahl-Hervorhebung,
                      // die `ui/table.tsx` schon mitbringt, statt einer
                      // eigenen Farbe.
                      data-state={isSelected ? "selected" : undefined}
                      onClick={() => select(submission)}
                      className="cursor-pointer"
                    >
                      <TableCell className="pr-0">
                        <span
                          className={cn(
                            "block size-2 rounded-full",
                            submission.isRead ? "bg-transparent" : "bg-primary",
                          )}
                          aria-hidden
                        />
                      </TableCell>
                      {showForm && (
                        <TableCell>
                          {submission.form ? submission.form.name : "–"}
                        </TableCell>
                      )}
                      <TableCell
                        className={cn(
                          "max-w-xs",
                          !submission.isRead && "font-semibold",
                        )}
                      >
                        {summarize(
                          submission.values,
                          fields ?? submission.form?.fields,
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          {dateFormatter.format(new Date(submission.createdAt))}
                          {expired && (
                            <Badge className="badge--amber border-0">
                              Abgelaufen
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {/* Klick auf Löschen darf die Zeile nicht zusätzlich
                          öffnen (und damit als gelesen markieren). */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <RowActionButtons
                          onDelete={() => setDeleteTarget(submission)}
                          deleteLabel="Einsendung löschen"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {selected ? (
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Einsendung
                </p>
                <CardTitle>
                  {summarize(selected.values, selectedFields)}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {showForm && selected.form ? (
                    <>
                      <Link
                        href={`/dashboard/forms/${selected.form.id}`}
                        className="hover:underline"
                      >
                        {selected.form.name}
                      </Link>
                      {" · "}
                    </>
                  ) : null}
                  {dateFormatter.format(new Date(selected.createdAt))}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {isExpired(selected.createdAt, retentionDays, now) && (
                  <Badge className="badge--amber w-fit border-0">
                    Aufbewahrungsfrist abgelaufen
                  </Badge>
                )}

                <SubmissionValues
                  values={selected.values}
                  fields={selectedFields}
                />

                {/* Nur befüllt, wenn die Datenschutz-Einstellung
                    `dsbFormStoreSubmissionIp` aktiv ist – sonst steht hier
                    bewusst gar nichts statt eines leeren "–". */}
                {selected.submitterIp && (
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-3 text-sm">
                    <span className="shrink-0 text-muted-foreground">
                      IP-Adresse
                    </span>
                    <span className="min-w-0 truncate text-right font-mono text-xs">
                      {selected.submitterIp}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-button-border"
                    onClick={() => toggleRead(selected)}
                  >
                    {selected.isRead
                      ? "Als ungelesen markieren"
                      : "Als gelesen markieren"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    <Trash2 className="size-4" />
                    Löschen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-sm">
              Wähle links eine Einsendung aus, um sie vollständig zu lesen.
            </div>
          )}
        </div>
      </div>

      <PaginationControls
        page={meta.page}
        pageCount={meta.pageCount}
        buildHref={(p) => `${basePath}?page=${p}`}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Einsendung löschen?"
        description="Die Einsendung wird endgültig entfernt und kann nicht wiederhergestellt werden."
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget);
        }}
      />
    </div>
  );
}
