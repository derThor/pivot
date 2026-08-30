"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, RotateCcw, Trash2 } from "lucide-react";

import {
  toastCreated,
  toastDeleted,
  toastEdited,
  toastWarning,
} from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SwitchRow } from "@/components/switch-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HtmlCodeEditor } from "@/components/html-code-editor";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  MailShellListItem,
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

// Gleiches `{{...}}`-Muster wie bei den übrigen Platzhaltern, aber fest
// (nicht pro Vorlage konfigurierbar) – markiert in einer E-Mail-Hülle die
// Stelle, an der der eigentliche Vorlagen-Inhalt eingesetzt wird (siehe
// MailerService.wrapInShell).
const SHELL_CONTENT_PLACEHOLDER = "{{content}}";

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

// Backend-Pendant: MailerService.plainTextToHtml() – dieselbe einfache
// Klartext-zu-HTML-Umwandlung, hier nur fürs Vorschau-Rendering im Browser
// dupliziert (kein gemeinsames Paket zwischen apps/web und apps/api).
function escapeHtmlPreview(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function linkifyPreview(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

function plainTextToHtmlPreview(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p>${linkifyPreview(escapeHtmlPreview(para)).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

/** "+ Neue Vorlage"/"+ Neue Hülle" (Nutzervorgabe, 2026-08-30) – beide
 * legen nur einen Namen fest, alles Weitere wird danach im jeweiligen
 * Editor bearbeitet. Ein gemeinsamer, generischer Dialog statt zweier
 * fast identischer Dateien. */
function CreateNamedItemDialog({
  triggerLabel,
  dialogTitle,
  nameLabel,
  endpoint,
  onCreated,
}: {
  triggerLabel: string;
  dialogTitle: string;
  nameLabel: string;
  endpoint: string;
  onCreated: (id: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const created = await res.json().catch(() => null);
      if (!res.ok || !created) return;
      toastCreated(`„${name}“ wurde angelegt.`);
      setOpen(false);
      setName("");
      onCreated(created.id);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="border-border" />
        }
      >
        <Plus className="size-4" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-item-name" required>
              {nameLabel}
            </Label>
            <Input
              id="new-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
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
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? "Wird angelegt…" : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDetail({
  template,
  shells,
  onSaved,
}: {
  template: MailTemplateListItem;
  shells: MailShellListItem[];
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [shellId, setShellId] = useState(template.shellId ?? "");
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
            shellId: shellId || null,
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

  async function handleDelete() {
    await fetch(
      `/api/settings/mail-templates/${encodeURIComponent(template.id)}`,
      { method: "DELETE" },
    );
    toastDeleted("Vorlage wurde auf den Standard zurückgesetzt.");
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
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        toastEdited(`Testmail an ${testEmail} gesendet.`);
      } else {
        toastWarning(
          "Testmail konnte nicht gesendet werden.",
          data?.error ?? data?.message ?? "Unbekannter Fehler.",
        );
      }
    } finally {
      setIsSendingTest(false);
    }
  }

  const selectedShell = shells.find((s) => s.id === shellId);
  const defaultShell = shells.find((s) => s.isDefault);
  const previewShellContent =
    selectedShell?.content ?? defaultShell?.content ?? SHELL_CONTENT_PLACEHOLDER;

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
            onConfirm={handleDelete}
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
        <TabsList className="!h-auto w-fit justify-start gap-1 !overflow-visible p-1">
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
            <Label htmlFor="mail-shell">E-Mail-Template</Label>
            <Select
              value={shellId || "__default"}
              onValueChange={(next) =>
                setShellId(next === "__default" ? "" : (next ?? ""))
              }
            >
              <SelectTrigger id="mail-shell" className="!w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default">
                  Standard-Template{defaultShell ? ` (${defaultShell.name})` : ""}
                </SelectItem>
                {shells.map((shell) => (
                  <SelectItem key={shell.id} value={shell.id}>
                    {shell.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="overflow-hidden rounded-lg border border-border">
            {/* Die Hülle ist ein vollständiges HTML-Dokument (eigenes
               <html>/<head>/<style>) – als `dangerouslySetInnerHTML` auf
               ein <div> gesetzt, zerlegt der Browser diese Tags beim
               Fragment-Parsing und die Styles greifen nicht zuverlässig
               (Nutzer-Bugreport, 2026-08-30: "sehe nur das Design, nicht
               die Daten"). Ein <iframe srcDoc> gibt der Hülle einen
               echten, isolierten Dokumentkontext, in dem sie exakt so
               rendert wie im tatsächlichen Mail-Programm. */}
            <iframe
              title="Vorschau"
              sandbox=""
              className="h-[32rem] w-full bg-white"
              srcDoc={previewShellContent.replaceAll(
                SHELL_CONTENT_PLACEHOLDER,
                plainTextToHtmlPreview(
                  renderPreview(body, template.placeholders),
                ),
              )}
            />
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

function ShellDetail({
  shell,
  onSaved,
}: {
  shell: MailShellListItem;
  onSaved: () => void;
}) {
  const [name, setName] = useState(shell.name);
  const [content, setContent] = useState(shell.content);
  const [isDefault, setIsDefault] = useState(shell.isDefault);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/settings/mail-shells/${encodeURIComponent(shell.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, content, isDefault }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      toastEdited("E-Mail-Template wurde gespeichert.");
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const res = await fetch(
      `/api/settings/mail-shells/${encodeURIComponent(shell.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toastEdited(data?.message ?? "E-Mail-Template konnte nicht gelöscht werden.");
      return;
    }
    toastDeleted(`„${shell.name}“ wurde gelöscht.`);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="shell-name">Name</Label>
          <Input
            id="shell-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <ConfirmDeleteDialog
          trigger={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border"
              disabled={shell.isDefault || shell.usedByCount > 0}
            >
              <Trash2 className="size-4" />
              Template löschen
            </Button>
          }
          title={`„${shell.name}“ löschen?`}
          description={
            shell.isDefault
              ? "Das Standard-Template kann nicht gelöscht werden. Erst ein anderes Template als Standard festlegen."
              : shell.usedByCount > 0
                ? `Dieses Template wird noch von ${shell.usedByCount} ${shell.usedByCount === 1 ? "Vorlage" : "Vorlagen"} genutzt.`
                : "Dieses Template wird endgültig gelöscht."
          }
          onConfirm={handleDelete}
        />
      </div>

      <SwitchRow
        label="Standard-Template"
        description="Wird von Vorlagen ohne eigene Template-Auswahl verwendet."
        checked={isDefault}
        onCheckedChange={setIsDefault}
      />

      <div className="flex flex-col gap-1.5">
        <Label>Inhalt (HTML/CSS)</Label>
        <p className="text-xs text-muted-foreground">
          Der Platzhalter {SHELL_CONTENT_PLACEHOLDER} markiert die Stelle,
          an der der Vorlagen-Inhalt eingesetzt wird – muss genau einmal
          vorhanden sein.
        </p>
        <HtmlCodeEditor
          value={content}
          onChange={setContent}
          placeholderChips={[
            {
              token: SHELL_CONTENT_PLACEHOLDER,
              description: "Hier wird der Vorlagen-Inhalt eingesetzt",
            },
          ]}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

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
 * (siehe MailerService.listMailTemplates()). Erweitert 2026-08-30 um
 * individuelle HTML-Vorlagen + mehrere E-Mail-Hüllen pro Installation
 * (siehe knowledge-base/content/forms.md, Konzeptabschnitt). */
export function MailingSettingsCard({
  templates,
  shells,
}: {
  templates: MailTemplateListItem[];
  shells: MailShellListItem[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? null);
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const [selectedShellId, setSelectedShellId] = useState(shells[0]?.id ?? null);
  const selectedShell =
    shells.find((s) => s.id === selectedShellId) ?? shells[0];

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
        <Tabs defaultValue="templates">
          <TabsList className="!h-auto w-fit justify-start gap-1 !overflow-visible p-1">
            <TabsTrigger value="templates">Vorlagen</TabsTrigger>
            <TabsTrigger value="shells">E-Mail-Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="pt-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="flex flex-col gap-4">
                {groups.map((group) => (
                  <div key={group.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-2 pb-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">
                          {CATEGORY_LABELS[group.category]}
                        </p>
                        {group.category !== "forms" && (
                          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground normal-case">
                            System
                          </span>
                        )}
                      </div>
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
              <div className="min-w-0 rounded-xl border border-border p-4">
                {selected && (
                  <TemplateDetail
                    key={selected.id}
                    template={selected}
                    shells={shells}
                    onSaved={() => router.refresh()}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="shells" className="pt-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 border-b border-border px-2 pb-1.5">
                  <p className="text-xs font-semibold tracking-wide text-accent-foreground uppercase">
                    Templates
                  </p>
                  <CreateNamedItemDialog
                    triggerLabel="Neu"
                    dialogTitle="Neues E-Mail-Template anlegen"
                    nameLabel="Name"
                    endpoint="/api/settings/mail-shells"
                    onCreated={setSelectedShellId}
                  />
                </div>
                {shells.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    Noch keine E-Mail-Templates angelegt.
                  </p>
                ) : (
                  shells.map((shell) => (
                    <button
                      key={shell.id}
                      type="button"
                      onClick={() => setSelectedShellId(shell.id)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border-l-4 px-3 py-2 text-left text-sm transition-colors",
                        shell.id === selectedShell?.id
                          ? "border-l-primary bg-primary/15 font-semibold text-foreground"
                          : "border-l-transparent text-foreground hover:bg-secondary",
                      )}
                    >
                      <span className="truncate">{shell.name}</span>
                      {shell.isDefault && (
                        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                          Standard
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="min-w-0 rounded-xl border border-border p-4">
                {selectedShell ? (
                  <ShellDetail
                    key={selectedShell.id}
                    shell={selectedShell}
                    onSaved={() => router.refresh()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Noch kein E-Mail-Template angelegt.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
