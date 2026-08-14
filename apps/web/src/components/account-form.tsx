"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { CurrentUser } from "@/lib/api-server";

const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().min(1, "Nachname ist erforderlich."),
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function AccountForm({
  user,
  allowEmailChange,
  formId,
  onSubmittingChange,
}: {
  user: CurrentUser;
  allowEmailChange: boolean;
  // Für den Speichern-Button außerhalb der weißen Fläche (siehe
  // account-tabs.tsx): das `<form>` bekommt diese `id`, der externe
  // Button referenziert sie über `form={formId}` (natives HTML,
  // funktioniert unabhängig von der DOM-Verschachtelung).
  formId: string;
  onSubmittingChange?: (submitting: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.firstName ?? "",
      lastName: user.lastName,
      email: user.email,
    },
  });

  async function onSubmit(values: ProfileValues) {
    setError(null);
    setSuccess(false);
    onSubmittingChange?.(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName || undefined,
          lastName: values.lastName,
          email: values.email,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Profil konnte nicht gespeichert werden.");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      onSubmittingChange?.(false);
    }
  }

  return (
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Deine Kontodaten.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            id={formId}
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-10"
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
                    <Input
                      type="email"
                      disabled={!allowEmailChange}
                      {...field}
                    />
                  </FormControl>
                  {!allowEmailChange && (
                    <p className="text-xs text-muted-foreground">
                      Ändern der E-Mail-Adresse ist derzeit deaktiviert.
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <p className="text-sm text-muted-foreground">Gespeichert.</p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
