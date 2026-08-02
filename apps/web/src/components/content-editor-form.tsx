"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import type { ContentType, ContentStatus, ContentDetail } from "@/lib/api-server";
import { slugify } from "@/lib/utils";

const statusLabel: Record<ContentStatus, string> = {
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

const metaSchema = z.object({
  contentTypeId: z.string().min(1, "Bitte einen Content-Type wählen."),
  title: z.string().min(1, "Titel ist erforderlich."),
  slug: z
    .string()
    .min(1, "Slug ist erforderlich.")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Nur Kleinbuchstaben, Zahlen und Bindestriche.",
    ),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
});

type MetaValues = z.infer<typeof metaSchema>;

function toDataValues(
  data: Record<string, unknown> | undefined,
): Record<string, string> {
  if (!data) return {};
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? "")]),
  );
}

export function ContentEditorForm({
  contentTypes,
  content,
}: {
  contentTypes: ContentType[];
  content?: ContentDetail;
}) {
  const router = useRouter();
  const isEditing = Boolean(content);
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [dataValues, setDataValues] = useState<Record<string, string>>(
    toDataValues(content?.data),
  );
  const [dataErrors, setDataErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MetaValues>({
    resolver: zodResolver(metaSchema),
    defaultValues: {
      contentTypeId: content?.contentType.id ?? contentTypes[0]?.id ?? "",
      title: content?.title ?? "",
      slug: content?.slug ?? "",
      status: content?.status ?? "DRAFT",
    },
  });

  const selectedType = contentTypes.find(
    (type) => type.id === form.watch("contentTypeId"),
  );

  function handleTypeChange(id: string) {
    form.setValue("contentTypeId", id);
    setDataValues({});
    setDataErrors({});
  }

  function handleTitleChange(value: string) {
    form.setValue("title", value);
    if (!slugTouched) {
      form.setValue("slug", slugify(value));
    }
  }

  async function onSubmit(values: MetaValues) {
    setFormError(null);

    const fields = selectedType?.schema.fields ?? [];
    const nextDataErrors: Record<string, string> = {};
    const data: Record<string, unknown> = {};

    for (const field of fields) {
      const raw = dataValues[field.name]?.trim() ?? "";
      if (field.required && !raw) {
        nextDataErrors[field.name] = "Pflichtfeld";
        continue;
      }
      if (!raw) continue;
      data[field.name] = field.type === "number" ? Number(raw) : raw;
    }

    if (Object.keys(nextDataErrors).length > 0) {
      setDataErrors(nextDataErrors);
      return;
    }
    setDataErrors({});

    setIsSubmitting(true);
    try {
      const url = isEditing ? `/api/content/${content!.id}` : "/api/content";
      const method = isEditing ? "PATCH" : "POST";
      const body = isEditing
        ? { title: values.title, slug: values.slug, status: values.status, data }
        : { ...values, data };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        setFormError(
          errorBody?.message ?? "Inhalt konnte nicht gespeichert werden.",
        );
        return;
      }

      router.push("/dashboard/content");
      router.refresh();
    } catch {
      setFormError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex max-w-2xl flex-col gap-6"
      >
        <FormField
          control={form.control}
          name="contentTypeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content-Type</FormLabel>
              <Select
                value={field.value}
                onValueChange={handleTypeChange}
                disabled={isEditing}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Content-Type wählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {contentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  Der Content-Type kann nachträglich nicht geändert werden.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Titel</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(e) => {
                    setSlugTouched(true);
                    field.onChange(e);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(statusLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedType && selectedType.schema.fields.length > 0 && (
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <p className="text-sm font-medium">
              {selectedType.name} – Felder
            </p>
            {selectedType.schema.fields.map((field) => (
              <div key={field.name} className="flex flex-col gap-2">
                <Label htmlFor={`data-${field.name}`}>
                  {field.name}
                  {field.required && (
                    <span className="text-destructive"> *</span>
                  )}
                </Label>
                {field.type === "richtext" || field.type === "text" ? (
                  <Textarea
                    id={`data-${field.name}`}
                    rows={6}
                    value={dataValues[field.name] ?? ""}
                    onChange={(e) =>
                      setDataValues((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <Input
                    id={`data-${field.name}`}
                    type={field.type === "number" ? "number" : "text"}
                    value={dataValues[field.name] ?? ""}
                    onChange={(e) =>
                      setDataValues((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                  />
                )}
                {field.type === "richtext" && (
                  <p className="text-xs text-muted-foreground">
                    Einfacher Text – Rich-Text-Editor folgt in Phase 2.
                  </p>
                )}
                {dataErrors[field.name] && (
                  <p className="text-sm text-destructive">
                    {dataErrors[field.name]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Speichert…"
              : isEditing
                ? "Änderungen speichern"
                : "Inhalt speichern"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
