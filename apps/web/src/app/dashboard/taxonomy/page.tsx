import { TaxonomyManager } from "@/components/taxonomy-manager";
import { getCategories, getTags } from "@/lib/api-server";

export default async function TaxonomyPage() {
  const [categories, tags] = await Promise.all([
    getCategories(),
    getTags(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Kategorien & Tags
        </h1>
        <p className="text-sm text-muted-foreground">
          Taxonomie zur Einordnung von Inhalten.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TaxonomyManager
          title="Kategorien"
          apiPath="categories"
          items={categories ?? []}
        />
        <TaxonomyManager title="Tags" apiPath="tags" items={tags ?? []} />
      </div>
    </div>
  );
}
