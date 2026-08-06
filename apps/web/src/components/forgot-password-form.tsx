"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const forgotPasswordSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message: string;
    devLink?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.message ?? "Anfrage fehlgeschlagen.");
        return;
      }

      setResult({ message: body?.message, devLink: body?.resetLinkDevOnly });
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{result.message}</p>
        {result.devLink && (
          <>
            <a
              href={result.devLink}
              className="text-sm break-all text-primary underline"
            >
              {result.devLink}
            </a>
            <p className="text-xs text-muted-foreground">
              (Dieser Link wird nur im Entwicklungsmodus angezeigt.)
            </p>
          </>
        )}
        <Link
          href="/login"
          className="text-center text-sm text-muted-foreground hover:underline"
        >
          Zurück zur Anmeldung
        </Link>
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sendet…" : "Link anfordern"}
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
