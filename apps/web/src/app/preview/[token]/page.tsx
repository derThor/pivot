import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BlockFieldOutput,
  DividerOutput,
  TilesGridOutput,
  blockLayoutClasses,
  isDividerModule,
  isTilesModule,
  resolveBlockLayout,
  resolveInstanceValues,
  type BlockLayoutValue,
} from "@/components/block-field-output";
import { RichTextDisplay } from "@/components/rich-text-display";
import {
  getContentByPreviewToken,
  getGlobalModules,
  getModuleTypes,
} from "@/lib/api-server";
import type { ContentStatus, ModuleType } from "@/lib/api-server";

interface ModuleInstance {
  id: string;
  moduleTypeId: string;
  values: Record<string, unknown>;
  layout?: BlockLayoutValue;
  globalModuleId?: string;
}

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

const statusLabel: Record<ContentStatus, string> = {
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

export default async function ContentPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [content, moduleTypes, globalModules] = await Promise.all([
    getContentByPreviewToken(token),
    getModuleTypes(),
    getGlobalModules(),
  ]);

  if (!content) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 bg-background p-8 text-center">
        <h1 className="text-xl font-semibold">Vorschau nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          Dieser Link ist ungültig oder abgelaufen.
        </p>
      </div>
    );
  }

  const moduleTypeById = new Map<string, ModuleType>(
    (moduleTypes ?? []).map((moduleType) => [moduleType.id, moduleType]),
  );

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 bg-background p-8">
      <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
        <Eye className="size-4 shrink-0" />
        Dies ist eine Vorschau – der Inhalt ist möglicherweise noch nicht
        veröffentlicht.
      </div>

      <div className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          {statusLabel[content.status]} · {content.contentType.name}
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">{content.title}</h1>
        {content.excerpt && (
          <p className="text-muted-foreground">{content.excerpt}</p>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {Object.entries(content.data).map(([field, value]) => {
          // Bereits als Überschrift oben gezeigt – Content-Types legen
          // häufig zusätzlich ein eigenes "title"-Feld in `data` an
          // (parallel zum Content.title), das hier sonst doppelt
          // erscheinen würde.
          if (field === "title") return null;
          if (isModuleInstanceArray(value)) {
            return (
              <div key={field} className="flow-root space-y-6">
                {value.map((instance) => {
                  const resolved = resolveInstanceValues(instance, globalModules ?? []);
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
                        <TilesGridOutput
                          contentFields={contentFields}
                          values={resolved.values}
                        />
                      ) : (
                        <div className="flow-root space-y-3">
                          {contentFields.map((moduleField) => (
                            <BlockFieldOutput
                              key={moduleField.name}
                              field={moduleField}
                              value={resolved.values[moduleField.name]}
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
          if (typeof value === "string" && value.trim().length > 0) {
            return <RichTextDisplay key={field} html={value} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}
