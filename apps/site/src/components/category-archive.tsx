import Link from "next/link";
import type {
  PublicCategoryArchive,
  PublicContentSummary,
  SiteSettings,
} from "@/lib/api";
import { resolveImageSrc } from "@pivot/blocks";

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
function BlockCard({
  categorySlug,
  post,
  large = false,
}: {
  categorySlug: string;
  post: PublicContentSummary;
  large?: boolean;
}) {
  const date = formatDate(post.publishedAt);
  return (
    <article className="overflow-hidden rounded-xl border border-border">
      <Link href={postHref(categorySlug, post)} className="flex flex-col">
        {post.ogImageUrl && (
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
}: {
  archive: PublicCategoryArchive;
  site: SiteSettings;
}) {
  const { category, layout, featured, items, meta } = archive;
  const basePath = `/${category.slug}`;
  const showFeatured = featured !== null && meta.page === 1;
  const rest = showFeatured
    ? items.filter((item) => item.id !== featured.id)
    : items;

  return (
    <div className="flex flex-col gap-8">
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
        <BlockCard categorySlug={category.slug} post={featured} large />
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
      ) : (
        <div className="flex flex-col gap-6">
          {rest.map((post) => (
            <BlockCard key={post.id} categorySlug={category.slug} post={post} />
          ))}
        </div>
      )}

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
