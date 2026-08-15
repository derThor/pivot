"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toastDeleted } from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { FaqGroupDialog } from "@/components/faq-group-dialog";
import { FaqQuestionDialog } from "@/components/faq-question-dialog";
import { RichTextDisplay } from "@/components/rich-text-display";
import { toRepeaterItems, type RepeaterItem } from "@/components/block-field-output";
import { cn } from "@/lib/utils";
import type { GlobalModule, ModuleType } from "@/lib/api-server";

// Exakte Werte aus der Figma-Referenz übernommen (nicht die generischen
// Badge-/Card-Tokens aus globals.css), damit Farben/Radien/Abstände 1:1
// übereinstimmen – siehe Nutzervorgabe "muss exakt so aussehen".
const iconBgClassName = "bg-[#BCE64D]/28";
const darkTextClassName = "text-[#132033]";
const countBadgeClassName = "bg-[#ECECEC] text-[#526074]";
const publishedBadgeClassName = "bg-green-100 text-green-700";
const draftBadgeClassName = "bg-[#ECECEC] text-[#526074]";
const chevronClassName = "size-[17px] shrink-0 text-[#8C8C8C]";

/** Ersetzt die generische Tabellen-Ansicht (`GlobalModulesManager`) speziell
 * für FAQs (Nutzervorgabe, 2026-08-15): Gruppen (= FAQ-Module) als
 * aufklappbare Karten, Fragen (= Repeater-Einträge) darin wiederum als
 * eigene Akkordeon-Zeilen mit Veröffentlicht/Entwurf-Badge – näher an der
 * öffentlichen Darstellung als eine reine Verwaltungstabelle. Design 1:1
 * aus einer Figma-Referenzseite übernommen (Farben/Radien/Abstände per
 * Chrome-DevTools-Protocol aus den `computedStyle`-Werten der Referenz
 * ausgelesen, nicht nur optisch geschätzt).
 *
 * Reine UI-Komponente über dem generischen Modul-Schema: kennt
 * "Gruppe"/"Frage" nur als Bezeichnung, liest Fragefeld/Antwortfeld/
 * Veröffentlicht-Feld weiterhin anhand ihres Typs aus dem Schema (wie der
 * Rest der Modul-Bibliothek, siehe block-field-output.tsx). */
