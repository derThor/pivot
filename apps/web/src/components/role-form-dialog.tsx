"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";

import { toastCreated, toastEdited } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { PermissionDescriptor, Role } from "@/lib/api-server";
import { actionLabels, categoryLabels, resourceLabels } from "@/lib/permission-labels";

function groupByCategory(catalog: PermissionDescriptor[]) {
  const categories = new Map<PermissionDescriptor["category"], Map<string, PermissionDescriptor[]>>();
  for (const permission of catalog) {
    const resources = categories.get(permission.category) ?? new Map();
    const list = resources.get(permission.resource) ?? [];
    list.push(permission);
    resources.set(permission.resource, list);
    categories.set(permission.category, resources);
  }
  return Array.from(categories.entries()).map(
    ([category, resources]) =>
      [category, Array.from(resources.entries())] as const,
  );
}

const roleSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich."),
  description: z.string().optional(),
  canAccessDashboard: z.boolean(),
  permissions: z.array(z.string()),
});

type RoleValues = z.infer<typeof roleSchema>;

export function RoleFormDialog({
  role,
  permissionsCatalog,
  hideTrigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  role?: Role;
  permissionsCatalog: PermissionDescriptor[];
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = Boolean(role);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RoleValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      canAccessDashboard: role?.canAccessDashboard ?? true,
      permissions: role?.permissions ?? [],
    },
  });

  async function onSubmit(values: RoleValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      const url = isEditing ? `/api/roles/${role!.id}` : "/api/roles";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Rolle konnte nicht gespeichert werden.");
        return;
      }

      setOpen(false);
      if (!isEditing) form.reset();
      if (isEditing) toastEdited(`„${values.name}“ wurde gespeichert.`);
      else toastCreated(`„${values.name}“ wurde angelegt.`);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const formPermissions = form.watch("permissions");

  function togglePermission(key: string, checked: boolean) {
    const current = form.getValues("permissions");
    form.setValue(
      "permissions",
      checked ? [...current, key] : current.filter((p) => p !== key),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setError(null);
        }
      }}
    >
      {!hideTrigger && (
        <DialogTrigger
          render={
            isEditing ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${role!.name} bearbeiten`}
              />
            ) : (
              <Button />
            )
          }
        >
          {isEditing ? (
            <Pencil />
          ) : (
            <>
              <Plus />
              Neue Rolle
            </>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Rolle bearbeiten" : "Neue Rolle"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={role?.isSystem} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="canAccessDashboard"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div className="flex flex-col gap-0.5">
                      <Label>Zugriff auf das Backend-Dashboard</Label>
                      <p className="text-sm text-muted-foreground">
                        Ohne dieses Recht kann sich der Benutzer zwar anmelden,
                        aber `/dashboard` nicht öffnen.
                      </p>
                    </div>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-4 rounded-lg border p-3 max-h-80 overflow-y-auto">
              {groupByCategory(permissionsCatalog).map(([category, resources]) => (
                <div key={category} className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    {categoryLabels[category]}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {resources.map(([resource, permissions]) => (
                      <div key={resource} className="flex flex-col gap-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          {resourceLabels[resource] ?? resource}
                        </p>
                        {permissions.map(({ key, action }) => (
                          <div key={key} className="flex items-center gap-2">
                            <Checkbox
                              id={key}
                              checked={formPermissions.includes(key)}
                              onCheckedChange={(checked) =>
                                togglePermission(key, checked === true)
                              }
                            />
                            <Label htmlFor={key} className="font-normal">
                              {actionLabels[action] ?? action}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-[#D4D4D4]"
                onClick={() => setOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Speichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
