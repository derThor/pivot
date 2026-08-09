import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";

/** Ersetzt die frühere feste Beschreibungszeile unter jeder Dashboard-
 * Überschrift durch die Breadcrumb-Leiste (vorher oben im Header, siehe
 * dashboard-header.tsx). Für Seiten mit einem dynamischen Untertitel
 * (z.B. der Titel des gerade bearbeiteten Inhalts) wird `DashboardBreadcrumbs`
 * stattdessen direkt inline verwendet statt dieser Komponente, damit der
 * Untertitel erhalten bleibt. */
export function PageHeader({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <DashboardBreadcrumbs />
    </div>
  );
}
