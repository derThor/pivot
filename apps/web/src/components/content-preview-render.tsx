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
import type { ContentStatus, GlobalModule, ModuleType } from "@/lib/api-server";

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

/** Gemeinsame Teilmenge der Felder, die sowohl `ContentDetail` (interne
 * Vorschau, authentifiziert) als auch `PreviewContent` (externer,
 * token-basierter Freigabe-Link) bereitstellen. */
export interface PreviewRenderableContent {
  title: string;
  status: ContentStatus;
  excerpt: string | null;
  data: Record<string, unknown>;
  contentType: { id: string; name: string; slug: string };
}

/** Rendert Titel, Status-Badge und Block-Inhalte eines Artikels read-only –
 * gemeinsam genutzt von der internen Redakteurs-Vorschau
 * (`/dashboard/content/[id]/preview`) und der externen, per Freigabe-Link
 * erreichbaren Vorschau (`/preview/[token]`). */
export function ContentPreviewRender({
  content,
  moduleTypes,
  globalModules,
}: {
  content: PreviewRenderableContent;
  moduleTypes: ModuleType[] | null | undefined;
  globalModules: GlobalModule[] | null | undefined;
}) {
  const moduleTypeById = new Map<string, ModuleType>(
    (moduleTypes ?? []).map((moduleType) => [moduleType.id, moduleType]),
  );

  return (
    <>
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
    </>
  );
}
