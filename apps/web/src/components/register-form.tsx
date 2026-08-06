"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function RegisterForm({
  passwordPolicy,
}: {
  passwordPolicy: PasswordPolicy;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    pendingActivation?: boolean;
    message?: string;
    verificationLinkDevOnly?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          firstName: z.string().optional(),
          lastName: z.string().min(1, "Nachname ist erforderlich."),
          email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
          password: z
            .string()
            .refine((value) => isPasswordValid(value, passwordPolicy), {
              message: "Passwort erfüllt nicht alle Anforderungen.",
            }),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "Passwörter stimmen nicht überein.",
          path: ["confirmPassword"],
        }),
    [passwordPolicy],
  );

  type RegisterValues = z.infer<typeof schema>;

  const form = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = form.watch("password");

  async function onSubmit(values: RegisterValues) {
    setError(null);
    setResult(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName || undefined,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.message ?? "Registrierung fehlgeschlagen.");
        return;
      }

      if (body?.pendingActivation || body?.verificationLinkDevOnly) {
        setResult({
          pendingActivation: body?.pendingActivation,
          message: body?.message,
          verificationLinkDevOnly: body?.verificationLinkDevOnly,
        });
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-3">
        {result.pendingActivation && (
          <p className="text-sm">
            {result.message ??
              "Konto wurde angelegt und wartet auf Freischaltung durch einen Administrator."}{" "}
            Du kannst dich anmelden, sobald dein Konto freigeschaltet wurde.
          </p>
        )}
        {result.verificationLinkDevOnly && (
          <>
            <p className="text-sm">
              {result.pendingActivation
                ? "Bitte bestätige zusätzlich deine E-Mail-Adresse:"
                : "Konto wurde angelegt. Bitte bestätige deine E-Mail-Adresse:"}
            </p>
            <a
              href={result.verificationLinkDevOnly}
              className="text-sm break-all text-primary underline"
            >
              {result.verificationLinkDevOnly}
            </a>
            <p className="text-xs text-muted-foreground">
              (Dieser Link wird nur im Entwicklungsmodus angezeigt –
              normalerweise würde er per E-Mail versendet.)
            </p>
          </>
        )}
        <Button render={<Link href={result.pendingActivation ? "/login" : "/dashboard"} />}>
          {result.pendingActivation ? "Zum Login" : "Zum Dashboard"}
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
        <div className="grid grid-cols-2 gap-4">
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <PasswordInput {...field} />
              </FormControl>
              <PasswordPolicyChecklist password={password} policy={passwordPolicy} />
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
          {isSubmitting ? "Registrieren…" : "Registrieren"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Bereits ein Konto?{" "}
          <Link href="/login" className="text-foreground hover:underline">
            Anmelden
          </Link>
        </p>
      </form>
    </Form>
  );
}
