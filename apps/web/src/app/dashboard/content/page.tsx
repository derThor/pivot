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

type ContentStatus = "published" | "draft" | "scheduled";

const statusLabel: Record<ContentStatus, string> = {
  published: "Veröffentlicht",
  draft: "Entwurf",
  scheduled: "Geplant",
};

const statusVariant: Record<
  ContentStatus,
  "default" | "secondary" | "outline"
> = {
  published: "default",
  draft: "secondary",
  scheduled: "outline",
};

// Platzhalterdaten – wird später durch die API (@strasev/api) ersetzt
const entries: {
  id: string;
  title: string;
  type: string;
  status: ContentStatus;
  updatedAt: string;
}[] = [];

export default function ContentPage() {
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  Noch keine Inhalte vorhanden.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.title}</TableCell>
                  <TableCell>{entry.type}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[entry.status]}>
                      {statusLabel[entry.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{entry.updatedAt}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
