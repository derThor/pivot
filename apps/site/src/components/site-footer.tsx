import Link from "next/link";

import { SiteLogo } from "@/components/site-logo";

import type { SiteLegalLink, SiteNavigation, SiteSettings } from "@/lib/api";

function FooterLink({
  href,
  label,
  openInNewTab,
}: {
  href: string;
  label: string;
  openInNewTab?: boolean;
}) {
  const className =
    "text-[14.5px] text-surface-dark-foreground hover:text-accent";
  if (href.startsWith("http") || openInNewTab) {
    return (
      <a
        href={href}
        className={className}
        {...(openInNewTab && { target: "_blank", rel: "noopener noreferrer" })}
      >
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function Column({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="eyebrow text-surface-dark-muted">{title}</span>
      {children}
    </div>
  );
}

/** Fußbereich der öffentlichen Website nach dem Entwurf des Nutzers
 * ("Pivot Landing", 2026-09-02): dunkler Grund, links Logo und Untertitel,
 * daneben bis zu drei Linkspalten, darunter abgesetzt Copyright und eine
 * freie Zusatzzeile.
 *
 * Die beiden ersten Spalten kommen aus je einer frei gewählten Navigation
 * (Einstellungen → Frontend); ihre Überschrift ist der NAME der
 * Navigation, es gibt also kein zweites Feld dafür. Die dritte Spalte
 * entsteht automatisch aus den vorhandenen Rechtstexten – wer einen
 * erzeugt, will ihn auch verlinkt haben (Nutzerentscheidung, 2026-09-02).
 *
 * Jede Spalte fällt einzeln weg, wenn ihre Quelle leer ist. Der Knopf
 * "Cookie-Einstellungen" aus dem Entwurf fehlt bewusst: einen
 * Cookie-Banner gibt es auf dieser Website (noch) nicht, der Knopf hätte
 * nichts zu öffnen. Der Rechtstext "Cookie-Hinweis" ist als normaler Link
 * in der Rechtliches-Spalte dabei. */
export function SiteFooter({
  site,
  legalLinks,
}: {
  site: SiteSettings;
  legalLinks: SiteLegalLink[];
}) {
  const columns: SiteNavigation[] = [
    site.footerNavigationPrimary,
    site.footerNavigationSecondary,
  ].filter((nav): nav is SiteNavigation => Boolean(nav && nav.items.length));
  const year = new Date().getFullYear();
  // Ohne gepflegten Firmennamen steht der Website-Titel im Copyright –
  // eine Firma zu erfinden wäre schlechter als der Name, den die
  // Installation ohnehin führt.
  const owner = site.companyName?.trim() || site.siteTitle?.trim() || "";

  return (
    <footer className="mt-24 bg-surface-dark text-white">
      <div className="mx-auto grid w-full max-w-[var(--content-width,1180px)] grid-cols-1 gap-10 px-6 pt-16 pb-7 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <SiteLogo variant="dark" siteTitle={site.siteTitle} />
          {site.siteTagline && (
            <p className="mt-4.5 max-w-[300px] text-[15px] leading-relaxed text-surface-dark-muted">
              {site.siteTagline}
            </p>
          )}
        </div>

        {columns.map((nav) => (
          <Column key={nav.id} title={nav.name}>
            {nav.items.map((item) => (
              <FooterLink
                key={item.id}
                href={item.href ?? "/"}
                label={item.label}
                openInNewTab={item.openInNewTab}
              />
            ))}
          </Column>
        ))}

        {legalLinks.length > 0 && (
          <Column title="Rechtliches">
            {legalLinks.map((link) => (
              <FooterLink key={link.key} href={link.href} label={link.label} />
            ))}
          </Column>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[var(--content-width,1180px)] flex-wrap justify-between gap-4 border-t border-white/10 px-6 pt-5 pb-10 sm:px-8">
        <span className="text-[13px] text-surface-dark-muted">
          © {year} {owner}
        </span>
        {site.footerNote && (
          <span className="text-[13px] text-surface-dark-muted">
            {site.footerNote}
          </span>
        )}
      </div>
    </footer>
  );
}
