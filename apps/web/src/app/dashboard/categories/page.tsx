import { notFound } from "next/navigation";

import { CategoryExplorer } from "@/components/category-explorer";
import {
  getAllTags,
  getCategories,
  getCategory,
  getCategoryFeedUrl,
  getCategoryTags,
  getContentList,
  getPublicSettings,
} from "@/lib/api-server";
import type { ContentStatus } from "@/lib/api-server";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    status?: string;
    search?: string;
    postsPage?: string;
    categoryPage?: string;
  }>;
}) {
  const {
    category: categoryParam,
    status,
    search,
    postsPage,
    categoryPage,
  } = await searchParams;

  const settings = await getPublicSettings();
  const [categories, allTags] = await Promise.all([
    getCategories({
      page: Number(categoryPage) || 1,
      pageSize: settings?.defaultPageSize ?? 10,
    }),
    getAllTags(),
  ]);

  const categoryList = categories?.items ?? [];
  const selectedId = categoryParam ?? categoryList[0]?.id ?? null;

  // `categoryList` ist jetzt nur die aktuell angezeigte Seite der Sidebar-
  // Liste (Pagination, Nutzervorgabe 2026-08-31) – ein per Link/Lesezeichen
  // ausgewählter Eintrag kann also auf einer ANDEREN Seite liegen. 404 gilt
  // deshalb nur, wenn `getCategory()` selbst die Kategorie nicht findet,
  // nicht mehr anhand der Mitgliedschaft in `categoryList`.
  const selectedCategory = selectedId ? await getCategory(selectedId) : null;
  if (categoryParam && !selectedCategory) {
    notFound();
  }

  const [categoryTags, posts] = selectedId
    ? await Promise.all([
        getCategoryTags(selectedId),
        getContentList({
          categoryId: selectedId,
          status: status as ContentStatus | undefined,
          search,
          sortOrder: selectedCategory?.sortOrder,
          page: Number(postsPage) || 1,
          // Nutzervorgabe, 2026-08-31 (Korrektur): die Admin-Beiträge-Tabelle
          // folgt IMMER der globalen Seitengröße aus Einstellungen →
          // Darstellung, wie jede andere Listenseite auch – NICHT dem
          // Kategorie-eigenen `postsPerPage` ("Beiträge pro Seite" ist für
          // die künftige öffentliche Übersichtsseite gedacht, siehe
          // knowledge-base/frontend/taxonomy-management.md, und darf die
          // Admin-Ansicht nicht überschreiben).
          pageSize: settings?.defaultPageSize ?? 10,
        }),
      ])
    : [null, null];

  return (
    <CategoryExplorer
      categories={categoryList}
      categoriesMeta={categories?.meta ?? null}
      selectedId={selectedId}
      selectedCategory={selectedCategory}
      categoryTags={categoryTags ?? []}
      posts={posts}
      allTags={allTags ?? []}
      currentStatus={status}
      currentSearch={search ?? ""}
      feedUrl={selectedId ? getCategoryFeedUrl(selectedId) : ""}
    />
  );
}
