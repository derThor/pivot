import Link from "next/link";
import { cn } from "@pivot/blocks";
import type {
  ModuleType,
  PublicArchivePost,
  PublicCategoryArchive,
  PublicContentSummary,
  SiteSettings,
} from "@/lib/api";
import type { GlobalModule } from "@pivot/blocks";
import { ContentBlocks } from "@/components/content-blocks";
import { resolveImageSrc } from "@pivot/blocks";
import { pageSpacingStyle } from "@/lib/page-spacing";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" });

function formatDate(value: string | null): string | null {
  return value ? dateFormatter.format(new Date(value)) : null;
}

function postHref(categorySlug: string, post: PublicContentSummary): string {
  return `/${categorySlug}/${post.slug}`;
}

/** Kompakte Zeile: nur Titel + Datum (Nutzervorgabe, 2026-09-02). */
function ListRow({
  categorySlug,
  post,
}: {
  categorySlug: string;
  post: PublicContentSummary;
}) {
  const date = formatDate(post.publishedAt);
  return (
    <li className="border-b border-border last:border-0">
      <Link
        href={postHref(categorySlug, post)}
        className="flex flex-col gap-1 py-4 transition-colors hover:text-accent-foreground"
      >
        <span className="text-lg font-medium">{post.title}</span>
        {date && (
          <time
            dateTime={post.publishedAt ?? undefined}
            className="text-sm text-muted-foreground"
          >
            {date}
          </time>
        )}
      </Link>
    </li>
  );
}

/** Karte mit Titelbild, Titel, Datum und Anreißtext. Das Bild ist das
 * OG-Bild aus dem SEO-Tab des Beitrags – das einzige echte "Bild dieser
 * Seite" im Datenmodell. Fehlt es, entfällt der Bildbereich ersatzlos,
 * statt einen grauen Platzhalter zu zeigen. */
/** Slug des Bausteins, der den Anriss beendet. Als Konstante, weil zwei
 * Stellen ihn kennen müssen: das Archiv schneidet dort ab, die
 * Beitragsseite blendet ihn aus. */
const READ_MORE_SLUG = "read-more";

/** Ein Beitrag in der Blog-Darstellung: vollständig ausgeschrieben,
 * höchstens gekürzt bis zur „Weiterlesen"-Marke (Nutzervorgabe,
 * 2026-09-03).
 *
 * Gezeigt werden Datum und Überschrift, darunter der Inhalt aus dem
 * Seiten-Designer. Steht irgendwo ein „Weiterlesen"-Baustein, endet der
 * Text dort und es folgt der Link auf den ganzen Beitrag – sonst steht der
 * Beitrag komplett in der Übersicht. */
function BlogPost({
  categorySlug,
  post,
  moduleTypes,
  globalModules,
}: {
  categorySlug: string;
  post: PublicArchivePost;
  moduleTypes: ModuleType[];
  globalModules: GlobalModule[];
}) {
  const date = formatDate(post.publishedAt);
  const readMoreTypeId = moduleTypes.find((t) => t.slug === READ_MORE_SLUG)?.id;

  // Bausteine bis zur Marke. Ohne Marke bleibt alles stehen – "komplett
  // darstellen" ist der Normalfall, das Kürzen die Ausnahme.
  const blocks = Array.isArray(post.data?.blocks) ? post.data.blocks : [];
  const cutIndex = readMoreTypeId
    ? blocks.findIndex(
        (b) =>
          typeof b === "object" &&
          b !== null &&
          (b as { moduleTypeId?: string }).moduleTypeId === readMoreTypeId,
      )
    : -1;
  const isTruncated = cutIndex >= 0;
  const visibleBlocks = isTruncated ? blocks.slice(0, cutIndex) : blocks;

  return (
    <article className="flex flex-col gap-4 border-b border-border pb-10 last:border-0">
      <header className="flex flex-col gap-1">
        {date && (
          <time
            dateTime={post.publishedAt ?? undefined}
            className="text-sm text-muted-foreground"
          >
            {date}
          </time>
        )}
        <h2 className="text-2xl font-semibold tracking-tight">
          <Link
            href={postHref(categorySlug, post)}
            className="hover:text-accent-link"
          >
            {post.title}
          </Link>
        </h2>
      </header>

      {post.contentType && (
        <ContentBlocks
          data={{ ...post.data, blocks: visibleBlocks }}
          moduleTypes={moduleTypes}
          globalModules={globalModules}
        />
      )}

      {isTruncated && (
        <Link
          href={postHref(categorySlug, post)}
          className="text-sm font-medium underline underline-offset-4 hover:no-underline"
        >
          Weiterlesen
        </Link>
      )}
    </article>
  );
}

