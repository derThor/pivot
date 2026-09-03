import {
  BlockFieldOutput,
  BlockSpacingWrapper,
  CoverOutput,
  DividerOutput,
  RichTextDisplay,
  TilesGridOutput,
  blockLayoutClasses,
  blockLayoutStyle,
  cn,
  isCoverModuleType,
  isDividerModule,
  isTilesModule,
  resolveBlockLayout,
  resolveInstanceValues,
  toGallerySettings,
  type BlockLayoutValue,
  type GlobalModule,
} from "@pivot/blocks";
import { PublicForm } from "@/components/public-form";
import type { ModuleType } from "@/lib/api";

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

/** Rendert `Content.data` (Block-Instanzen) für die öffentliche Website.
 * Bewusst dieselbe Logik wie die Redakteurs-Vorschau in apps/web
 * (`content-preview-render.tsx`) – beide nutzen `@pivot/blocks`, damit
 * Vorschau und echte Website nicht auseinanderlaufen. Unterschiede zur
 * Vorschau: kein Status-Badge und kein Titel (den setzt die Seite selbst).
 *
 * Formular-Bausteine rendern seit 2026-09-02 auch hier (`renderForm`) –
 * vorher fielen sie auf einer veröffentlichten Seite still weg, während
 * sie in der Backend-Vorschau sichtbar waren. Das Absenden läuft über
 * eigene Proxy-Routen dieser App, siehe app/api/forms/. */
export function ContentBlocks({
  data,
  moduleTypes,
  globalModules,
}: {
  data: Record<string, unknown>;
  moduleTypes: ModuleType[];
  globalModules: GlobalModule[];
}) {
  const moduleTypeById = new Map(
    moduleTypes.map((moduleType) => [moduleType.id, moduleType]),
  );

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(data).map(([field, value]) => {
        // Wird bereits als <h1> der Seite ausgegeben – Content-Types legen
        // häufig zusätzlich ein eigenes "title"-Feld in `data` an.
        if (field === "title") return null;
        if (isModuleInstanceArray(value)) {
          return (
            <div key={field} className="flow-root space-y-6">
              {value.map((instance) => {
                const resolved = resolveInstanceValues(instance, globalModules);
                const moduleType = moduleTypeById.get(resolved.moduleTypeId);
                if (!moduleType) return null;
                const contentFields = moduleType.schema.fields.filter(
                  (f) => !f.option,
                );
                const layout = resolveBlockLayout(
                  contentFields,
                  resolved.values,
                  instance.layout,
                );
                return (
                  <div
                    key={instance.id}
                    className={cn(
                      "block-layout",
                      blockLayoutClasses(layout.align, layout.width),
                    )}
                    style={blockLayoutStyle(layout.align, layout.width)}
                  >
                    <BlockSpacingWrapper layout={instance.layout}>
                      {isDividerModule(contentFields) ? (
                        <DividerOutput />
                      ) : isTilesModule(contentFields) ? (
                        <TilesGridOutput
                          contentFields={contentFields}
                          values={resolved.values}
                        />
                      ) : isCoverModuleType(contentFields) ? (
                        <CoverOutput
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
                              interactive
                              gallerySettings={toGallerySettings(
                                resolved.settings,
                              )}
                              renderForm={(id) => (
                                <PublicForm key={id} formId={id} />
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </BlockSpacingWrapper>
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
  );
}
