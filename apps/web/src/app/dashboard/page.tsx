import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getContentList, getMediaList, getUsers } from "@/lib/api-server";

export default async function DashboardPage() {
  const [published, drafts, media, users] = await Promise.all([
    getContentList({ status: "PUBLISHED", pageSize: 1 }),
    getContentList({ status: "DRAFT", pageSize: 1 }),
    getMediaList({ pageSize: 1 }),
    getUsers({ pageSize: 1 }),
  ]);

  const stats = [
    {
      label: "Veröffentlichte Inhalte",
      value: published?.meta.total.toString() ?? "–",
    },
    { label: "Entwürfe", value: drafts?.meta.total.toString() ?? "–" },
    { label: "Medien", value: media?.meta.total.toString() ?? "–" },
    { label: "Benutzer", value: users?.meta.total.toString() ?? "–" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Willkommen zurück. Hier ist ein Überblick über dein CMS.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  );
}