function BlockCard({
  categorySlug,
  categoryColor,
  post,
  large = false,
}: {
  categorySlug: string;
  /** Farbe der Kategorie – füllt die Bildfläche, wenn ein Beitrag kein
   * Titelbild hat. */
  categoryColor: string | null;
  post: PublicContentSummary;
  large?: boolean;
}) {
  const date = formatDate(post.publishedAt);
  return (
    <article className="overflow-hidden rounded-xl border border-border transition-colors hover:border-foreground/25">
      <Link href={postHref(categorySlug, post)} className="flex flex-col">
        {post.ogImageUrl ? (
          // Bewusst <img> statt next/image: die Bilder liegen unter der
          // API-Origin (siehe `resolveImageSrc`), die je Installation anders
          // lautet – next/image müsste dafür pro Deployment eine erlaubte
          // Remote-Domain konfiguriert bekommen.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageSrc(post.ogImageUrl)}
            alt=""
            className={
              large
                ? "aspect-[2/1] w-full object-cover"
                : "aspect-[16/9] w-full object-cover"
            }
          />
        ) : (
          // Ohne Titelbild bleibt sonst eine Karte übrig, die nur aus einem
          // Rahmen mit zwei Textzeilen besteht – sie wirkt kaputt, obwohl
          // sie es nicht ist (Nutzer-Bugreport, 2026-09-03: "Block
          // funktioniert nicht"). Statt ein Bild zu erfinden bekommt sie
          // eine ruhige Farbfläche in der Farbe der Kategorie; ohne
          // gepflegte Farbe die neutrale Abstufung des Templates.
          <div
            aria-hidden
            style={
              categoryColor
                ? { backgroundColor: categoryColor, opacity: 0.18 }
                : undefined
            }
            className={cn(
              "w-full",
              !categoryColor && "bg-muted",
              large ? "aspect-[2/1]" : "aspect-[16/9]",
            )}
          />
        )}
        <div className="flex flex-col gap-2 p-5">
          <h2
            className={
              large
                ? "text-2xl font-semibold tracking-tight"
                : "text-xl font-semibold tracking-tight"
            }
          >
            {post.title}
          </h2>
          {date && (
            <time
              dateTime={post.publishedAt ?? undefined}
              className="text-sm text-muted-foreground"
            >
              {date}
            </time>
          )}
          {post.excerpt && (
            <p className="text-muted-foreground">{post.excerpt}</p>
          )}
        </div>
      </Link>
    </article>
  );
}

/** Blättern über `Category.postsPerPage` – gilt für BEIDE Darstellungen
 * (Nutzerentscheidung, 2026-09-02). Bewusst echte Links statt Buttons:
 * die Seiten sind einzeln aufrufbar und indexierbar. */
function Pagination({
  basePath,
  page,
  pageCount,
}: {
  basePath: string;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  const href = (p: number) => (p === 1 ? basePath : `${basePath}?page=${p}`);
  return (
    <nav
      aria-label="Seitennummerierung"
      className="flex flex-wrap items-center gap-2 pt-4"
    >
      {page > 1 && (
        <Link
          href={href(page - 1)}
          rel="prev"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Zurück
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? "page" : undefined}
          className={
            p === page
              ? "rounded-md border border-foreground px-3 py-1.5 text-sm font-semibold"
              : "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          }
        >
          {p}
        </Link>
      ))}
      {page < pageCount && (
        <Link
          href={href(page + 1)}
          rel="next"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Weiter
        </Link>
      )}
    </nav>
  );
}

