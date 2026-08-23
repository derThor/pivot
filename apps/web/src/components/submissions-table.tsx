"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FormFieldOption, FormSubmission } from "@/lib/api-server";

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

function summarize(
  values: Record<string, unknown>,
  fields: FormFieldOption[] | undefined,
): string {
  const relevant = fields?.slice(0, 2) ?? Object.keys(values).slice(0, 2).map((id) => ({ id, label: id }) as FormFieldOption);
  return relevant
    .map((f) => formatValue(values[f.id]))
    .filter((v) => v !== "–")
    .join(" · ") || "–";
}

/** Tabelle für Formular-Einsendungen – gemeinsam für die pro-Formular-
 * Ansicht (`/dashboard/forms/[id]/submissions`, `showForm=false`) und die
 * app-weite Sammelübersicht (`/dashboard/forms/submissions`, `showForm=true`,
 * gleiches Prinzip wie "Letzte Läufe" bei den Jobs). */
export function SubmissionsTable({
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
  /** Nur für `showForm=false` (pro-Formular-Ansicht) bekannt. */
  fields?: FormFieldOption[];
  showForm?: boolean;
  basePath: string;
  /** `AppSettings.retentionFormSubmissionsDays` (Datenschutz-Einstellung) –
   * `null` = unbegrenzt, dann kein "Abgelaufen"-Badge. Löschen bleibt
   * bewusst manuell (siehe Plan), das Badge markiert nur, was fällig wäre. */
  retentionDays?: number | null;
  /** Zeitstempel des Seitenaufrufs (`Date.now()` aus der Server-Komponente,
   * siehe `page.tsx`) statt direktem `Date.now()` hier – React-Compiler
   * verbietet impure Aufrufe im Render-Körper von Client-Components. */
  now: number;
}) {
  const router = useRouter();

  async function toggleRead(submission: FormSubmission) {
    await fetch(
      `/api/forms/${submission.formId}/submissions/${submission.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: !submission.isRead }),
      },
    );
    toastEdited(
      submission.isRead
        ? "Als ungelesen markiert."
        : "Als gelesen markiert.",
    );
    router.refresh();
  }

  async function handleDelete(submission: FormSubmission) {
    await fetch(
      `/api/forms/${submission.formId}/submissions/${submission.id}`,
      { method: "DELETE" },
    );
    toastDeleted("Einsendung wurde gelöscht.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-background">
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
              items.map((submission) => (
                <TableRow
                  key={submission.id}
                  className={cn(!submission.isRead && "bg-primary/5")}
                >
                  <TableCell>
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
                      {submission.form ? (
                        <Link
                          href={`/dashboard/forms/${submission.form.id}`}
                          className="font-medium hover:underline"
                        >
                          {submission.form.name}
                        </Link>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                  )}
                  <TableCell className="max-w-md text-sm">
                    {summarize(submission.values, fields ?? submission.form?.fields)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {dateFormatter.format(new Date(submission.createdAt))}
                      {retentionDays != null &&
                        now - new Date(submission.createdAt).getTime() >
                          retentionDays * 24 * 60 * 60 * 1000 && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                            Abgelaufen
                          </span>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-[#D4D4D4]"
                        onClick={() => toggleRead(submission)}
                      >
                        {submission.isRead ? "Ungelesen" : "Gelesen"}
                      </Button>
                      <ConfirmDeleteDialog
                        trigger={
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="rounded-lg"
                            aria-label="Einsendung löschen"
                          >
                            <Trash2 />
                          </Button>
                        }
                        title="Einsendung löschen?"
                        description="Diese Aktion kann nicht rückgängig gemacht werden."
                        onConfirm={() => handleDelete(submission)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        page={meta.page}
        pageCount={meta.pageCount}
        buildHref={(p) => `${basePath}?page=${p}`}
      />
    </div>
  );
}
