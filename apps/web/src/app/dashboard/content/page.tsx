import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { getContentList, type ContentStatus } from "@/lib/api-server";
import { ContentRowActions } from "@/components/content-row-actions";

const statusLabel: Record<ContentStatus, string> = {
  PUBLISHED: "Veröffentlicht",
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  ARCHIVED: "Archiviert",
};

const statusVariant: Record<
  ContentStatus,
  "default" | "secondary" | "outline"
> = {
  PUBLISHED: "default",
  DRAFT: "secondary",
  SCHEDULED: "outline",
  ARCHIVED: "outline",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function ContentPage() {
  const content = await getContentList({ pageSize: 50 });
  const entries = content?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inhalte</h1>
          <p className="text-sm text-muted-foreground">
            Alle Content-Einträge deines CMS an einem Ort.
          </p>
        </div>
        <Button render={<Link href="/dashboard/content/new" />}>
          <Plus />
          Neuer Inhalt
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Zuletzt bearbeitet</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  Noch keine Inhalte vorhanden.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.title}</TableCell>
                  <TableCell>{entry.contentType.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[entry.status]}>
                      {statusLabel[entry.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {dateFormatter.format(new Date(entry.updatedAt))}
                  </TableCell>
                  <TableCell>
                    <ContentRowActions id={entry.id} title={entry.title} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