export function FaqGroupsManager({
  items,
  moduleType,
}: {
  items: GlobalModule[];
  moduleType: ModuleType;
}) {
  const router = useRouter();
  const repeaterField = moduleType.schema.fields.find(
    (f) => f.type === "repeater",
  );
  const subFields = repeaterField?.fields ?? [];
  const questionField = subFields.find((f) => f.type === "string");
  const publishedField = subFields.find((f) => f.type === "boolean");

  function questionsOf(group: GlobalModule) {
    return repeaterField ? toRepeaterItems(group.values[repeaterField.name]) : [];
  }

  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [expandedQuestions, setExpandedQuestions] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [editGroup, setEditGroup] = useState<GlobalModule | null>(null);
  const [questionDialogTarget, setQuestionDialogTarget] = useState<{
    group: GlobalModule;
    question?: RepeaterItem;
  } | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<GlobalModule | null>(null);
  const [deleteQuestion, setDeleteQuestion] = useState<{
    group: GlobalModule;
    questionId: string;
  } | null>(null);

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleQuestion(id: string) {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteGroup() {
    if (!deleteGroup) return;
    await fetch(`/api/global-modules/${deleteGroup.id}`, { method: "DELETE" });
    toastDeleted(`„${deleteGroup.name}“ wurde gelöscht.`);
    router.refresh();
  }

  async function handleDeleteQuestion() {
    if (!deleteQuestion || !repeaterField) return;
    const { group, questionId } = deleteQuestion;
    const nextItems = questionsOf(group).filter((item) => item.id !== questionId);
    await fetch(`/api/global-modules/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values: { ...group.values, [repeaterField.name]: nextItems },
      }),
    });
    toastDeleted("Die Frage wurde entfernt.");
    router.refresh();
  }

  if (!repeaterField || !questionField) {
    return (
      <p className="text-sm text-muted-foreground">
        FAQ-Modul-Typ hat kein gültiges Frage-Feld.
      </p>
    );
  }

  const totalQuestions = items.reduce(
    (sum, group) => sum + questionsOf(group).length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 text-sm">
        <span>
          <span className="font-semibold">{items.length}</span>{" "}
          <span className="text-muted-foreground">
            {items.length === 1 ? "Gruppe" : "Gruppen"}
          </span>
        </span>
        <span>
          <span className="font-semibold">{totalQuestions}</span>{" "}
          <span className="text-muted-foreground">
            {totalQuestions === 1 ? "Frage" : "Fragen"}
          </span>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine FAQ-Gruppen angelegt.
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {items.map((group) => {
            const questions = questionsOf(group);
            const isGroupOpen = expandedGroups.has(group.id);
            const description =
              typeof group.values.description === "string"
                ? group.values.description
                : "";

            return (
              <div
                key={group.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E6E6E6]"
              >
                <div className="flex w-full items-center gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
                      iconBgClassName,
                      darkTextClassName,
                    )}
                  >
                    <HelpCircle className="size-[17px]" strokeWidth={1.7} />
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span
                      className={cn("block text-[15px] font-semibold", darkTextClassName)}
                    >
                      {group.name}
                    </span>
                    {description && (
                      <span className="mt-0.5 block text-[12.5px] text-[#8C8C8C]">
                        {description}
                      </span>
                    )}
                  </button>
                  {/* Mobil: nur die Zahl in einem runden Kreis statt der
                      Text-Badge (Nutzervorgabe, 2026-08-15) – so bleibt
                      alles in einer Zeile, ohne dass eine zweite Zeile für
                      die Badge gebraucht wird. */}
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium sm:hidden",
                      countBadgeClassName,
                    )}
                  >
                    {questions.length}
                  </span>
                  <span
                    className={cn(
                      "hidden shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium sm:inline-block",
                      countBadgeClassName,
                    )}
                  >
                    {questions.length} {questions.length === 1 ? "Frage" : "Fragen"}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 rounded-full"
                          aria-label={`Aktionen für ${group.name}`}
                        />
                      }
                    >
                      <MoreVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditGroup(group)}>
                        <Pencil />
                        Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteGroup(group)}
                      >
                        <Trash2 />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="shrink-0"
                    aria-label={isGroupOpen ? "Gruppe einklappen" : "Gruppe ausklappen"}
                  >
                    {isGroupOpen ? (
                      <ChevronUp className={chevronClassName} strokeWidth={1.7} />
                    ) : (
                      <ChevronDown className={chevronClassName} strokeWidth={1.7} />
                    )}
                  </button>
                </div>

                {isGroupOpen && (
                  <div className="border-t border-[#EFEFEF] bg-[#FCFCFC] px-4 py-4 sm:px-5">
                    {questions.length === 0 ? (
                      <p className="px-1 text-sm text-muted-foreground">
                        Noch keine Fragen in dieser Gruppe.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {questions.map((question) => {
                          const isQuestionOpen = expandedQuestions.has(question.id);
                          const published = publishedField
                            ? question.values[publishedField.name] !== false
                            : true;
                          const questionText = String(
                            question.values[questionField.name] ?? "",
                          );
                          const answerField = subFields.find(
                            (f) => f.type === "richtext" || f.type === "text",
                          );
                          const answerHtml = answerField
                            ? String(question.values[answerField.name] ?? "")
                            : "";

                          return (
                            <div
                              key={question.id}
                              className="overflow-hidden rounded-xl bg-white ring-1 ring-[#E6E6E6]"
                            >
                              <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
                                <button
                                  type="button"
                                  onClick={() => toggleQuestion(question.id)}
                                  className={cn(
                                    "flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold",
                                    darkTextClassName,
                                  )}
                                >
                                  {/* Mobil: Status nur als Punkt vor dem
                                      Titel statt Text-Badge (Nutzervorgabe,
                                      2026-08-15). */}
                                  <span
                                    className={cn(
                                      "size-2 shrink-0 rounded-full sm:hidden",
                                      published ? "bg-green-500" : "bg-[#8C8C8C]",
                                    )}
                                    aria-hidden
                                  />
                                  <span className="min-w-0">{questionText || "…"}</span>
                                </button>
                                <span
                                  className={cn(
                                    "hidden shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium sm:inline-block",
                                    published
                                      ? publishedBadgeClassName
                                      : draftBadgeClassName,
                                  )}
                                >
                                  {published ? "Veröffentlicht" : "Entwurf"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleQuestion(question.id)}
                                  className="shrink-0"
                                  aria-label={
                                    isQuestionOpen ? "Frage einklappen" : "Frage ausklappen"
                                  }
                                >
                                  {isQuestionOpen ? (
                                    <ChevronUp className={chevronClassName} strokeWidth={1.7} />
                                  ) : (
                                    <ChevronDown className={chevronClassName} strokeWidth={1.7} />
                                  )}
                                </button>
                              </div>
                              {isQuestionOpen && (
                                <div className="flex flex-col gap-3 border-t border-[#EFEFEF] px-4 py-4">
                                  {answerHtml && (
                                    <RichTextDisplay
                                      html={answerHtml}
                                      className="text-sm text-muted-foreground"
                                    />
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="font-normal"
                                      onClick={() =>
                                        setQuestionDialogTarget({ group, question })
                                      }
                                    >
                                      <Pencil />
                                      Bearbeiten
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="font-normal"
                                      onClick={() =>
                                        setDeleteQuestion({ group, questionId: question.id })
                                      }
                                    >
                                      <Trash2 />
                                      Löschen
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setQuestionDialogTarget({ group })}
                      className="mt-3 flex w-fit items-center gap-2 rounded-xl border border-dashed border-[#D5D5D5] px-4 py-2.5 text-[12.5px] font-medium text-[#6E6E6E] transition hover:border-[#BCE64D] hover:text-[#132033]"
                    >
                      <Plus className="size-4" />
                      Frage hinzufügen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editGroup && (
        <FaqGroupDialog
          moduleType={moduleType}
          group={editGroup}
          hideTrigger
          open={editGroup !== null}
          onOpenChange={(open) => !open && setEditGroup(null)}
        />
      )}

      {questionDialogTarget && (
        <FaqQuestionDialog
          group={questionDialogTarget.group}
          question={questionDialogTarget.question}
          repeaterField={repeaterField}
          open={questionDialogTarget !== null}
          onOpenChange={(open) => !open && setQuestionDialogTarget(null)}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteGroup !== null}
        onOpenChange={(open) => !open && setDeleteGroup(null)}
        title={`„${deleteGroup?.name}“ löschen?`}
        description="Die Gruppe und alle enthaltenen Fragen werden entfernt. Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDeleteGroup}
      />

      <ConfirmDeleteDialog
        open={deleteQuestion !== null}
        onOpenChange={(open) => !open && setDeleteQuestion(null)}
        title="Frage löschen?"
        description="Diese Frage wird aus der Gruppe entfernt. Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDeleteQuestion}
      />
    </div>
  );
}
