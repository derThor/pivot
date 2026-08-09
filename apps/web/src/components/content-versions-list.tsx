"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { diffWords } from "diff";
import { History, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSelection } from "@/hooks/use-selection";
import { formatName } from "@/lib/utils";
import {
  BlockFieldOutput,
  DividerOutput,
  TilesGridOutput,
  blockLayoutClasses,
  isDividerModule,
  isTilesModule,
  resolveBlockLayout,
  resolveInstanceValues,
} from "@/components/block-field-output";
import type { ModuleInstance } from "@/components/block-editor-field";
import type { ContentVersion, GlobalModule, ModuleType } from "@/lib/api-server";

function isModuleInstanceArray(value: unknown): value is ModuleInstance[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "moduleTypeId" in item &&
        "values" in item,
    )
  );
}

// Rein lesende Vorschau eines Modul-Felder-Werts (Version oder aktueller
// Stand) – dieselbe Darstellungslogik wie der Block-Editor und die
// öffentliche Vorschau-Seite (`BlockFieldOutput`/`resolveBlockLayout`),
// damit "wie es aussehen muss" hier exakt übereinstimmt.
function ModulesPreview({
  value,
  moduleTypes,
  globalModules,
}: {
  value: unknown;
  moduleTypes: ModuleType[];
  globalModules: GlobalModule[];
}) {
  if (!isModuleInstanceArray(value) || value.length === 0) {
    return (
      <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        Keine Bausteine.
      </p>
    );
  }
  const moduleTypeById = new Map(moduleTypes.map((mt) => [mt.id, mt]));
  return (
    <div className="flow-root space-y-6 rounded-md border bg-white p-4 dark:bg-neutral-950">
      {value.map((instance) => {
        const resolved = resolveInstanceValues(instance, globalModules);
        const moduleType = moduleTypeById.get(resolved.moduleTypeId);
        if (!moduleType) return null;
        const contentFields = moduleType.schema.fields.filter((f) => !f.option);
        const layout = resolveBlockLayout(contentFields, resolved.values, instance.layout);
        return (
          <div
            key={instance.id}
            className={blockLayoutClasses(layout.align)}
            style={{ width: `${layout.width}%` }}
          >
            {isDividerModule(contentFields) ? (
              <DividerOutput />
            ) : isTilesModule(contentFields) ? (
              <TilesGridOutput contentFields={contentFields} values={resolved.values} />
            ) : (
              <div className="flow-root space-y-3">
                {contentFields.map((field) => (
                  <BlockFieldOutput
                    key={field.name}
                    field={field}
                    value={resolved.values[field.name]}
                    applyOwnLayout={contentFields.length > 1}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function stringifyValue(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function hasFieldChanged(oldValue: unknown, newValue: unknown) {
  return stringifyValue(oldValue) !== stringifyValue(newValue);
}

function DiffBox({
  oldValue,
  newValue,
}: {
  oldValue: unknown;
  newValue: unknown;
}) {
  const parts = diffWords(stringifyValue(oldValue), stringifyValue(newValue));

  return (
    <p className="rounded-md border bg-muted/30 p-2 text-sm break-words whitespace-pre-wrap">
      {parts.map((part, index) => (
        <span
          key={index}
          className={
            part.added
              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : part.removed
                ? "bg-destructive/20 text-destructive line-through"
                : undefined
          }
        >
          {part.value}
        </span>
      ))}
    </p>
  );
}

function FieldDiff({
  label,
  oldValue,
  newValue,
}: {
  label: string;
  oldValue: unknown;
  newValue: unknown;
}) {
  if (!hasFieldChanged(oldValue, newValue)) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <DiffBox oldValue={oldValue} newValue={newValue} />
    </div>
  );
}

export function ContentVersionsList({
  contentId,
  currentData,
  versions,
  richtextFields = [],
  moduleFields = [],
  moduleTypes = [],
  globalModules = [],
}: {
  contentId: string;
  currentData: Record<string, unknown>;
  versions: ContentVersion[];
  /** Feldnamen, die laut ContentType.schema vom Typ "richtext" sind. */
  richtextFields?: string[];
  /** Feldnamen, die laut ContentType.schema vom Typ "modules" sind. */
  moduleFields?: string[];
  moduleTypes?: ModuleType[];
  globalModules?: GlobalModule[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { selected, toggle, toggleAll, clear, allSelected, someSelected, count } =
    useSelection(versions.map((version) => version.id));

  async function handleRollback(versionId: string) {
    await fetch(`/api/content/${contentId}/versions/${versionId}/rollback`, {
      method: "POST",
    });
    router.refresh();
  }

  async function handleDelete(versionId: string) {
    await fetch(`/api/content/${contentId}/versions/${versionId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  async function handleBulkDelete() {
    await Promise.all(
      [...selected].map((versionId) =>
        fetch(`/api/content/${contentId}/versions/${versionId}`, {
          method: "DELETE",
        }),
      ),
    );
    clear();
    router.refresh();
  }

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Versionshistorie vorhanden – sie entsteht ab der ersten
        Bearbeitung dieses Inhalts.
      </p>
    );
  }

  const fieldNames = Array.from(
    new Set([
      ...versions.flatMap((version) => Object.keys(version.data)),
      ...Object.keys(currentData),
    ]),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onCheckedChange={toggleAll}
          aria-label="Alle auswählen"
        />
        <span className="text-sm text-muted-foreground">Alle auswählen</span>
      </div>
      <SelectionToolbar
        count={count}
        entityLabelPlural="Versionen"
        onDelete={handleBulkDelete}
        onClear={clear}
      />
      {versions.map((version) => {
        const isExpanded = expandedId === version.id;
        return (
          <Card key={version.id}>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selected.has(version.id)}
                  onCheckedChange={() => toggle(version.id)}
                  aria-label="Version auswählen"
                />
                <div>
                  <p className="text-sm font-medium">
                    {new Date(version.createdAt).toLocaleString("de-DE")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bearbeitet von {formatName(version.createdBy)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedId(isExpanded ? null : version.id)}
                >
                  {isExpanded ? "Diff verbergen" : "Diff anzeigen"}
                </Button>
                <ConfirmDeleteDialog
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <History />
                      Wiederherstellen
                    </Button>
                  }
                  title="Diese Version wiederherstellen?"
                  description="Der aktuelle Stand wird vorher automatisch als neue Version gesichert – du kannst diese Aktion also selbst wieder rückgängig machen."
                  confirmLabel="Wiederherstellen"
                  confirmingLabel="Stellt wieder her…"
                  variant="default"
                  onConfirm={() => handleRollback(version.id)}
                />
                <ConfirmDeleteDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Version löschen"
                    >
                      <Trash2 />
                    </Button>
                  }
                  title="Diese Version löschen?"
                  description="Diese Aktion kann nicht rückgängig gemacht werden. Der aktuelle Inhalt ist davon nicht betroffen, nur dieser historische Stand verschwindet aus der Versionshistorie."
                  onConfirm={() => handleDelete(version.id)}
                />
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="flex flex-col gap-3">
                {fieldNames.map((field) => {
                  const oldValue = version.data[field];
                  const newValue = currentData[field];

                  if (moduleFields.includes(field)) {
                    // Bausteine-Felder zeigen die Vorschau immer, auch
                    // ohne Änderung (gleicher Grund wie bei Richtext
                    // unten) – "Vorschau" rendert den historischen Stand
                    // dieser Version genau wie Editor/öffentliche Seite
                    // ihn zeigen würden, "JSON" den rohen Diff.
                    return (
                      <Tabs key={field} defaultValue="preview">
                        <TabsList>
                          <TabsTrigger value="preview">Vorschau</TabsTrigger>
                          <TabsTrigger value="json">{field} (JSON)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="json">
                          <DiffBox oldValue={oldValue} newValue={newValue} />
                        </TabsContent>
                        <TabsContent value="preview">
                          <ModulesPreview
                            value={oldValue}
                            moduleTypes={moduleTypes}
                            globalModules={globalModules}
                          />
                        </TabsContent>
                      </Tabs>
                    );
                  }

                  if (!richtextFields.includes(field)) {
                    // FieldDiff blendet sich selbst aus, wenn sich das
                    // Feld nicht geändert hat – für Nicht-Richtext-Felder
                    // gibt es sonst keine sinnvolle Darstellung.
                    return (
                      <FieldDiff
                        key={field}
                        label={field}
                        oldValue={oldValue}
                        newValue={newValue}
                      />
                    );
                  }

                  // Richtext-Felder zeigen die Vorschau immer, auch wenn
                  // sich zwischen dieser Version und dem aktuellen Stand
                  // nichts geändert hat (z.B. weil nur der Status
                  // umgeschaltet wurde) – sonst verschwindet der gesamte
                  // historische Inhalt aus der Ansicht, sobald keine
                  // Textänderung vorliegt.
                  return (
                    <Tabs key={field} defaultValue="preview">
                      <TabsList>
                        <TabsTrigger value="preview">Vorschau</TabsTrigger>
                        <TabsTrigger value="html">{field} (HTML)</TabsTrigger>
                      </TabsList>
                      <TabsContent value="html">
                        <DiffBox oldValue={oldValue} newValue={newValue} />
                      </TabsContent>
                      <TabsContent value="preview">
                        <RichTextEditor
                          editable={false}
                          value={
                            typeof oldValue === "string" ? oldValue : ""
                          }
                        />
                      </TabsContent>
                    </Tabs>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
