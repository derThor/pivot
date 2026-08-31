"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Palette,
  Pencil,
  Search as SearchIcon,
  Star,
  Trash2,
} from "lucide-react";

import { toastDeleted, toastEdited } from "@/components/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { SegmentedPicker } from "@/components/segmented-picker";
import { SwitchRow } from "@/components/switch-row";
import { TaxonomyItemDialog } from "@/components/taxonomy-item-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { categoryColor, tagDotColor } from "@/lib/tag-colors";
import { cn, formatName, slugify } from "@/lib/utils";
import type {
  CategoryDetail,
  CategoryListItem,
  CategorySortOrder,
  ContentListResponse,
  ContentStatus,
  Tag,
} from "@/lib/api-server";

const STATUS_PILLS: { label: string; value: ContentStatus | "ALL" }[] = [
  { label: "Alle", value: "ALL" },
  { label: "Live", value: "PUBLISHED" },
  { label: "Entwurf", value: "DRAFT" },
  { label: "Geplant", value: "SCHEDULED" },
];

const STATUS_LABEL: Record<ContentStatus, string> = {
  PUBLISHED: "Live",
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  ARCHIVED: "Archiviert",
};

// Kategorien-Seite, "Farbe" in den Kategorie-Einstellungen (Nutzervorgabe,
// 2026-08-31: "nutze den gleichen color picker wie in einstellungen und
// darstellung") – gleiches Muster wie ACCENT_PRESETS in settings-form.tsx
// (feste Auswahl + freier Farbwähler), eigene Palette statt Wiederverwendung
// der Akzentfarben-Presets, da das eine andere Farbwahl ist.
const CATEGORY_COLOR_PRESETS = [
  { label: "Blau", hex: "#0ea5e9" },
  { label: "Lila", hex: "#a855f7" },
  { label: "Orange", hex: "#f59e0b" },
  { label: "Grün", hex: "#14b8a6" },
  { label: "Rot", hex: "#ef4444" },
  { label: "Grau", hex: "#94a3b8" },
] as const;

const SORT_ORDER_OPTIONS: { label: string; value: CategorySortOrder }[] = [
  { label: "Neueste", value: "NEWEST" },
  { label: "Älteste", value: "OLDEST" },
  { label: "Manuell", value: "MANUAL" },
];

const POSTS_PER_PAGE_OPTIONS = [6, 8, 10, 12, 20] as const;

