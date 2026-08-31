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
  }>;
}) {
  const {
    category: categoryParam,
    status,
    search,
    postsPage,
  } = await searchParams;

  const [categories, settings, allTags] = await Promise.all([
    getCategories({ page: 1, pageSize: 100 }),
    getPublicSettings(),
    getAllTags(),
  ]);

  const categoryList = categories?.items ?? [];
  const selectedId = categoryParam ?? categoryList[0]?.id ?? null;

  if (categoryParam && !categoryList.some((c) => c.id === categoryParam)) {
    notFound();
  }

  const selectedCategory = selectedId ? await getCategory(selectedId) : null;

  const [categoryTags, posts] = selectedId
    ? await Promise.all([
        getCategoryTags(selectedId),
        getContentList({
          categoryId: selectedId,
          status: status as ContentStatus | undefined,
          search,
          sortOrder: selectedCategory?.sortOrder,
          page: Number(postsPage) || 1,
          pageSize:
            selectedCategory?.postsPerPage ?? settings?.defaultPageSize ?? 10,
        }),
      ])
    : [null, null];

  return (
    <CategoryExplorer
      categories={categoryList}
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
