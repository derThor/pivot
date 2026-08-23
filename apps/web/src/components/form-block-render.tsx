"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FormFieldOption } from "@/lib/api-server";

interface PublicForm {
  id: string;
  name: string;
  slug: string;
  fields: FormFieldOption[];
  submitButtonText: string;
  submitButtonAlign: "left" | "center" | "right";
  redirectUrl: string | null;
}

const SUBMIT_ALIGN_CLASSES: Record<PublicForm["submitButtonAlign"], string> = {
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

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormFieldOption;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `form-field-${field.id}`;

  if (field.type === "textarea") {
    return (
      <Textarea
        id={id}
        required={field.required}
        rows={4}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "select") {
    const stringValue = typeof value === "string" ? value : "";
    const items = Object.fromEntries(
      (field.options ?? []).map((opt) => [opt, opt]),
    );
    return (
      <Select
        value={stringValue}
        onValueChange={(v) => onChange(v ?? "")}
        items={items}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Bitte wählen" />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "radio") {
    const stringValue = typeof value === "string" ? value : "";
    return (
      <div
        className={cn(
          "flex gap-2",
          field.optionsLayout === "horizontal"
            ? "flex-row flex-wrap gap-x-4"
            : "flex-col",
        )}
      >
        {(field.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={id}
              value={opt}
              checked={stringValue === opt}
              onChange={() => onChange(opt)}
              required={field.required}
              className="size-4 accent-primary"
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
      <div
        className={cn(
          "flex gap-2",
          field.optionsLayout === "horizontal"
            ? "flex-row flex-wrap gap-x-4"
            : "flex-col",
        )}
      >
        {(field.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={arrayValue.includes(opt)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...arrayValue, opt]
                    : arrayValue.filter((v) => v !== opt),
                )
              }
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "file") {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Datei-Upload wird in einer späteren Version unterstützt.
      </p>
    );
  }

  return (
    <Input
      id={id}
      type={INPUT_TYPES[field.type] ?? "text"}
      required={field.required}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Rendert das öffentliche, absendbare Formular für den Seiten-Designer-
 * Baustein "Formular" (`ContentTypeField.type === "form"`) – Client-
 * Component, da Eingabe-Status + `POST`-Absenden Interaktivität brauchen.
 * Läuft sowohl im Editor-Canvas als auch auf der anonymen Vorschau-Seite
 * (`/preview/[token]`), daher ausschließlich öffentliche BFF-Routen
 * (`/api/forms/public/[id]`, `/api/forms/[slug]/submit`). */
export function FormBlockRender({ formId }: { formId: string }) {
  const [form, setForm] = useState<PublicForm | null | undefined>(undefined);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // `key={formId}` am Aufrufer (siehe block-field-output.tsx) sorgt für
  // einen frischen Mount – und damit frischen State – bei jedem Wechsel
  // des ausgewählten Formulars, statt hier manuell zurückzusetzen.
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

  if (!formId) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Kein Formular ausgewählt.
      </div>
    );
  }

  if (form === undefined) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Formular wird geladen …
      </div>
    );
  }

  if (!form) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Dieses Formular ist derzeit nicht verfügbar.
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-6 text-center text-sm text-green-800">
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
          if (field.type === "privacy_notice") {
            return (
              <div
                key={field.id}
                className="flex w-full flex-col gap-1 sm:w-[var(--field-w)]"
                style={{ "--field-w": `${field.width}%` } as CSSProperties}
              >
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    required={field.required}
                    checked={values[field.id] === true}
                    onCheckedChange={(checked) =>
                      setValues((prev) => ({ ...prev, [field.id]: checked }))
                    }
                  />
                  <span>
                    {field.label}
                    {field.required && <span className="text-red-500"> *</span>}
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
                    className="pl-6 text-xs text-primary underline underline-offset-2"
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
                style={{ "--field-w": `${field.width}%` } as CSSProperties}
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
              style={{ "--field-w": `${field.width}%` } as CSSProperties}
            >
              {field.showLabel !== false && (
                <label
                  htmlFor={`form-field-${field.id}`}
                  className="text-sm font-medium"
                >
                  {field.label}
                  {field.required && <span className="text-red-500"> *</span>}
                </label>
              )}
              {field.helpText && (
                <p className="text-xs text-muted-foreground">
                  {field.helpText}
                </p>
              )}
              <FieldInput
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
      <div className={cn("flex", SUBMIT_ALIGN_CLASSES[form.submitButtonAlign])}>
        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting"
            ? "Wird gesendet …"
            : form.submitButtonText || "Absenden"}
        </Button>
      </div>
    </form>
  );
}
