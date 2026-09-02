"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

import { SelfDisclosureFooter } from "./self-disclosure-dialog";

/** Feldbeschreibung aus `Form.fields` (siehe apps/api form-field.types.ts).
 * Bewusst hier nachgebildet statt aus apps/web importiert: die Website
 * kennt das Admin-Projekt nicht, und `@pivot/blocks` beschreibt
 * Content-Bausteine, nicht Formularfelder. */
interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  /** Prozentuale Breite (10–100), aus dem Feld-Builder. */
  width: number;
  options?: string[];
  optionsLayout?: "vertical" | "horizontal";
  helpText?: string;
  showLabel?: boolean;
  privacyPageSlug?: string;
  privacyPageTitle?: string;
}

interface PublicFormDefinition {
  id: string;
  name: string;
  slug: string;
  fields: FormField[];
  submitButtonText: string;
  submitButtonAlign: "left" | "center" | "right";
  redirectUrl: string | null;
  /** Ob unter dem Absenden-Knopf eine Selbstauskunft angeboten wird –
   * kommt aus der Datenschutz-Einstellung, nicht aus dem Formular
   * selbst (siehe forms.service.ts). */
  selfServiceDisclosure: boolean;
}

const SUBMIT_ALIGN: Record<PublicFormDefinition["submitButtonAlign"], string> =
  {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

const INPUT_TYPES: Record<string, string> = {
  text: "text",
  email: "email",
  tel: "tel",
  number: "number",
  date: "date",
};

/** Gemeinsame Optik aller Eingabefelder. `apps/site` hat bewusst kein
 * shadcn/ui (eigenes, schlankes Design-System, siehe globals.css) – die
 * Felder sind deshalb native Elemente mit den dortigen Tokens. */
const CONTROL =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `form-field-${field.id}`;
  const options = field.options ?? [];
  const groupClass =
    field.optionsLayout === "horizontal"
      ? "flex flex-row flex-wrap gap-x-4 gap-y-2"
      : "flex flex-col gap-2";

  if (field.type === "textarea") {
    return (
      <textarea
        id={id}
        required={field.required}
        rows={4}
        className={CONTROL}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        id={id}
        required={field.required}
        className={CONTROL}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Bitte wählen</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "radio") {
    const stringValue = typeof value === "string" ? value : "";
    return (
      <div className={groupClass}>
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={id}
              value={opt}
              checked={stringValue === opt}
              onChange={() => onChange(opt)}
              required={field.required}
              className="size-4 accent-accent"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox") {
    const arrayValue = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className={groupClass}>
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={arrayValue.includes(opt)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...arrayValue, opt]
                    : arrayValue.filter((v) => v !== opt),
                )
              }
              className="size-4 accent-accent"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  // Feldtyp "file" ist im Katalog vorgesehen, es gibt aber kein
  // Upload-Handling (siehe form-field.types.ts) – hier dasselbe ehrliche
  // Verhalten wie im Backend-Renderer, statt ein Feld vorzutäuschen.
  if (field.type === "file") {
    return (
      <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        Datei-Upload wird in einer späteren Version unterstützt.
      </p>
    );
  }

  return (
    <input
      id={id}
      type={INPUT_TYPES[field.type] ?? "text"}
      required={field.required}
      className={CONTROL}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Das öffentliche, absendbare Formular auf der Website (Roadmap 4.0,
 * "Formular-Bausteine auf öffentlichen Seiten"). Bis dahin fiel ein
 * Formular-Baustein auf einer veröffentlichten Seite still weg, weil
 * `ContentBlocks` kein `renderForm` übergab – im Backend war er sichtbar,
 * auf der Website nicht.
 *
 * Eigene Fassung statt der aus `apps/web`: jene hängt an shadcn/ui, das es
 * hier bewusst nicht gibt. Verhalten und Feldtypen sind identisch, damit
 * Redaktions-Vorschau und Website nicht auseinanderlaufen.
 *
 * Client-Component, weil Eingabestand und Absenden Interaktivität
 * brauchen; die Formulardefinition kommt über eine eigene Proxy-Route
 * (siehe app/api/forms/…). */
export function PublicForm({ formId }: { formId: string }) {
  const [form, setForm] = useState<PublicFormDefinition | null | undefined>(
    undefined,
  );
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/forms/public/${formId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setForm(data);
      })
      .catch(() => {
        if (active) setForm(null);
      });
    return () => {
      active = false;
    };
  }, [formId]);

  if (!formId) return null;

  // Auf der Website bewusst KEIN "wird geladen"-Platzhalter und keine
  // Fehlerkiste wie im Editor: ein Besucher kann mit "Formular nicht
  // gefunden" nichts anfangen. Ist etwas nicht in Ordnung, erscheint an
  // der Stelle einfach nichts.
  if (!form) return null;

  if (status === "success") {
    return (
      <div className="rounded-md border border-border bg-muted p-6 text-center text-sm">
        Vielen Dank für Ihre Nachricht! Wir melden uns zeitnah bei Ihnen.
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/forms/${form!.slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMessage(
          data?.message ?? "Beim Senden ist ein Fehler aufgetreten.",
        );
        setStatus("error");
        return;
      }
      if (form!.redirectUrl) {
        window.location.href = form!.redirectUrl;
        return;
      }
      setStatus("success");
    } catch {
      setErrorMessage("Beim Senden ist ein Fehler aufgetreten.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {form.fields.map((field) => {
          const widthStyle = {
            "--field-w": `${field.width}%`,
          } as CSSProperties;

          if (field.type === "privacy_notice") {
            return (
              <div
                key={field.id}
                className="flex w-full flex-col gap-1 sm:w-[var(--field-w)]"
                style={widthStyle}
              >
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    required={field.required}
                    checked={values[field.id] === true}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.id]: e.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 accent-accent"
                  />
                  <span>
                    {field.label}
                    {field.required && <span className="text-red-600"> *</span>}
                  </span>
                </label>
                {field.helpText && (
                  <p className="pl-6 text-xs text-muted-foreground">
                    {field.helpText}
                  </p>
                )}
                {field.privacyPageSlug && (
                  <a
                    href={`/${field.privacyPageSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pl-6 text-xs underline underline-offset-2"
                  >
                    {field.privacyPageTitle || "Datenschutzerklärung"}
                  </a>
                )}
              </div>
            );
          }

          if (field.type === "section") {
            return (
              <div
                key={field.id}
                className="flex w-full flex-col gap-1 sm:w-[var(--field-w)]"
                style={widthStyle}
              >
                {field.showLabel !== false && (
                  <h3 className="text-base font-semibold">{field.label}</h3>
                )}
                {field.helpText && (
                  <p className="text-sm text-muted-foreground">
                    {field.helpText}
                  </p>
                )}
              </div>
            );
          }

          return (
            <div
              key={field.id}
              className="flex w-full flex-col gap-1.5 sm:w-[var(--field-w)]"
              style={widthStyle}
            >
              {field.showLabel !== false && (
                <label
                  htmlFor={`form-field-${field.id}`}
                  className="text-sm font-medium"
                >
                  {field.label}
                  {field.required && <span className="text-red-600"> *</span>}
                </label>
              )}
              {field.helpText && (
                <p className="text-xs text-muted-foreground">
                  {field.helpText}
                </p>
              )}
              <FieldControl
                field={field}
                value={values[field.id]}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, [field.id]: v }))
                }
              />
            </div>
          );
        })}
      </div>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      <div className={`flex ${SUBMIT_ALIGN[form.submitButtonAlign]}`}>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {status === "submitting"
            ? "Wird gesendet …"
            : form.submitButtonText || "Absenden"}
        </button>
      </div>

      {form.selfServiceDisclosure && <SelfDisclosureFooter />}
    </form>
  );
}
