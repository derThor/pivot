"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
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

export function ResetPasswordForm({
  token,
  passwordPolicy,
}: {
  token: string;
  passwordPolicy: PasswordPolicy;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
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

  type ResetPasswordValues = z.infer<typeof schema>;

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const newPassword = form.watch("newPassword");

  async function onSubmit(values: ResetPasswordValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Zurücksetzen fehlgeschlagen.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.
        </p>
        <Button
          className="w-full"
          onClick={() => {
            router.push("/login");
          }}
        >
          Zur Anmeldung
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
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
              <FormLabel>Passwort bestätigen</FormLabel>
              <FormControl>
                <PasswordInput {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Ändert…" : "Passwort ändern"}
        </Button>
        <Link
          href="/login"
          className="text-center text-sm text-muted-foreground hover:underline"
        >
          Zurück zur Anmeldung
        </Link>
      </form>
    </Form>
  );
}