const STATUS_BADGE_CLASS: Record<ContentStatus, string> = {
  PUBLISHED: "badge--green border-0",
  DRAFT: "badge--slate border-0",
  SCHEDULED: "badge--amber border-0",
  ARCHIVED: "badge--blue border-0",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CategoryExplorer({
  categories,
  categoriesMeta,
  selectedId,
  selectedCategory,
  categoryTags,
  posts,
  allTags,
  currentStatus,
  currentSearch,
  feedUrl,
}: {
  categories: CategoryListItem[];
  categoriesMeta: { page: number; pageCount: number; total: number } | null;
  selectedId: string | null;
  selectedCategory: CategoryDetail | null;
  categoryTags: { id: string; name: string; contentCount: number }[];
  posts: ContentListResponse | null;
  allTags: Tag[];
  currentStatus?: string;
  currentSearch: string;
  feedUrl: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"posts" | "settings">("posts");
  const [searchValue, setSearchValue] = useState(currentSearch);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  // Debounced Live-Suche → aktualisiert die URL, damit Status-Filter/
  // Pagination serverseitig konsistent auf demselben Suchbegriff bleiben.
  useEffect(() => {
    if (searchValue === currentSearch) return;
    const timeout = setTimeout(() => {
      router.push(
        buildUrl({ search: searchValue || undefined, postsPage: undefined }),
      );
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  async function handleDeletePost(id: string) {
    await fetch(`/api/content/${id}`, { method: "DELETE" });
    toastDeleted("Der Beitrag wurde gelöscht.");
    router.refresh();
  }

  async function handleToggleFeatured(id: string) {
    await fetch(`/api/content/${id}/featured`, { method: "POST" });
    router.refresh();
  }

  async function handleAddTag(
    postId: string,
    existingTagIds: string[],
    tagId: string,
  ) {
    await fetch(`/api/content/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: [...existingTagIds, tagId] }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kategorien</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="bg-card"
            render={<Link href="/dashboard/tags" />}
          >
            Tags verwalten
          </Button>
          <TaxonomyItemDialog
            apiPath="categories"
            withDescription
            newLabel="Neue Kategorie"
            entitySingular="Kategorie"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl bg-card shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Kategorien · {categoriesMeta?.total ?? categories.length}
              </span>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {categories.map((category) => {
                const active = category.id === selectedId;
                return (
                  <Link
                    key={category.id}
                    href={buildUrl({
                      category: category.id,
                      status: undefined,
                      search: undefined,
                      postsPage: undefined,
                    })}
                    className={cn(
                      "flex items-start gap-3 border-l-4 px-4 py-4 transition-colors",
                      active
                        ? "border-l-primary bg-primary/15"
                        : "border-l-transparent hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 h-8 w-1 shrink-0 rounded-full",
                        !category.color && categoryColor(category.id),
                      )}
                      style={
                        category.color
                          ? { backgroundColor: category.color }
                          : undefined
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {category.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        /{category.slug}
                      </p>
                    </div>
                    {category.contentCount === 0 ? (
                      <Badge
                        variant="secondary"
                        className="badge--amber border-0"
                      >
                        leer
                      </Badge>
                    ) : (
                      <span className="mt-0.5 text-sm text-muted-foreground">
                        {category.contentCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          {categoriesMeta && categoriesMeta.pageCount > 1 && (
            <PaginationControls
              page={categoriesMeta.page}
              pageCount={categoriesMeta.pageCount}
              buildHref={(p) => buildUrl({ categoryPage: String(p) })}
            />
          )}

          {selectedId && (
            <div className="overflow-hidden rounded-xl bg-card shadow-sm">
              <div className="px-4 py-3">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Tags in dieser Kategorie
                </span>
              </div>
              <div className="flex flex-col gap-1 px-4 pb-4">
                {categoryTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Tags in dieser Kategorie.
                  </p>
                ) : (
                  categoryTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between gap-2 py-1 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            tagDotColor(tag.id),
                          )}
                        />
                        <span className="truncate">{tag.name}</span>
                      </span>
                      <span className="text-muted-foreground">
                        {tag.contentCount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {!selectedCategory ? (
            <div className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-sm">
              Noch keine Kategorie vorhanden.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-1 h-8 w-1.5 shrink-0 rounded-full",
                        !selectedCategory.color &&
                          categoryColor(selectedCategory.id),
                      )}
                      style={
                        selectedCategory.color
                          ? { backgroundColor: selectedCategory.color }
                          : undefined
                      }
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold">
                          {selectedCategory.name}
                        </h2>
                        {selectedCategory.rssEnabled && (
                          <Badge
                            variant="secondary"
                            className="badge--green border-0"
                          >
                            RSS aktiv
                          </Badge>
                        )}
                      </div>
                      {selectedCategory.description && (
                        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                          {selectedCategory.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-6 text-right">
                    <div>
                      <p className="text-2xl font-semibold">
                        {selectedCategory.contentCount}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase">
                        Beiträge
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">
                        {selectedCategory.liveCount}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase">
                        Live
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <Tabs
                    className="w-fit"
                    value={tab}
                    onValueChange={(v) => setTab(v as "posts" | "settings")}
                  >
                    <TabsList>
                      <TabsTrigger value="posts">Beiträge</TabsTrigger>
                      <TabsTrigger value="settings">
                        Kategorie-Einstellungen
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {tab === "settings" && (
                    <Button
                      type="submit"
                      form="category-settings-form"
                      disabled={settingsSubmitting}
                      size="sm"
                      className="h-10"
                    >
                      {settingsSubmitting ? "Speichert…" : "Speichern"}
                    </Button>
                  )}
                </div>
              </div>

              {tab === "settings" ? (
                <CategorySettingsForm
                  key={selectedCategory.id}
                  category={selectedCategory}
                  feedUrl={feedUrl}
                  onSubmittingChange={setSettingsSubmitting}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-card px-4 sm:max-w-xs">
                      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                      <Input
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        placeholder="Beitrag suchen"
                        className="h-auto flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <Tabs
                      className="min-w-0"
                      value={
                        (currentStatus as ContentStatus | undefined) ?? "ALL"
                      }
                      onValueChange={(v) =>
                        router.push(
                          buildUrl({
                            status: v === "ALL" ? undefined : (v as string),
                            postsPage: undefined,
                          }),
                        )
                      }
                    >
                      <TabsList>
                        {STATUS_PILLS.map((pill) => (
                          <TabsTrigger key={pill.value} value={pill.value}>
                            {pill.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="overflow-hidden rounded-xl bg-card shadow-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          <th className="px-4 py-3">Beitrag</th>
                          <th className="px-4 py-3">Autor</th>
                          <th className="px-4 py-3">Datum</th>
                          <th className="px-4 py-3">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(posts?.items.length ?? 0) === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-8 text-center text-muted-foreground"
                            >
                              Keine Beiträge gefunden.
                            </td>
                          </tr>
                        ) : (
                          posts!.items.map((post) => {
                            const attachedTagIds = post.tags.map((t) => t.id);
                            const availableTags = allTags.filter(
                              (t) => !attachedTagIds.includes(t.id),
                            );
                            return (
                              <tr key={post.id} className="align-top">
                                <td className="max-w-xs px-4 py-3">
                                  <Link
                                    href={`/dashboard/content/${post.id}/edit`}
                                    className="truncate font-medium hover:underline"
                                  >
                                    {post.title}
                                  </Link>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <Badge
                                      variant="secondary"
                                      className={
                                        STATUS_BADGE_CLASS[post.status]
                                      }
                                    >
                                      {STATUS_LABEL[post.status]}
                                    </Badge>
                                    {post.isFeatured && (
                                      <Badge
                                        variant="secondary"
                                        className="badge--lime border-0"
                                      >
                                        Aufmacher
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    {post.tags.map((t) => (
                                      <Badge
                                        key={t.id}
                                        variant="secondary"
                                        className="gap-1.5"
                                      >
                                        <span
                                          className={cn(
                                            "size-1.5 rounded-full",
                                            tagDotColor(t.id),
                                          )}
                                        />
                                        {t.name}
                                      </Badge>
                                    ))}
                                    {availableTags.length > 0 && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger
                                          render={
                                            <button
                                              type="button"
                                              className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                                            />
                                          }
                                        >
                                          + Tag
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                          {availableTags.map((t) => (
                                            <DropdownMenuItem
                                              key={t.id}
                                              onClick={() =>
                                                handleAddTag(
                                                  post.id,
                                                  attachedTagIds,
                                                  t.id,
                                                )
                                              }
                                            >
                                              <span
                                                className={cn(
                                                  "size-2 rounded-full",
                                                  tagDotColor(t.id),
                                                )}
                                              />
                                              {t.name}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                  {formatName(post.author)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                  {formatDate(post.updatedAt)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1.5">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-sm"
                                      className={cn(
                                        "border-border",
                                        post.isFeatured &&
                                          "border-primary bg-primary/10 text-primary",
                                      )}
                                      aria-label={
                                        post.isFeatured
                                          ? "Als Aufmacher entfernen"
                                          : "Als Aufmacher markieren"
                                      }
                                      onClick={() =>
                                        handleToggleFeatured(post.id)
                                      }
                                    >
                                      <Star
                                        className={
                                          post.isFeatured
                                            ? "fill-current"
                                            : undefined
                                        }
                                      />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-sm"
                                      className="border-border"
                                      aria-label="Bearbeiten"
                                      render={
                                        <Link
                                          href={`/dashboard/content/${post.id}/edit`}
                                        />
                                      }
                                    >
                                      <Pencil />
                                    </Button>
                                    <ConfirmDeleteDialog
                                      trigger={
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon-sm"
                                          className="border-border"
                                          aria-label="Löschen"
                                        >
                                          <Trash2 />
                                        </Button>
                                      }
                                      title={`„${post.title}“ löschen?`}
                                      description="Der Beitrag wandert in den Papierkorb und kann von dort wiederhergestellt werden."
                                      onConfirm={() =>
                                        handleDeletePost(post.id)
                                      }
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {posts && posts.meta.pageCount > 1 && (
                    <PaginationControls
                      page={posts.meta.page}
                      pageCount={posts.meta.pageCount}
                      buildHref={(p) => buildUrl({ postsPage: String(p) })}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategorySettingsForm({
  category,
  feedUrl,
  onSubmittingChange,
}: {
  category: CategoryDetail;
  feedUrl: string;
  onSubmittingChange: (submitting: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [description, setDescription] = useState(category.description ?? "");
  const [color, setColor] = useState(category.color);
  const [rssEnabled, setRssEnabled] = useState(category.rssEnabled);
  const [archivePublished, setArchivePublished] = useState(
    category.archivePublished,
  );
  const [showFeaturedLarge, setShowFeaturedLarge] = useState(
    category.showFeaturedLarge,
  );
  const [sortOrder, setSortOrder] = useState(category.sortOrder);
  const [postsPerPage, setPostsPerPage] = useState(category.postsPerPage ?? 10);
  const [slugTouched, setSlugTouched] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentColor = color ?? CATEGORY_COLOR_PRESETS[0].hex;
  const isCustomColor = !CATEGORY_COLOR_PRESETS.some(
    (preset) => preset.hex.toLowerCase() === currentColor.toLowerCase(),
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    onSubmittingChange(true);
    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description: description || undefined,
          color,
          rssEnabled,
          archivePublished,
          showFeaturedLarge,
          sortOrder,
          postsPerPage,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Konnte nicht gespeichert werden.");
        return;
      }
      toastEdited();
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      onSubmittingChange(false);
    }
  }

  return (
    <form
      id="category-settings-form"
      onSubmit={handleSubmit}
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"
    >
      <div className="flex flex-col gap-5 rounded-xl bg-card p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold">Kategorie</h3>
          <p className="text-sm text-muted-foreground">
            Name und Pfad wirken sich auf die Navigation aus.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-settings-name" required>
            Name
          </Label>
          <Input
            id="category-settings-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-settings-slug" required>
            Pfad
          </Label>
          <Input
            id="category-settings-slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-settings-description">Beschreibung</Label>
          <Textarea
            id="category-settings-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Farbe</Label>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-4">
            <div className="flex items-center gap-2">
              {CATEGORY_COLOR_PRESETS.map((preset) => {
                const isSelected =
                  currentColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    aria-label={preset.label}
                    onClick={() => setColor(preset.hex)}
                    className={cn(
                      "size-8 shrink-0 rounded-full ring-2 ring-offset-2 transition-all",
                      isSelected ? "ring-foreground" : "ring-transparent",
                    )}
                    style={{ backgroundColor: preset.hex }}
                  />
                );
              })}
              <label
                className={cn(
                  "relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition-all",
                  isCustomColor
                    ? "ring-2 ring-foreground ring-offset-2"
                    : "border border-dashed border-muted-foreground/40 text-muted-foreground",
                )}
                style={
                  isCustomColor ? { backgroundColor: currentColor } : undefined
                }
                title="Eigene Farbe wählen"
              >
                <Palette className="size-4" />
                <input
                  type="color"
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  value={currentColor}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
            </div>
            <span className="ml-auto shrink-0 font-mono text-sm text-muted-foreground">
              {currentColor.toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-xl bg-card p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold">Archiv &amp; Feed</h3>
          <p className="text-sm text-muted-foreground">
            Steuert, wie Beiträge dieser Kategorie später auf der öffentlichen
            Website ausgespielt werden.
          </p>
        </div>
        <SwitchRow
          label="RSS-Feed anbieten"
          description="Veröffentlicht die letzten Beiträge dieser Kategorie als RSS-Feed."
          checked={rssEnabled}
          onCheckedChange={setRssEnabled}
        />
        {rssEnabled && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-settings-feed-url">Feed-Adresse</Label>
            <Input
              id="category-settings-feed-url"
              readOnly
              value={feedUrl}
              className="font-mono text-xs"
            />
          </div>
        )}
        <SwitchRow
          label="Archivseite veröffentlichen"
          description="Zeigt eine Übersichtsseite mit allen Beiträgen dieser Kategorie."
          checked={archivePublished}
          onCheckedChange={setArchivePublished}
        />
        <SwitchRow
          label="Aufmacher groß darstellen"
          description="Als Aufmacher markierte Beiträge werden hervorgehoben angezeigt."
          checked={showFeaturedLarge}
          onCheckedChange={setShowFeaturedLarge}
        />
        <div className="flex flex-col gap-1.5">
          <SegmentedPicker
            label="Sortierung"
            options={SORT_ORDER_OPTIONS}
            value={sortOrder}
            onChange={setSortOrder}
          />
          {sortOrder === "MANUAL" && (
            <p className="text-xs text-muted-foreground">
              Manuelle Reihenfolge ist noch nicht umgesetzt, es wird bis dahin
              nach Neueste sortiert.
            </p>
          )}
        </div>
        <SegmentedPicker
          label="Beiträge pro Seite"
          options={POSTS_PER_PAGE_OPTIONS.map((value) => ({
            label: String(value),
            value,
          }))}
          value={postsPerPage}
          onChange={setPostsPerPage}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive lg:col-span-2">{error}</p>
      )}
    </form>
  );
}
