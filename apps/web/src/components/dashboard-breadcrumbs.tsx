"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { navGroups, ROUTE_ALIASES } from "@/components/app-sidebar";

// Aktionen/Unterseiten unterhalb eines Listen-Items (z.B.
// "/dashboard/content/new" oder "/dashboard/content/[id]/edit") –
// deutsche Beschriftung statt des rohen Routen-Segments.
const ACTION_LABELS: Record<string, string> = {
  new: "Neu anlegen",
  edit: "Bearbeiten",
  versions: "Versionshistorie",
};

// Routen außerhalb der Sidebar-Struktur (Konto über das Nutzer-Menü,
// Einstellungen über den Sidebar-Footer statt eine reguläre Gruppe).
const STANDALONE_ROUTES: Record<string, string> = {
  "/dashboard/account": "Konto",
  "/dashboard/settings": "Einstellungen",
  "/dashboard/search": "Suche",
};

// Erkennt IDs in der URL, damit sie nicht als eigenes, unlesbares
// Breadcrumb-Segment auftauchen (z.B. bei "/dashboard/content/cmsjfwp1y.../
// edit" nur "Bearbeiten" zeigen, nicht zusätzlich die rohe ID) – sowohl
// cuid/cuid2 (Content, Kategorien, …) als auch Bindestrich-UUIDs
// (`crypto.randomUUID()`, z.B. Baustein-Instanz-IDs im Seiten-Designer).
function isLikelyId(segment: string) {
  return /^[a-z0-9-]{20,}$/i.test(segment);
}

function humanizeSegment(segment: string) {
  return (
    ACTION_LABELS[segment] ??
    segment.charAt(0).toUpperCase() + segment.slice(1)
  );
}

interface Crumb {
  label: string;
  href?: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  const crumbs: Crumb[] = [{ label: "Dashboard", href: "/dashboard" }];

  // Aliasierte Routen (siehe ROUTE_ALIASES) suchen Gruppe/Item unter der
  // Ziel-URL statt der tatsächlichen – das eigene Konto taucht so als
  // "Verwaltung > Benutzer > Konto" auf, obwohl es kein Unterpfad von
  // "/dashboard/users" ist.
  const matchPathname = ROUTE_ALIASES[pathname] ?? pathname;

  // Item mit der längsten passenden URL gewinnt (dieselbe Logik wie der
  // Sidebar-Aktiv-Status), sonst würde z.B. "/dashboard" als Präfix
  // jeder anderen Route immer zuerst matchen – berücksichtigt dabei auch
  // Unterpunkte (z.B. "FAQs"/"Galerien" unter "Seiten").
  let bestItem: { url: string; title: string } | null = null;
  let bestParent: { url: string; title: string } | null = null;
  let bestGroup: { label: string; items: readonly { url: string }[] } | null =
    null;
  let bestLength = -1;
  for (const group of navGroups) {
    for (const item of group.items) {
      // "/dashboard" selbst wird schon oben (exakter Pfad, frühes Return)
      // behandelt – als Präfix für ALLE anderen Routen matchen lassen
      // würde jede Route ohne eigenen navGroups-Eintrag (Konto,
      // Einstellungen, Suche, …) fälschlich zusätzlich "Dashboard" als
      // (Eltern-)Crumb bekommen, z.B. "Dashboard > Dashboard > Suche".
      if (item.url === "/dashboard") continue;
      const itemMatches =
        matchPathname === item.url || matchPathname.startsWith(`${item.url}/`);
      if (itemMatches && item.url.length > bestLength) {
        bestItem = item;
        bestParent = null;
        bestGroup = group;
        bestLength = item.url.length;
      }
      if ("children" in item) {
        for (const child of item.children) {
          const childMatches =
            matchPathname === child.url ||
            matchPathname.startsWith(`${child.url}/`);
          if (childMatches && child.url.length > bestLength) {
            bestItem = child;
            bestParent = item;
            bestGroup = group;
            bestLength = child.url.length;
          }
        }
      }
    }
  }

  if (bestItem && bestGroup) {
    // Gruppen mit nur einem Item (aktuell nur "Übersicht" → "Dashboard")
    // würden als Gruppen-Crumb nur das Item-Label wiederholen.
    if (bestGroup.items.length > 1) {
      crumbs.push({ label: bestGroup.label });
    }
    if (bestParent) {
      crumbs.push({ label: bestParent.title, href: bestParent.url });
    }
    crumbs.push({
      label: bestItem.title,
      href: pathname === bestItem.url ? undefined : bestItem.url,
    });
  }

  if (pathname in STANDALONE_ROUTES) {
    crumbs.push({ label: STANDALONE_ROUTES[pathname] });
    return crumbs;
  }

  if (!bestItem) {
    return crumbs;
  }

  const remainder = pathname.slice(bestItem.url.length);
  const rawSegments = remainder.split("/").filter(Boolean);
  const segments = rawSegments.filter((segment) => !isLikelyId(segment));

  if (segments.length === 0 && rawSegments.length > 0) {
    // Detailseite direkt unter einer ID, ohne eigenes Namens-Segment (z.B.
    // "/dashboard/content/galleries/[id]", anders als z.B.
    // "/dashboard/content/[id]/edit"). Ohne diesen Fall
    // würden alle Segmente herausgefiltert, der Eltern-Crumb (z.B.
    // "Menüs"/"Galerien") würde dadurch fälschlich als letztes/aktuelles
    // Element gelten und wäre nicht mehr anklickbar.
    crumbs.push({ label: "Bearbeiten" });
    return crumbs;
  }

  for (const segment of segments) {
    crumbs.push({ label: humanizeSegment(segment) });
  }

  return crumbs;
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem>
                {isLast || !crumb.href ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