/** Kategorie-Archiv: alle veröffentlichten Beiträge einer Kategorie
 * untereinander, wahlweise kompakt als Liste oder als Karten mit Titelbild
 * (`NavigationItem.categoryLayout`). Beide Varianten blättern.
 *
 * Die optionale Aufmacher-Kachel oben (`Category.showFeaturedLarge`) wird
 * nur auf Seite 1 gezeigt – auf Folgeseiten wäre sie eine Dublette. */
export function CategoryArchive({
  archive,
  site,
  moduleTypes,
  globalModules,
}: {
  archive: PublicCategoryArchive;
  site: SiteSettings;
  /** Fuer die Blog-Darstellung: die Bausteine der Beitraege werden hier
   * ausgeschrieben, dafuer braucht es Typen und globale Module wie auf
   * einer normalen Seite. */
  moduleTypes: ModuleType[];
  globalModules: GlobalModule[];
}) {
  const { category, layout, featured, items, meta, spacing } = archive;
  // Am Menüpunkt gesetzter Abstand oben/unten (Nutzervorgabe,
  // 2026-09-03) – gilt für beide Darstellungen gleichermaßen.
  const spacingStyle = pageSpacingStyle(spacing);
  const basePath = `/${category.slug}`;
  const isBlog = layout === "BLOCKS";

  // Im Blog-Modus stehen NUR die Beiträge da (Nutzervorgabe, 2026-09-03:
  // "nur die Beiträge!"): kein Kategorie-Kopf, keine Aufmacher-Karte, kein
  // RSS-Hinweis. Die Seite soll wie ein Blog wirken, nicht wie ein Archiv
  // mit Beiträgen darunter – der Kategoriename steht ohnehin im
  // Browser-Tab und im Menü, über das man hergekommen ist.
  //
  // Auch die Aufmacher-Sonderbehandlung entfällt: alle Beiträge laufen
  // fortlaufend untereinander, in der Reihenfolge der Kategorie.
  const showFeatured = !isBlog && featured !== null && meta.page === 1;
  const rest = showFeatured
    ? items.filter((item) => item.id !== featured.id)
    : items;

  if (isBlog) {
    return (
      <div
        className={cn("flex flex-col gap-10", spacingStyle && "page-spacing")}
        style={spacingStyle}
      >
        {items.length === 0 ? (
          <p className="text-muted-foreground">
            In dieser Kategorie sind noch keine Beiträge veröffentlicht.
          </p>
        ) : (
          items.map((post) => (
            <BlogPost
              key={post.id}
              categorySlug={category.slug}
              post={post}
              moduleTypes={moduleTypes}
              globalModules={globalModules}
            />
          ))
        )}

        <Pagination
          basePath={basePath}
          page={meta.page}
          pageCount={meta.pageCount}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col gap-8", spacingStyle && "page-spacing")}
      style={spacingStyle}
    >
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="text-lg text-muted-foreground">
            {category.description}
          </p>
        )}
      </header>

      {showFeatured && (
        <BlockCard
          categorySlug={category.slug}
          categoryColor={category.color}
          post={featured}
          large
        />
      )}

      {rest.length === 0 && !showFeatured ? (
        <p className="text-muted-foreground">
          In dieser Kategorie sind noch keine Beiträge veröffentlicht.
        </p>
      ) : layout === "LIST" ? (
        <ul className="flex flex-col">
          {rest.map((post) => (
            <ListRow key={post.id} categorySlug={category.slug} post={post} />
          ))}
        </ul>
      ) : null}
      <Pagination
        basePath={basePath}
        page={meta.page}
        pageCount={meta.pageCount}
      />

      {/* Sichtbarer Link zusaetzlich zum <link> im <head> (siehe
          generateMetadata der Seite): Feed-Reader finden den Feed ueber
          den Kopf, Menschen ueber diesen Link. Anders als frueher haengt
          er NICHT mehr an publicBaseUrl – der Pfad ist relativ und
          funktioniert damit auch ohne gepflegte Basis-URL. */}
      {category.rssEnabled && (
        <a
          href={`/${category.slug}/feed.xml`}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-accent-link"
        >
          RSS-Feed dieser Kategorie
        </a>
      )}
    </div>
  );
}
