"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

import { toastCreated, toastDeleted } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DATA_SUBJECT_REQUEST_TYPE_LABELS,
  DELETION_REQUEST_STATUS_LABELS,
} from "@/components/deletion-request-dialog";
import type { DataSubjectRequestType, DeletionRequest } from "@/lib/api-server";
import { bff } from "@/lib/bff";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_BADGE_CLASSNAME = "badge--amber border-0";
const STATUS_BADGE_CLASSNAME_DONE = "badge--green border-0";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{value}</span>
    </div>
  );
}

/** "Meine Daten" (Mein Konto → Sicherheit, Nutzervorgabe 2026-08-19):
 * Selbstauskunft/-löschung/-berichtigung aus dem eigenen Konto heraus,
 * ruft `POST /deletion-requests/self-service` auf (Backend siehe
 * knowledge-base/auth/data-subject-requests.md). Name/E-Mail kommen dort
 * automatisch aus dem eigenen Konto – dieses Formular fragt bewusst nur
 * Art + optionalen Grund ab, keine Kontaktdaten.
 *
 * Nachtrag: Liste der eigenen, bereits gestellten Anfragen + Klick öffnet
 * ein reines Info-Popup (Nutzervorgabe: "wenn ich eine anfrage anklicke,
 * will ich ein popup mit allen infos zur anfrage") – anders als im
 * Admin-Panel ohne Aktions-Buttons, da ein Nutzer weder Datenauszüge
 * erstellen noch Anfragen als erledigt markieren darf. */
export function SelfServiceRequestCard({
  requests: initialRequests,
}: {
  requests: DeletionRequest[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DataSubjectRequestType>("access");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailTarget, setDetailTarget] = useState<DeletionRequest | null>(
    null,
  );
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  async function handleWithdraw() {
    if (!detailTarget) return;
    setIsWithdrawing(true);
    try {
      await fetch(
        bff(`/api/deletion-requests/self-service/${detailTarget.id}`),
        {
          method: "DELETE",
        },
      );
      toastDeleted(`Anfrage ${detailTarget.dsrId} wurde zurückgezogen.`);
      setRequests((prev) => prev.filter((r) => r.id !== detailTarget.id));
      setDetailTarget(null);
      // Glocken-Badge im Header lebt im Server-Layout, das bei reiner
      // Client-Navigation nicht neu rendert (Nutzer-Bugreport, 2026-08-20).
      router.refresh();
    } finally {
      setIsWithdrawing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(bff("/api/deletion-requests/self-service"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, reason: reason || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        toastCreated(
          `Anfrage ${data.dsrId} wurde gestellt. Wir melden uns innerhalb eines Monats.`,
        );
        setRequests((prev) => [data as DeletionRequest, ...prev]);
        setOpen(false);
        setReason("");
        setType("access");
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-card shadow-sm p-6">
      <h3 className="text-xs font-medium text-muted-foreground uppercase">
        Meine Daten
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Fordere eine Auskunft über deine gespeicherten Daten an oder beantrage
        eine Löschung bzw. Berichtigung (Art. 15–17 DSGVO). Wir melden uns
        spätestens innerhalb eines Monats.
      </p>

      {requests.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {DATA_SUBJECT_REQUEST_TYPE_LABELS[request.type]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {request.dsrId} · {formatDate(request.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  className={
                    request.status === "completed" ||
                    request.status === "rejected"
                      ? STATUS_BADGE_CLASSNAME_DONE
                      : STATUS_BADGE_CLASSNAME
                  }
                >
                  {DELETION_REQUEST_STATUS_LABELS[request.status]}
                </Badge>
                <button
                  type="button"
                  aria-label="Alle Informationen zur Anfrage anzeigen"
                  onClick={() => setDetailTarget(request)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Info className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="mt-3 border-input"
        onClick={() => setOpen(true)}
      >
        Anfrage stellen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Anfrage zu meinen Daten</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ssr-type" required>
                Art
              </Label>
              <select
                id="ssr-type"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as DataSubjectRequestType)
                }
              >
                {Object.entries(DATA_SUBJECT_REQUEST_TYPE_LABELS).map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                      className="bg-background text-foreground"
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ssr-reason">Anmerkung (optional)</Label>
              <Textarea
                id="ssr-reason"
                rows={3}
                placeholder="Möchtest du uns noch etwas dazu mitteilen?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-border"
                onClick={() => setOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sendet…" : "Anfrage absenden"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailTarget !== null}
        onOpenChange={(next) => !next && setDetailTarget(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailTarget &&
                DATA_SUBJECT_REQUEST_TYPE_LABELS[detailTarget.type]}
            </DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="flex flex-col divide-y divide-border text-sm">
              <DetailRow label="DSR-ID" value={detailTarget.dsrId} />
              <DetailRow
                label="Art"
                value={DATA_SUBJECT_REQUEST_TYPE_LABELS[detailTarget.type]}
              />
              <DetailRow
                label="Status"
                value={DELETION_REQUEST_STATUS_LABELS[detailTarget.status]}
              />
              <DetailRow
                label="Eingang"
                value={formatDate(detailTarget.createdAt)}
              />
              {detailTarget.dueAt && (
                <DetailRow
                  label="Frist"
                  value={formatDate(detailTarget.dueAt)}
                />
              )}
              {detailTarget.reason && (
                <DetailRow label="Grund" value={detailTarget.reason} />
              )}
              {detailTarget.completedAt && (
                <DetailRow
                  label="Erledigt am"
                  value={formatDate(detailTarget.completedAt)}
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => setDetailTarget(null)}
            >
              Schließen
            </Button>
            {detailTarget &&
              detailTarget.status !== "completed" &&
              detailTarget.status !== "rejected" && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-border text-destructive hover:bg-destructive/5"
                  disabled={isWithdrawing}
                  onClick={handleWithdraw}
                >
                  {isWithdrawing ? "Zieht zurück…" : "Anfrage zurückziehen"}
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
