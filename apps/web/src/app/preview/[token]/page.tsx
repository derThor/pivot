import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/rich-text-editor";
import { getContentByPreviewToken } from "@/lib/api-server";
import type { ContentStatus } from "@/lib/api-server";

const statusLabel: Record<ContentStatus, string> = {
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  PUBLISHED: "Veröffentlicht",
  ARCHIVED: "Archiviert",
};

export default async function ContentPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const content = await getContentByPreviewToken(token);

  if (!content) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-2 bg-background p-8 text-center">
        <h1 className="text-xl font-semibold">Vorschau nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          Dieser Link ist ungültig oder abgelaufen.
        </p>
      </div>
    );
  }

  const dataEntries = Object.entries(content.data).filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0,
  ) as [string, string][];

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 bg-background p-8">
      <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
        <Eye className="size-4 shrink-0" />
        Dies ist eine Vorschau – der Inhalt ist möglicherweise noch nicht
        veröffentlicht.
      </div>

      <div className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          {statusLabel[content.status]} · {content.contentType.name}
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">{content.title}</h1>
        {content.excerpt && (
          <p className="text-muted-foreground">{content.excerpt}</p>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {dataEntries.map(([field, value]) => (
          <div key={field} className="flex flex-col gap-1">
            <RichTextEditor editable={false} value={value} />
          </div>
        ))}
      </div>
    </div>
  );
}
