"use client";

import { useRef, useState, type FormEvent } from "react";

const CONTROL =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

/** Selbstauskunft direkt unter dem Formular (Nutzervorgabe, 2026-09-02):
 * wer hier Daten hinterlässt, soll an derselben Stelle erfahren können,
 * welche Daten über ihn vorliegen – ohne erst eine Datenschutzerklärung
 * nach einer Adresse durchsuchen zu müssen. Sichtbar nur, wenn der
 * Schalter "Selbstauskunft im Formular anbieten" unter Datenschutz an ist
 * (die API entscheidet das, siehe `selfServiceDisclosure` in
 * forms.service.ts).
 *
 * Bewusst das native `<dialog>` statt eines eigenen Overlays: die
 * Website hat kein UI-Kit (siehe public-form.tsx), und `showModal()`
 * bringt Fokusfalle, Escape und Hintergrund von sich aus mit.
 *
 * Es werden hier NIE Daten angezeigt. Der Absender bekommt immer
 * dieselbe neutrale Bestätigung – ob zu der Adresse etwas vorliegt, ist
 * selbst schon eine Auskunft, und niemand hat sich an dieser Stelle
 * ausgewiesen. Die Identitätsprüfung passiert beim Bearbeiten der
 * Anfrage im Backend. */
export function SelfDisclosureFooter() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function open() {
    setStatus("idle");
    setErrorMessage(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/data-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, note }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        setErrorMessage(
          data?.message ??
            "Ihre Anfrage konnte nicht aufgenommen werden. Bitte versuchen Sie es später erneut.",
        );
        setStatus("error");
        return;
      }
      setEmail("");
      setNote("");
      setStatus("success");
    } catch {
      setErrorMessage(
        "Ihre Anfrage konnte nicht aufgenommen werden. Bitte versuchen Sie es später erneut.",
      );
      setStatus("error");
    }
  }

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Sie möchten wissen, welche Daten wir über Sie gespeichert haben?{" "}
        <button
          type="button"
          onClick={open}
          className="underline underline-offset-2 hover:no-underline"
        >
          Selbstauskunft anfordern
        </button>
      </p>

      <dialog
        ref={dialogRef}
        // `backdrop:`-Utilities greifen auf dem ::backdrop-Pseudoelement,
        // das sonst browserabhängig fast unsichtbar bleibt.
        className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-0 text-foreground backdrop:bg-black/50"
        onClose={() => setStatus("idle")}
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">
              Selbstauskunft anfordern
            </h2>
            <p className="text-sm text-muted-foreground">
              Wir nehmen Ihre Anfrage auf und melden uns an die angegebene
              Adresse zurück. Aus Datenschutzgründen erhalten Sie hier keine
              Auskunft direkt am Bildschirm.
            </p>
          </div>

          {status === "success" ? (
            <>
              <p className="rounded-md border border-border bg-muted p-4 text-sm">
                Ihre Anfrage wurde aufgenommen. Wir melden uns innerhalb der
                gesetzlichen Frist bei Ihnen.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  Schließen
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="self-disclosure-email"
                  className="text-sm font-medium"
                >
                  E-Mail-Adresse <span className="text-red-600">*</span>
                </label>
                <input
                  id="self-disclosure-email"
                  type="email"
                  required
                  autoComplete="email"
                  className={CONTROL}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Die Adresse, unter der Sie uns Ihre Daten übermittelt haben.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="self-disclosure-note"
                  className="text-sm font-medium"
                >
                  Anmerkung
                </label>
                <textarea
                  id="self-disclosure-note"
                  rows={3}
                  maxLength={2000}
                  className={CONTROL}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {errorMessage && (
                <p className="text-sm text-red-600">{errorMessage}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
                >
                  {status === "submitting"
                    ? "Wird gesendet …"
                    : "Anfrage senden"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
