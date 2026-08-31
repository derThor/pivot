"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";

import { toastCreated } from "@/components/app-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/lib/api-server";
import { bff } from "@/lib/bff";

export function CreateUserDialog({
  roles,
  triggerLabel = "Neuer Benutzer",
}: {
  roles: Role[];
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultRoleId =
    roles.find((r) => r.isDefault)?.id ?? roles[0]?.id ?? "";

  const createUserSchema = useMemo(
    () =>
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().min(1, "Nachname ist erforderlich."),
        email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
        roleId: z.string().min(1, "Bitte eine Rolle wählen."),
      }),
    [],
  );

  type CreateUserValues = z.infer<typeof createUserSchema>;

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      roleId: defaultRoleId,
    },
  });

  async function onSubmit(values: CreateUserValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(bff("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName || undefined,
          lastName: values.lastName,
          email: values.email,
          roleIds: [values.roleId],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Benutzer konnte nicht angelegt werden.");
        return;
      }

      setOpen(false);
      toastCreated(
        `„${values.firstName ? `${values.firstName} ` : ""}${values.lastName}“ wurde angelegt. Eine E-Mail zum Festlegen des Passworts wurde an ${values.email} gesendet.`,
      );
      form.reset();
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
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
      <DialogTrigger render={<Button />}>
        <Plus />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Neuer Benutzer</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vorname</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nachname</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolle</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    items={Object.fromEntries(
                      roles.map((role) => [role.id, role.name]),
                    )}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-border"
                onClick={() => setOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Speichert…" : "Benutzer anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
