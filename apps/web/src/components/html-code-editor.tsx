"use client";

import { useRef } from "react";
import CodeMirror, {
  EditorView,
  type ReactCodeMirrorRef,
} from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { Upload } from "lucide-react";

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
  minHeight?: string;
}) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-lg border border-input">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-input bg-background p-2">
        <div className="flex flex-wrap gap-1.5">
          {placeholderChips?.map((chip) => (
            <Tooltip key={chip.token}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => insertAtCursor(chip.token)}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
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
        className="min-w-0 text-sm"
      />
    </div>
  );
}
