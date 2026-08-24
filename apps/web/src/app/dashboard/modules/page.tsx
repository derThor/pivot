import { PageHeader } from "@/components/page-header";
import { PageContent } from "@/components/page-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Platzhalter (Nutzervorgabe, 2026-08-24: "diese kommen noch. aber das
// sind dann erweiterungen, wie fitnessstudio, Datenschutz usw.") – noch
// kein Datenmodell/Backend dahinter, absichtlich ehrlicher Hinweis statt
// erfundenem Inhalt (gleiche Konvention wie PlaceholderCard in
// settings-form.tsx).
export default function ModulesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Module" />
      <PageContent plain>
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Module</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Noch nicht umgesetzt. Hier entstehen künftig branchenspezifische
              Erweiterungen (z.B. Fitnessstudio, Datenschutz), die einzelnen
              Websites zugewiesen werden können.
            </p>
          </CardContent>
        </Card>
      </PageContent>
    </div>
  );
}
