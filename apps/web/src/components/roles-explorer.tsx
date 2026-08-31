"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Copy,
  Download,
  Key,
  Lock,
  Trash2,
  Users,
} from "lucide-react";

import { toast } from "sonner";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn, truncateMiddle } from "@/lib/utils";
import {
  actionLabels,
  categoryLabels,
  categoryOrder,
  categorySectionLabels,
  groupByResource,
  resourceIcons,
  resourceLabels,
} from "@/lib/permission-labels";
import type { PermissionDescriptor, Role } from "@/lib/api-server";
import { asset, bff } from "@/lib/bff";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const key of a) if (!b.has(key)) return false;
  return true;
}

/** Split-View-Neubau von "Rollen & Rechte" nach Bildvorlage (Nutzervorgabe,
 * 2026-08-16 – siehe docs/ROADMAP.md 2b.13 für den vollständigen,
 * mehrsitzungs-übergreifenden Plan): links Rollen-Liste (URL-getrieben per
 * `?role=`, analoges Muster zu `navigation-explorer.tsx`s `?menu=`), rechts
 * ein Detail-Panel, in dem Beschreibung, Dashboard-Zugriff und Rechte-
 * Checkboxen EIN gemeinsames Formular mit Dirty-State-Tracking bilden
 * (Zurücksetzen/Speichern). Der Rollenname selbst ist reine Anzeige (kein
 * Inline-Rename) – Anlegen läuft weiterhin über `RoleFormDialog`.
 *
 * Zeigt nur die tatsächlich im Backend-Katalog vorhandenen Ressourcen.
 * Formulare/Systemnachrichten/Websites bewusst nicht (Nutzervorgabe,
 * 2026-08-16: "kommt später", siehe Roadmap-Eintrag). */
