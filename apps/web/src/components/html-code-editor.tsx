"use client";

import { useRef, type ReactNode } from "react";
import { useTheme } from "next-themes";
import CodeMirror, {
  EditorView,
  type ReactCodeMirrorRef,
} from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Rohes HTML/CSS statt eines Rich-Text-Editors (Nutzerkorrektur,
 * 2026-08-30: "ich brauche die komplette Gestaltung des HTML ... jeder
 * Client hat ein vollständig eigenes Design ... da können wir keine
 * dummen vorgefertigten Bausteine einsetzen" – ein Editor mit eigenem
 * Dokument-Schema, egal wie mächtig, kann beliebiges, von einer Agentur
 * geliefertes Mail-HTML nicht verlustfrei rundreisen). Verwendet für
 * E-Mail-Hüllen und den Inhalt individueller Mail-Vorlagen (siehe
 * mailing-settings-card.tsx). CSS-Inlining vor dem Versand passiert
 * serverseitig (MailerService, `juice`), hier wird nur roh editiert. */
export function HtmlCodeEditor({
  value,
  onChange,
  placeholderChips,
  note,
  // Nutzervorgabe, 2026-08-30: "bitte den html editor auf maximale height
  // stellen" – komplette Mail-Hüllen sind lange Dokumente, 20rem zeigte
  // kaum mehr als den `<head>`-Block.
  minHeight = "70vh",
}: {
  value: string;
  onChange: (html: string) => void;
  /** Klickbare `{{token}}`-Chips, fügen an der aktuellen Cursor-Position
   * ein (gleiches Muster wie bei den Textarea-basierten Vorlagen). */
  placeholderChips?: { token: string; description: string }[];
  /** Erklärungstext(e) über den Chips, Teil derselben fixierten
   * Kopfzeile (Nutzervorgabe, 2026-08-30: "diesen Bereich mitscrollen
   * lassen" – die Hinweise zu den Platzhaltern sollen beim Scrollen durch
   * ein langes HTML-Dokument sichtbar bleiben, nicht nach oben wegscrollen). */
  note?: ReactNode;
  minHeight?: string;
}) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Nutzervorgabe, 2026-08-30: "im dark modus ist das alles hell" – der
  // CodeMirror-Editor hatte bisher keinen `theme`-Prop und blieb dadurch
  // immer beim hellen Standard, unabhängig vom Dashboard-eigenen
  // Hell/Dunkel-Modus (nicht zu verwechseln mit dem Dark-Mode-CSS im
  // Mail-HTML selbst, das unabhängig davon ist).
  const { resolvedTheme } = useTheme();

  function insertAtCursor(token: string) {
    const view = editorRef.current?.view;
    if (!view) {
      onChange(`${value}${token}`);
      return;
    }
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: token },
      selection: { anchor: from + token.length },
    });
    view.focus();
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-input">
      <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-t-lg border-b border-input bg-background p-2">
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {placeholderChips?.map((chip) => (
              <Tooltip key={chip.token}>
                <TooltipTrigger
                  render={
                    <Badge
                      variant="outline"
                      render={
                        <button
                          type="button"
                          onClick={() => insertAtCursor(chip.token)}
                          className="cursor-pointer transition-colors hover:bg-primary/10 hover:text-primary"
                        />
                      }
                    />
                  }
                >
                  {chip.token}
                </TooltipTrigger>
                <TooltipContent>{chip.description}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            HTML-Datei hochladen
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,text/html"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
      <CodeMirror
        ref={editorRef}
        value={value}
        onChange={onChange}
        extensions={[html(), EditorView.lineWrapping]}
        minHeight={minHeight}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        className="min-w-0 overflow-hidden rounded-b-lg text-sm"
      />
    </div>
  );
}
