"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, RotateCcw } from "lucide-react";

import { toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SwitchRow } from "@/components/switch-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  MailTemplateCategory,
  MailTemplateListItem,
} from "@/lib/api-server";

const CATEGORY_LABELS: Record<MailTemplateCategory, string> = {
  auth: "Konto & Anmeldung",
  privacy: "Datenschutz",
  forms: "Formulare",
};

// Erklärung je Platzhalter für den Tooltip beim Hovern über einen Chip –
// deckt den festen Katalog der System-Mails ab (siehe
// mail-templates.catalog.ts) sowie die beiden bei jeder Formular-Vorlage
// immer vorhandenen Platzhalter. Dynamische Formularfeld-Ids (siehe
// formFieldPlaceholders()) werden stattdessen über
// `template.placeholderLabels` mit dem echten Feld-Titel aus dem
// Formular-Builder aufgelöst (Nutzervorgabe: generischer Text war
// "blöd", hier muss der echte Name stehen).
const PLACEHOLDER_DESCRIPTIONS: Record<string, string> = {
  link: "Bestätigungs- bzw. Zurücksetzen-Link",
  title: "Titel des Datenschutzvorfalls",
  severity: "Schweregrad des Vorfalls",
  rows: "Anzahl der Zeilen/Kennzahlen im Bericht",
  dsrId: "ID der Betroffenenanfrage",
  dueAt: "Datum, an dem die Frist abläuft",
  processorName: "Name des Auftragsverarbeiters",
  formName: "Name des Formulars",
  submittedAt: "Zeitpunkt der Einsendung",
};

function placeholderDescription(
  placeholder: string,
  placeholderLabels?: Record<string, string>,
): string {
  return (
    placeholderLabels?.[placeholder] ??
    PLACEHOLDER_DESCRIPTIONS[placeholder] ??
    `Wert aus dem Formularfeld „${placeholder}“`
  );
}

function sampleValue(placeholder: string): string {
  return `Beispielwert (${placeholder})`;
}

function renderPreview(text: string, placeholders: string[]): string {
  let result = text;
  for (const placeholder of placeholders) {
    result = result.replaceAll(`{{${placeholder}}}`, sampleValue(placeholder));
  }
  return result;
}