export function RolesExplorer({
  roles,
  selectedRoleId,
  permissionsCatalog,
  viewerIsPivot,
}: {
  roles: Role[];
  selectedRoleId: string | null;
  permissionsCatalog: PermissionDescriptor[];
  viewerIsPivot: boolean;
}) {
  const router = useRouter();
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const totalCatalog = permissionsCatalog.length;

  const [activeCategory, setActiveCategory] = useState<
    "all" | PermissionDescriptor["category"]
  >("all");
  const [onlyGranted, setOnlyGranted] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [roleUsers, setRoleUsers] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  async function openUsersDialog() {
    if (!selectedRole) return;
    setUsersOpen(true);
    setLoadingUsers(true);
    try {
      const res = await fetch(
        bff(`/api/users?roleId=${selectedRole.id}&pageSize=100`),
      );
      const data = await res.json().catch(() => null);
      const items = Array.isArray(data?.items) ? data.items : [];
      setRoleUsers(
        items.map(
          (u: {
            id: string;
            firstName: string | null;
            lastName: string;
            email: string;
          }) => ({
            id: u.id,
            name: [u.firstName, u.lastName].filter(Boolean).join(" "),
            email: u.email,
          }),
        ),
      );
    } finally {
      setLoadingUsers(false);
    }
  }
  const [isSaving, setIsSaving] = useState(false);

  const [description, setDescription] = useState(
    selectedRole?.description ?? "",
  );
  const [canAccessDashboard, setCanAccessDashboard] = useState(
    selectedRole?.canAccessDashboard ?? true,
  );
  const [permissions, setPermissions] = useState<Set<string>>(
    new Set(selectedRole?.permissions ?? []),
  );

  // Render-Zeit-Sync statt Effekt (gleiches Muster wie `syncedPathname` in
  // app-sidebar.tsx): beim Rollenwechsel den lokalen Formular-Zustand aus
  // der neu ausgewählten Rolle neu befüllen.
  const [syncedRoleId, setSyncedRoleId] = useState(selectedRoleId);
  if (selectedRoleId !== syncedRoleId) {
    setSyncedRoleId(selectedRoleId);
    setDescription(selectedRole?.description ?? "");
    setCanAccessDashboard(selectedRole?.canAccessDashboard ?? true);
    setPermissions(new Set(selectedRole?.permissions ?? []));
  }

  // Pivot ist die neue, höchste Rolle (Nutzervorgabe, 2026-08-21: "kann
  // alles") und genauso schreibgeschützt wie Administrator zuvor – gleicher
  // Grund, gleiche Behandlung.
  const isAdministrator =
    selectedRole?.name === "Administrator" || selectedRole?.name === "Pivot";
  const isDirty =
    selectedRole !== null &&
    (description !== (selectedRole.description ?? "") ||
      canAccessDashboard !== selectedRole.canAccessDashboard ||
      !setsEqual(permissions, new Set(selectedRole.permissions)));

  function resetForm() {
    if (!selectedRole) return;
    setDescription(selectedRole.description ?? "");
    setCanAccessDashboard(selectedRole.canAccessDashboard);
    setPermissions(new Set(selectedRole.permissions));
  }

  function togglePermission(key: string, checked: boolean) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleResourceAll(keys: string[], allSelected: boolean) {
    setPermissions((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      const res = await fetch(bff(`/api/roles/${selectedRole.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          canAccessDashboard,
          permissions: [...permissions],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message ?? "Rolle konnte nicht gespeichert werden.");
        return;
      }
      toastEdited(`„${selectedRole.name}“ wurde gespeichert.`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  // Sicherheits-/Korrektheits-Befund, 2026-08-25: prüfte `res.ok` bisher gar
  // nicht - ein fehlgeschlagenes Löschen (z.B. weil die Rolle noch
  // zugewiesen ist) zeigte trotzdem "erfolgreich gelöscht" an.
  async function handleDelete() {
    if (!selectedRole) return;
    const res = await fetch(bff(`/api/roles/${selectedRole.id}`), {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Rolle konnte nicht gelöscht werden.");
      return;
    }
    toastDeleted(`„${selectedRole.name}“ wurde gelöscht.`);
    router.push("/dashboard/roles");
  }

  async function handleDuplicate() {
    if (!selectedRole) return;
    const res = await fetch(bff("/api/roles"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${selectedRole.name} (Kopie)`,
        description: selectedRole.description ?? "",
        canAccessDashboard: selectedRole.canAccessDashboard,
        permissions: selectedRole.permissions,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Rolle konnte nicht dupliziert werden.");
      return;
    }
    const created = (await res.json()) as Role;
    toastEdited(`„${created.name}“ wurde als Kopie angelegt.`);
    router.push(`/dashboard/roles?role=${created.id}`);
  }

  const writeRightsCount = [...permissions].filter(
    (key) => !key.endsWith(":read"),
  ).length;

  const visibleCatalog = permissionsCatalog.filter((p) => {
    if (activeCategory !== "all" && p.category !== activeCategory) return false;
    return true;
  });
  const resourceGroups = groupByResource(visibleCatalog).filter(([, perms]) => {
    if (!onlyGranted) return true;
    return perms.some((p) => permissions.has(p.key));
  });

  const categoryCounts = {
    all: totalCatalog,
    core: permissionsCatalog.filter((p) => p.category === "core").length,
    extensions: permissionsCatalog.filter((p) => p.category === "extensions")
      .length,
    administration: permissionsCatalog.filter(
      (p) => p.category === "administration",
    ).length,
    system: permissionsCatalog.filter((p) => p.category === "system").length,
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="overflow-hidden rounded-[10px] bg-card shadow-sm lg:w-72 lg:shrink-0 lg:self-start">
        <p className="border-b border-border py-5 pr-4 pl-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Rollen · {roles.length}
        </p>
        <div className="flex flex-col divide-y divide-border">
          {roles.map((role) => {
            const active = role.id === selectedRoleId;
            const isPivotRole = role.name === "Pivot";
            const isAdmin = role.name === "Administrator" || isPivotRole;
            const rightsLabel =
              role.permissions.length === totalCatalog
                ? "alle Rechte"
                : `${role.permissions.length} Rechte`;
            return (
              <Link
                key={role.id}
                href={`/dashboard/roles?role=${role.id}`}
                className={cn(
                  "flex flex-col gap-0.5 border-l-4 px-4 py-5 text-sm transition-colors",
                  active
                    ? "border-l-primary bg-primary/15"
                    : "border-l-transparent hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  {isPivotRole ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset("/brand/logo-collapsed.png")}
                      alt=""
                      className="pivot-logo size-3.5 shrink-0 object-contain"
                    />
                  ) : (
                    isAdmin && (
                      <Lock className="size-3.5 text-muted-foreground" />
                    )
                  )}
                  {role.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {role.userCount} {role.userCount === 1 ? "Nutzer" : "Nutzer"}{" "}
                  · {rightsLabel}
                  {!role.canAccessDashboard && (
                    <span className="text-amber-600 dark:text-amber-500">
                      {" "}
                      · kein Login
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
        {selectedRole && (
          <div className="border-t border-border">
            <button
              type="button"
              onClick={handleDuplicate}
              className="flex w-full items-center gap-2 border-l-4 border-l-transparent px-4 py-5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Copy className="size-4" />
              Rolle duplizieren
            </button>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {!selectedRole ? (
          <div className="rounded-[10px] bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Wähle links eine Rolle aus.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-5 rounded-[10px] bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {selectedRole.name === "Pivot" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset("/brand/logo-collapsed.png")}
                      alt=""
                      className="pivot-logo size-5 shrink-0 object-contain"
                    />
                  )}
                  <h2 className="text-xl font-semibold">{selectedRole.name}</h2>
                  {isAdministrator ? (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="size-3" />
                      Geschützt
                    </Badge>
                  ) : (
                    <Badge className="badge--green border-0">bearbeitbar</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!selectedRole.isSystem && selectedRole.userCount === 0 && (
                    <Button
                      type="button"
                      variant="destructive"
                      className="py-1.5"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 />
                      Löschen
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border py-1.5"
                    disabled={!isDirty || isAdministrator}
                    onClick={resetForm}
                  >
                    Zurücksetzen
                  </Button>
                  <Button
                    type="button"
                    className="py-1.5"
                    disabled={!isDirty || isAdministrator || isSaving}
                    onClick={handleSave}
                  >
                    {isSaving ? "Speichert…" : "Rechte speichern"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Beschreibung der Rolle
                </Label>
                <Textarea
                  rows={2}
                  value={description}
                  disabled={isAdministrator}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-primary bg-primary/10 p-3.5">
                <Checkbox
                  className="size-5 rounded-md"
                  checked={canAccessDashboard}
                  disabled={isAdministrator}
                  onCheckedChange={(checked) =>
                    setCanAccessDashboard(checked === true)
                  }
                />
                <span className="text-sm">
                  <span className="font-medium">Zugriff auf das Backend</span>{" "}
                  <span className="text-muted-foreground">
                    Darf sich am Admin anmelden — die Rechte unten greifen dann.
                  </span>
                </span>
              </label>

              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex items-center justify-between text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <span>Umfang</span>
                  <span className="text-sm font-semibold text-foreground normal-case">
                    {permissions.size} von {totalCatalog} Rechten
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{
                      width: `${totalCatalog > 0 ? (permissions.size / totalCatalog) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Key className="size-3.5" />
                    Schreibrechte{" "}
                    <strong className="text-foreground">
                      {writeRightsCount}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={openUsersDialog}
                    className="flex items-center gap-1.5 hover:text-foreground"
                  >
                    <Users className="size-3.5" />
                    Nutzer{" "}
                    <strong className="text-foreground">
                      {selectedRole.userCount}
                    </strong>
                  </button>
                  <span className="ml-auto">
                    Zuletzt geändert{" "}
                    <strong className="text-foreground">
                      {formatDate(selectedRole.updatedAt)}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs
                className="min-w-0"
                value={activeCategory}
                onValueChange={(v) =>
                  setActiveCategory(v as typeof activeCategory)
                }
              >
                <TabsList>
                  <TabsTrigger className="px-2 sm:px-4" value="all">
                    Alle {categoryCounts.all}
                  </TabsTrigger>
                  {categoryOrder.map((cat) => (
                    <TabsTrigger key={cat} className="px-2 sm:px-4" value={cat}>
                      {categoryLabels[cat]} {categoryCounts[cat]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2">
                <Switch
                  id="only-granted"
                  checked={onlyGranted}
                  onCheckedChange={setOnlyGranted}
                />
                <Label htmlFor="only-granted" className="text-sm font-normal">
                  Nur vergebene Rechte
                </Label>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {categoryOrder
                .filter(
                  (cat) => activeCategory === "all" || activeCategory === cat,
                )
                .map((cat) => {
                  const groupsInCat = resourceGroups.filter(
                    ([, perms]) => perms[0]?.category === cat,
                  );
                  if (groupsInCat.length === 0) return null;
                  return (
                    <div key={cat} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        {cat === "system" && (
                          // Pivot-Logo statt Text-Hinweis: markiert, dass
                          // diese Rechte exklusiv der Pivot-Rolle
                          // vorbehalten sind (siehe PERMISSIONS_CATALOG).
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={asset("/brand/logo-collapsed.png")}
                            alt="Pivot"
                            className="pivot-logo size-3.5 shrink-0 object-contain"
                          />
                        )}
                        <p className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          {categorySectionLabels[cat]}
                        </p>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {groupsInCat.map(([resource, perms]) => {
                          const Icon = resourceIcons[resource];
                          const assignedKeys = perms
                            .map((p) => p.key)
                            .filter((key) => permissions.has(key));
                          const allSelected =
                            assignedKeys.length === perms.length;
                          // Nur Pivot darf `settings:*` vergeben
                          // (Nutzervorgabe, 2026-08-21) – bei jeder Rolle
                          // sichtbar, aber für alle außer Pivot deaktiviert,
                          // unabhängig davon, welche Rolle gerade bearbeitet
                          // wird (spiegelt RolesService.
                          // assertMaySetSettingsPermissions serverseitig).
                          const resourceLocked =
                            isAdministrator ||
                            (resource === "settings" && !viewerIsPivot);
                          return (
                            <div
                              key={resource}
                              className="flex flex-col gap-3.5 rounded-2xl bg-card p-5 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  {Icon && (
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                                      <Icon className="size-5" />
                                    </span>
                                  )}
                                  <div>
                                    <p className="text-base font-semibold">
                                      {resourceLabels[resource] ?? resource}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {assignedKeys.length} / {perms.length}{" "}
                                      Rechte
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={resourceLocked}
                                  onClick={() =>
                                    toggleResourceAll(
                                      perms.map((p) => p.key),
                                      allSelected,
                                    )
                                  }
                                  className="shrink-0 rounded-md bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                                >
                                  {allSelected ? "Keine" : "Alle"}
                                </button>
                              </div>
                              <Separator className="bg-border" />
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                {perms.map(({ key, action }) => (
                                  <div
                                    key={key}
                                    className="flex items-center gap-2.5"
                                  >
                                    <Checkbox
                                      id={key}
                                      className="size-5 rounded-md"
                                      checked={permissions.has(key)}
                                      disabled={resourceLocked}
                                      onCheckedChange={(checked) =>
                                        togglePermission(key, checked === true)
                                      }
                                    />
                                    <Label
                                      htmlFor={key}
                                      className="text-sm font-normal"
                                    >
                                      {actionLabels[action] ?? action}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>

      {selectedRole && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`„${truncateMiddle(selectedRole.name)}“ löschen?`}
          description="Diese Aktion kann nicht rückgängig gemacht werden."
          onConfirm={handleDelete}
        />
      )}

      {selectedRole && (
        <Dialog open={usersOpen} onOpenChange={setUsersOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nutzer mit Rolle „{selectedRole.name}“</DialogTitle>
            </DialogHeader>
            {loadingUsers ? (
              <p className="text-sm text-muted-foreground">Lädt…</p>
            ) : roleUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Nutzer mit dieser Rolle.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {roleUsers.map((u) => (
                  <Link
                    key={u.id}
                    href={`/dashboard/users/${u.id}/edit`}
                    className="flex items-center justify-between gap-2 rounded-md px-3 py-2.5 hover:bg-muted"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function RolesExplorerExportButton({ roles }: { roles: Role[] }) {
  function handleExport() {
    const payload = roles.map((role) => ({
      name: role.name,
      description: role.description,
      canAccessDashboard: role.canAccessDashboard,
      permissions: role.permissions,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rollen-und-rechte.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="border-border"
      onClick={handleExport}
    >
      <Download />
      Rechte exportieren
    </Button>
  );
}
