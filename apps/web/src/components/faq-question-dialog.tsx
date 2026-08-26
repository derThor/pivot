"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  toRepeaterItems,
  type RepeaterItem,
} from "@/components/block-field-output";
import type { ContentTypeField, GlobalModule } from "@/lib/api-server";

/** Schlanker Dialog nur für "Frage" + "Antwort" + "Veröffentlicht"
 * (Nutzervorgabe, 2026-08-15) – ohne `question`-Prop: hängt beim
 * Speichern einen neuen Eintrag an das Repeater-Feld der Gruppe an. Mit
 * `question`-Prop: bearbeitet den übergebenen Eintrag statt einen neuen
 * anzulegen. Ersetzt für FAQs den bisherigen Weg über den großen
 * `GlobalModuleFormDialog`. Feldnamen werden – wie der Rest der
 * Modul-Bibliothek – aus dem Schema gelesen statt hartkodiert
 * ("question"/"answer" sind aktuell die echten Feldnamen, siehe
 * seed.ts, aber diese Komponente hängt nicht fest daran). */
export function FaqQuestionDialog({
  group,
  repeaterField,
  question,
  open,
  onOpenChange,
}: {
  group: GlobalModule;
  repeaterField: ContentTypeField;
  question?: RepeaterItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(question);
  const subFields = repeaterField.fields ?? [];
  const questionFieldName =
    subFields.find((f) => f.type === "string")?.name ?? "question";
  const answerFieldName =
    subFields.find((f) => f.type === "richtext" || f.type === "text")?.name ??
    "answer";
  const publishedFieldName = subFields.find((f) => f.type === "boolean")?.name;

  const [questionText, setQuestionText] = useState(
    question ? String(question.values[questionFieldName] ?? "") : "",
  );
  const [answer, setAnswer] = useState(
    question ? String(question.values[answerFieldName] ?? "") : "",
  );
  const [published, setPublished] = useState(
    question && publishedFieldName
      ? question.values[publishedFieldName] !== false
      : true,
  );
  // Validierungsfehler direkt unters betroffene Feld statt als
  // Sammel-Meldung (Nutzervorgabe, 2026-08-15, gilt als Konvention für
  // alle Dialoge) – `submitError` nur für Server-/Netzwerkfehler.
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setQuestionText(
      question ? String(question.values[questionFieldName] ?? "") : "",
    );
    setAnswer(question ? String(question.values[answerFieldName] ?? "") : "");
    setPublished(
      question && publishedFieldName
        ? question.values[publishedFieldName] !== false
        : true,
    );
    setQuestionError(null);
    setAnswerError(null);
    setSubmitError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextQuestionError = questionText.trim()
      ? null
      : "Bitte eine Frage eingeben.";
    const nextAnswerError = answer.trim()
      ? null
      : "Bitte eine Antwort eingeben.";
    setQuestionError(nextQuestionError);
    setAnswerError(nextAnswerError);
    if (nextQuestionError || nextAnswerError) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const currentItems = toRepeaterItems(group.values[repeaterField.name]);
      const newValues: Record<string, unknown> = {
        [questionFieldName]: questionText,
        [answerFieldName]: answer,
      };
      if (publishedFieldName) newValues[publishedFieldName] = published;

      const nextItems =
        isEditing && question
          ? currentItems.map((item) =>
              item.id === question.id
                ? { ...item, values: { ...item.values, ...newValues } }
                : item,
            )
          : [...currentItems, { id: crypto.randomUUID(), values: newValues }];

      const res = await fetch(`/api/global-modules/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: { ...group.values, [repeaterField.name]: nextItems },
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        setSubmitError(errBody?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      onOpenChange(false);
      if (!isEditing) reset();
      if (isEditing) toastEdited();
      else toastCreated("Die Frage wurde angelegt.");
      router.refresh();
    } catch {
      setSubmitError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Frage bearbeiten" : "Frage hinzufügen"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="faq-question-text" required>
              Frage
            </Label>
            <Input
              id="faq-question-text"
              value={questionText}
              onChange={(e) => {
                setQuestionText(e.target.value);
                if (questionError) setQuestionError(null);
              }}
              aria-invalid={questionError ? true : undefined}
            />
            {questionError && (
              <p className="text-sm text-destructive">{questionError}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="faq-question-answer" required>
              Antwort
            </Label>
            <RichTextEditor
              id="faq-question-answer"
              value={answer}
              onChange={(html) => {
                setAnswer(html);
                if (answerError) setAnswerError(null);
              }}
              maxHeight="10rem"
            />
            {answerError && (
              <p className="text-sm text-destructive">{answerError}</p>
            )}
          </div>
          {publishedFieldName && (
            <div className="flex items-center gap-2">
              <Switch
                id="faq-question-published"
                checked={published}
                onCheckedChange={setPublished}
              />
              <Label htmlFor="faq-question-published">Veröffentlicht</Label>
            </div>
          )}
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Speichert…"
                : isEditing
                  ? "Speichern"
                  : "Hinzufügen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