function TemplateDetail({
  template,
  onSaved,
}: {
  template: MailTemplateListItem;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [enabled, setEnabled] = useState(template.enabled);
  const [recipientTo, setRecipientTo] = useState(template.recipientTo ?? "");
  const [testEmail, setTestEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertPlaceholder(placeholder: string) {
    const textarea = bodyRef.current;
    const token = `{{${placeholder}}}`;
    if (!textarea) {
      setBody((prev) => `${prev}${token}`);
      return;
    }
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + token.length;
    });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/settings/mail-templates/${encodeURIComponent(template.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            body,
            enabled,
            ...(template.recipientEditable
              ? { recipientTo: recipientTo || undefined }
              : {}),
          }),
        },
      );
      if (res.ok) {
        toastEdited("Vorlage wurde gespeichert.");
        onSaved();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    await fetch(
      `/api/settings/mail-templates/${encodeURIComponent(template.id)}`,
      {
        method: "DELETE",
      },
    );
    toastEdited("Vorlage wurde auf den Standard zurückgesetzt.");
    onSaved();
  }

  async function handleTestSend() {
    if (!testEmail) return;
    setIsSendingTest(true);
    try {
      const res = await fetch(
        `/api/settings/mail-templates/${encodeURIComponent(template.id)}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: testEmail }),
        },
      );
      if (res.ok) toastEdited(`Testmail an ${testEmail} gesendet.`);
    } finally {
      setIsSendingTest(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{template.label}</h3>
            {!template.formId && (
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                System
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {CATEGORY_LABELS[template.category]}
          </p>
        </div>
        {template.isCustomized && (
          <ConfirmDeleteDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border"
              >
                <RotateCcw className="size-4" />
                Auf Standard zurücksetzen
              </Button>
            }
            title="Vorlage auf Standard zurücksetzen?"
            description="Eigene Anpassungen an Betreff und Text gehen verloren."
            onConfirm={handleReset}
          />
        )}
      </div>

      <SwitchRow
        label="Versand aktiv"
        description="Bei ausgeschaltetem Schalter wird diese Mail beim nächsten Auslöser übersprungen."
        checked={enabled}
        onCheckedChange={setEnabled}
      />

      <Tabs defaultValue="template">
        <TabsList className="!h-auto w-fit justify-start gap-1 !overflow-visible bg-secondary p-1">
          <TabsTrigger value="template">Vorlage</TabsTrigger>
          {template.recipientEditable && (
            <TabsTrigger value="recipient">Empfänger</TabsTrigger>
          )}
          <TabsTrigger value="preview">Vorschau</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mail-subject">Betreff</Label>
            <Input
              id="mail-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mail-body">Text</Label>
            <Textarea
              id="mail-body"
              ref={bodyRef}
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          {template.placeholders.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Platzhalter</Label>
              <div className="flex flex-wrap gap-1.5">
                {template.placeholders.map((placeholder) => (
                  <Tooltip key={placeholder}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => insertPlaceholder(placeholder)}
                          className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        />
                      }
                    >
                      {`{{${placeholder}}}`}
                    </TooltipTrigger>
                    <TooltipContent>
                      {placeholderDescription(
                        placeholder,
                        template.placeholderLabels,
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="mail-test">Testmail senden an</Label>
              <Input
                id="mail-test"
                type="email"
                placeholder="name@beispiel.de"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-border"
              disabled={!testEmail || isSendingTest}
              onClick={handleTestSend}
            >
              <Send className="size-4" />
              {isSendingTest ? "Wird gesendet…" : "Testmail senden"}
            </Button>
          </div>
        </TabsContent>

        {template.recipientEditable && (
          <TabsContent value="recipient" className="flex flex-col gap-3 pt-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mail-recipient">Eigene Empfänger-Adresse</Label>
              <Input
                id="mail-recipient"
                type="email"
                placeholder="Leer = gemeinsame Adresse aus Einstellungen → Benachrichtigungen"
                value={recipientTo}
                onChange={(e) => setRecipientTo(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Ohne eigene Adresse geht diese Mail an die gemeinsame
                Benachrichtigungs-Adresse.
              </p>
            </div>
          </TabsContent>
        )}

        <TabsContent value="preview" className="flex flex-col gap-3 pt-4">
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="text-sm font-semibold">
              {renderPreview(subject, template.placeholders)}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {renderPreview(body, template.placeholders)}
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="button" disabled={isSaving} onClick={handleSave}>
          {isSaving ? "Speichert…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}

/** Mailing-Reiter unter Einstellungen (Nutzervorgabe, 2026-08-23): eine
 * einheitliche Liste aus System-Mails UND formulargebundenen Vorlagen
 * (siehe MailerService.listMailTemplates()). */
export function MailingSettingsCard({
  templates,
}: {
  templates: MailTemplateListItem[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? null);
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

  const groups: {
    category: MailTemplateCategory;
    items: MailTemplateListItem[];
  }[] = (["auth", "privacy", "forms"] as const)
    .map((category) => ({
      category,
      items: templates.filter((t) => t.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Mailing</CardTitle>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Mail-Vorlagen vorhanden.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div key={group.category} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 border-b border-border px-2 pb-1.5">
                    <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">
                      {CATEGORY_LABELS[group.category]}
                    </p>
                    {group.category !== "forms" && (
                      <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground normal-case">
                        System
                      </span>
                    )}
                  </div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border-l-4 px-3 py-2 text-left text-sm transition-colors",
                        item.id === selected?.id
                          ? "border-l-primary bg-primary/15 font-semibold text-foreground"
                          : "border-l-transparent text-foreground hover:bg-secondary",
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      {!item.enabled && (
                        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                          Pausiert
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border p-4">
              {selected && (
                <TemplateDetail
                  key={selected.id}
                  template={selected}
                  onSaved={() => router.refresh()}
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
