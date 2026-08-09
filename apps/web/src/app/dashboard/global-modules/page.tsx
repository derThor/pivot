import { GlobalModulesManager } from "@/components/global-modules-manager";
import { GlobalModuleDialog } from "@/components/global-module-dialog";
import { getGlobalModules, getModuleTypes } from "@/lib/api-server";

export default async function GlobalModulesPage() {
  const [globalModules, moduleTypes] = await Promise.all([
    getGlobalModules(),
    getModuleTypes(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Globale Module
          </h1>
          <p className="text-sm text-muted-foreground">
            Einmal pflegen, auf beliebig vielen Seiten einbinden (z.B. Footer,
            Header, Banner) – Änderungen wirken sich sofort überall aus.
          </p>
        </div>
        <GlobalModuleDialog moduleTypes={moduleTypes ?? []} />
      </div>
      <GlobalModulesManager
        items={globalModules ?? []}
        moduleTypes={moduleTypes ?? []}
      />
    </div>
  );
}
