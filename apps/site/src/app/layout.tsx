import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { resolveImageSrc } from "@pivot/blocks";
import { getSiteSettings } from "@/lib/api";
import "./globals.css";

// Siehe REVALIDATE_SECONDS in lib/api.ts – hier bewusst als Literal, weil
// Next.js diesen Segment-Wert statisch auswerten muss.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  const title = site.siteTitle?.trim();
  const description =
    site.defaultSeoDescription?.trim() || site.siteTagline?.trim() || undefined;
  const ogImage = site.defaultOgImageUrl
    ? resolveImageSrc(site.defaultOgImageUrl)
    : undefined;

  return {
    // Ohne gepflegten Website-Titel (Einstellungen → Frontend) bleibt das
    // Feld leer, statt einen Namen zu erfinden.
    title: title ? { default: title, template: `%s – ${title}` } : undefined,
    description,
    // metadataBase macht relative canonical-/OG-URLs in den Unterseiten
    // absolut; ohne publicBaseUrl gibt es keine gültige Basis.
    metadataBase: site.publicBaseUrl ? new URL(site.publicBaseUrl) : undefined,
    icons: site.faviconUrl
      ? { icon: resolveImageSrc(site.faviconUrl) }
      : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const site = await getSiteSettings();
  // Akzentfarbe der Installation überschreibt das Theme-Token zur Laufzeit;
  // alle `*-accent`-Utilities lesen dieselbe Variable.
  const themeStyle = site.accentColor
    ? ({ "--color-accent": site.accentColor } as CSSProperties)
    : undefined;

  return (
    <html lang="de" style={themeStyle}>
      <body className="flex min-h-screen flex-col">
        <header className="border-b border-border">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-8">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              {site.siteTitle ?? " "}
            </Link>
            {site.siteTagline && (
              <span className="text-sm text-muted-foreground">
                {site.siteTagline}
              </span>
            )}
          </div>
          {/* Hauptmenü (AppSettings.mainNavigationId → GET
              /public/navigation/:slug) folgt in Schritt 5 des
              Frontend-Plans, zusammen mit RSS-Verlinkung und
              SEO-Feinschliff. */}
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
          {children}
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto w-full max-w-4xl px-6 py-8 text-sm text-muted-foreground">
            {site.siteTitle}
          </div>
        </footer>
      </body>
    </html>
  );
}
