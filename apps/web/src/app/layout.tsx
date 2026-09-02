import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Kumbh_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const kumbhSans = Kumbh_Sans({
  variable: "--font-kumbh-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "pivot CMS",
  description: "Modernes Headless CMS – NestJS + Next.js + shadcn/ui",
};

/** Nutzervorgabe, 2026-08-25: "Umschalten darf nicht flackern: Attribut vor
 * dem ersten Paint setzen".
 *
 * Bis 2026-09-02 löste das ein blockierendes Inline-Script im `<head>`, das
 * `data-pivot-theme` aus dem `localStorage` setzte – der Server konnte den
 * ja nicht kennen. React beanstandete dieses `<script>` beim Client-Render
 * ("Encountered a script tag while rendering React component").
 *
 * Jetzt liegt das Theme in einem Cookie (siehe theme-toggle.tsx). Cookies
 * reisen bei jedem Aufruf mit, das Attribut steht also schon im
 * ausgelieferten HTML – kein Script, kein Flackern, ein Schritt weniger.
 * Gleiches Muster wie beim Eingeklappt-Zustand der Sidebar
 * (`sidebar_state`, siehe dashboard/layout.tsx). */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = (await cookies()).get("pivot_theme")?.value;

  return (
    <html
      lang="de"
      className={`${kumbhSans.variable} ${geistMono.variable} h-full antialiased`}
      {...(theme === "dark" && { "data-pivot-theme": "dark" })}
      // Bleibt trotz serverseitigem Theme: Browser-Erweiterungen hängen
      // gern eigene Attribute an <html>, die es beim SSR nicht gab.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {/* Nutzervorgabe, 2026-08-25: Pivot-Logo im Dark Mode umfärben –
         * "im dunklen das grün als schrift, und grün das badge hintergrund
         * und dunkel das p". Das PNG ist mehrfarbig (dunkles Navy-Quadrat/
         * -Schriftzug + Lime-"p"/-Punkt), ein simpler `invert()`-Filter
         * hätte die Lime-Farbe zerstört. Duotone-Filter stattdessen: erst
         * Graustufen (Luminanz), dann pro Kanal eine Tabelle, die dunkle
         * Pixel (Navy) auf LIME und helle Pixel (Lime) auf ON_LIME mapped –
         * betrifft dadurch automatisch Badge-Quadrat UND Schriftzug (beide
         * ursprünglich Navy) genauso wie "p" UND Schluss-Punkt (beide
         * ursprünglich Lime), ohne ein zweites Bild-Asset zu brauchen. Nur
         * hier einmal global definiert (unsichtbar), referenziert von
         * `.pivot-logo` in globals.css – SVG-Filter-Referenzen wirken
         * dokumentweit unabhängig davon, wo das <img> gerendert wird. */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <defs>
            <filter id="pivot-logo-dark" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="0.2126 0.7152 0.0722 0 0
                        0.2126 0.7152 0.0722 0 0
                        0.2126 0.7152 0.0722 0 0
                        0      0      0      1 0"
              />
              <feComponentTransfer>
                <feFuncR
                  type="table"
                  tableValues="0.7373 0.7373 0.0863 0.0863"
                />
                <feFuncG
                  type="table"
                  tableValues="0.9020 0.9020 0.0941 0.0941"
                />
                <feFuncB
                  type="table"
                  tableValues="0.3020 0.3020 0.1098 0.1098"
                />
              </feComponentTransfer>
            </filter>
          </defs>
        </svg>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
