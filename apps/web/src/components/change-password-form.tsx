"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { toastEdited } from "@/components/app-toast";
import { PasswordInput } from "@/components/ui/password-input";
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
import { PasswordPolicyChecklist } from "@/components/password-policy-checklist";
import { isPasswordValid, type PasswordPolicy } from "@/lib/password-policy";

export function ChangePasswordForm({
  passwordPolicy,
  formId,
  onSubmittingChange,
}: {
  passwordPolicy: PasswordPolicy;
  // Für den Button außerhalb der weißen Fläche (siehe account-tabs.tsx).
  formId: string;
  onSubmittingChange?: (submitting: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, "Erforderlich."),
          newPassword: z
            .string()
            .refine((value) => isPasswordValid(value, passwordPolicy), {
              message: "Passwort erfüllt nicht alle Anforderungen.",
            }),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: "Passwörter stimmen nicht überein.",
          path: ["confirmPassword"],
        }),
    [passwordPolicy],
  );

  type ChangePasswordValues = z.infer<typeof schema>;

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = form.watch("newPassword");

  async function onSubmit(values: ChangePasswordValues) {
    setError(null);
    onSubmittingChange?.(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Passwort konnte nicht geändert werden.");
        return;
      }

      // Passwort-Änderung widerruft alle Sessions (auch die aktuelle) –
      // Nutzer muss sich neu anmelden.
      await fetch("/api/auth/logout", { method: "POST" });
      toastEdited("Dein Passwort wurde geändert.");
      router.push("/login?passwordChanged=1");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      onSubmittingChange?.(false);
    }
  }

  return (
    <Card className="rounded-xl border-[#E5E5E5] shadow-sm">
      <CardHeader>
        <CardTitle>Passwort ändern</CardTitle>
        <CardDescription>
          Nach dem Ändern wirst du auf allen Geräten abgemeldet und musst dich
          neu anmelden.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            id={formId}
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-10"
          >
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aktuelles Passwort</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Neues Passwort</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <PasswordPolicyChecklist
                    password={newPassword}
                    policy={passwordPolicy}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Neues Passwort bestätigen</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
