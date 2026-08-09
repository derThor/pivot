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
import { navGroups } from "@/components/app-sidebar";

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
};

// Erkennt IDs (cuid/cuid2) in der URL, damit sie nicht als eigenes,
// unlesbares Breadcrumb-Segment auftauchen (z.B. bei
// "/dashboard/content/cmsjfwp1y.../edit" nur "Bearbeiten" zeigen, nicht
// zusätzlich die rohe ID).
function isLikelyId(segment: string) {
  return /^[a-z0-9]{20,}$/i.test(segment);
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

  if (pathname in STANDALONE_ROUTES) {
    crumbs.push({ label: STANDALONE_ROUTES[pathname] });
    return crumbs;
  }

  // Item mit der längsten passenden URL gewinnt (dieselbe Logik wie der
  // Sidebar-Aktiv-Status), sonst würde z.B. "/dashboard" als Präfix
  // jeder anderen Route immer zuerst matchen.
  let bestItem: { url: string; title: string } | null = null;
  let bestGroup: { label: string; items: readonly { url: string }[] } | null =
    null;
  let bestLength = -1;
  for (const group of navGroups) {
    for (const item of group.items) {
      const matches =
        pathname === item.url || pathname.startsWith(`${item.url}/`);
      if (matches && item.url.length > bestLength) {
        bestItem = item;
        bestGroup = group;
        bestLength = item.url.length;
      }
    }
  }

  if (!bestItem || !bestGroup) {
    return crumbs;
  }

  // Gruppen mit nur einem Item (aktuell nur "Übersicht" → "Dashboard")
  // würden als Gruppen-Crumb nur das Item-Label wiederholen.
  if (bestGroup.items.length > 1) {
    crumbs.push({ label: bestGroup.label });
  }
  crumbs.push({
    label: bestItem.title,
    href: pathname === bestItem.url ? undefined : bestItem.url,
  });

  const remainder = pathname.slice(bestItem.url.length);
  const segments = remainder
    .split("/")
    .filter(Boolean)
    .filter((segment) => !isLikelyId(segment));
  for (const segment of segments) {
    crumbs.push({ label: humanizeSegment(segment) });
  }

  return crumbs;
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <Breadcrumb className="hidden min-w-0 shrink sm:block">
      <BreadcrumbList className="flex-nowrap overflow-hidden">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <BreadcrumbItem className="min-w-0 shrink">
                {isLast || !crumb.href ? (
                  <BreadcrumbPage className="truncate">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={<Link href={crumb.href} />}
                    className="truncate"
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="shrink-0" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
