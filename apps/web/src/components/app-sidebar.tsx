"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Image as ImageIcon,
  Users,
  ShieldCheck,
  ShieldKeyhole,
  Settings,
  FolderCog,
  FolderTree,
  Tags,
  Building2,
  Link2,
  Compass,
  Layers,
  ChevronRight,
  LogOut,
  HelpCircle,
  Images,
  MessageSquare,
  Trash2,
  ClipboardList,
  Inbox,
  Server,
  Globe,
  Blocks,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEPLOYMENT_MODE_BADGE } from "@/lib/deployment-mode-badge";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/api-server";
import { asset, bff } from "@/lib/bff";

// Referenzbild: aktiver Eintrag ist ein moderat gerundetes Rechteck (kein
// volles Pillen-Oval wie bei Buttons), Text/Icon fett und dunkel auf Lime.
// Eingeklappt: das aktive Hintergrund-Rechteck soll quadratisch um das
// Icon sitzen statt über die volle Spaltenbreite zu laufen (`size-11` +
// `mx-auto` + `p-0` überschreiben `w-full`/Padding gezielt nur im
// `collapsible=icon`-Zustand).
// `data-active:hover:bg-primary` ist kein Schmuck, sondern nötig: ohne
// ihn gewinnt beim Hovern über einem AKTIVEN Punkt die gedämpfte
// `hover:bg-sidebar-accent`-Fläche aus `ui/sidebar.tsx`, während
// `data-active:hover:text-primary-foreground` die Schrift auf dem für die
// Lime-Pille gedachten dunklen Ton festhält – im Dark-Modus ergab das
// dunkle Schrift auf dunklem Oliv (Nutzer-Bugreport, 2026-09-02). Die
// aktive Pille behält jetzt beim Hovern ihr Aussehen.
const navActiveClass =
  "h-auto w-full gap-3 overflow-hidden rounded-xl pl-3 pr-4 py-2.5 transition-[gap,padding] duration-200 ease-linear group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0 data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground";

// Footer-Einträge (Einstellungen/Abmelden) liegen direkt im gepolsterten
// SidebarFooter (hat bereits eigenes `p-2`, siehe ui/sidebar.tsx) –
// bekommen dieselbe Optik wie die Haupt-Items, keinen Rand-zu-Rand-Trick
// mehr nötig, da das Rechteck ohnehin innerhalb des Footer-Innenabstands
// sitzt.
const navFooterActiveClass =
  "h-auto w-full gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition-[gap,padding] duration-200 ease-linear group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0 data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground";

const navLabelClass =
  "overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0";

// Icons OHNE eigenen Hintergrund-Chip (Nutzervorgabe) – nur Größe/Farbe
// vereinheitlicht, damit Icon und Label sauber ausgerichtet bleiben.
const navIconChipClass =
  // Eingeklappt sind die Icons das einzige Erkennungsmerkmal und deshalb
  // eine Stufe groesser als im ausgeklappten Zustand (Nutzervorgabe,
  // 2026-08-31).
  //
  // Farbe, zweistufige Nutzervorgabe vom 2026-09-01: erst "alle icon
  // grün" (Haupt- und Unterebene auf dasselbe Token, vorher standen die
  // Unterpunkte über das `SidebarMenuSubButton`-Primitive auf grün, die
  // Hauptpunkte auf grau), direkt danach "im light modus sollen die icons
  // und schrift grau sein". Ergebnis: **grau im Light-, grün im
  // Dark-Modus** – im hellen Theme ist `--pivot-acc-fg` ein dunkles
  // Oliv (#4d6b12), das neben dem grauen Label unruhig wirkt; im dunklen
  // Theme ist es ein helles Lime (#cbe86e) und trägt die Farbigkeit der
  // Sidebar. Im aktiven Zustand bleibt es in beiden Themes beim dunklen
  // `primary-foreground` auf der Lime-Pille (Kontrast) – die
  // `group-data-active`-Variante hat die höhere Spezifität und gewinnt
  // daher auch gegen `dark:`.
  "flex size-7 shrink-0 items-center justify-center text-sidebar-foreground/70 transition-colors group-data-active/menu-button:text-primary-foreground dark:text-sidebar-accent-foreground [&_svg]:size-4 group-data-[collapsible=icon]:[&_svg]:size-5";

// Unterpunkte (z.B. "FAQs"/"Galerien" unter "Seiten") – deutlich tiefer
// eingerückt als `navActiveClass` (pl-3), sonst wirken sie bei diesem
// Rechteck-Zeilen-Design nicht wie eine verschachtelte Ebene, sondern wie
// normale gleichrangige Einträge.
//
// Die drei `[&>svg]`-Regeln am Ende überschreiben die Icon-Farbe, die das
// `SidebarMenuSubButton`-Primitive fest auf `text-sidebar-accent-foreground`
// setzt (siehe ui/sidebar.tsx) – ohne sie blieben die Unterpunkte auch im
// Light-Modus grün, während die Hauptpunkte grau sind. Der
// `data-active`-Fall ist dabei nicht optional: ein graues Icon auf der
// Lime-Pille wäre kaum lesbar.
const navSubActiveClass =
  "h-auto w-full gap-2 overflow-hidden rounded-xl pl-10 pr-4 py-2 text-sm transition-[gap,padding] duration-200 ease-linear data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground [&>svg]:text-sidebar-foreground/70 dark:[&>svg]:text-sidebar-accent-foreground data-active:[&>svg]:text-primary-foreground";

// Der Papierkorb (`/dashboard/trash`) hat kein eigenes Recht: eine Route
// deckt dort sieben Ressourcen ab und `TrashController.findAll()` zeigt
// jedem nur die Typen, für die er `:read` hat – erst wenn KEINER davon
// vorhanden ist, antwortet er 403. Der Menüpunkt folgt genau dieser Regel
// (siehe `anyPermission`). Die Liste spiegelt `TRASH_TYPES` aus
// `apps/api/src/trash/trash.types.ts` – ändert sie sich dort, muss sie
// hier mitgezogen werden.
const TRASH_READ_PERMISSIONS = [
  "content:read",
  "media:read",
  "categories:read",
  "tags:read",
  "gallery:read",
  "faq:read",
  "forms:read",
] as const;

/** Sichtbarkeitsregel für einen Menüpunkt oder Unterpunkt: `permission`
 * verlangt genau dieses Recht, `anyPermission` mindestens eines aus der
 * Liste (bisher nur der Papierkorb), keins von beidem heißt "für alle
 * sichtbar, die überhaupt ins Dashboard dürfen" (z.B. das Dashboard
 * selbst).
 *
 * Gemeinsam genutzt von Sidebar UND Befehlspalette, damit ein Eintrag
 * nicht an der einen Stelle versteckt und an der anderen auffindbar ist. */
// `title`/`url` stehen nur der Vollständigkeit halber in der Signatur:
// beide Rechte-Felder sind optional, und TypeScript weist einen Typ, der
// AUSSCHLIESSLICH optionale Felder hat, sonst für jedes Objekt ohne eins
// davon zurück ("weak type detection") – also z.B. für den Dashboard-
// Eintrag, der gar kein Recht braucht.
export function hasNavAccess(
  entry: {
    title: string;
    url: string;
    permission?: string;
    anyPermission?: readonly string[];
  },
  permissions: string[],
): boolean {
  if (entry.permission) return permissions.includes(entry.permission);
  if (entry.anyPermission)
    return entry.anyPermission.some((p) => permissions.includes(p));
  return true;
}

// Exportiert, damit `dashboard-breadcrumbs.tsx` dieselbe Gruppen-/Item-
// Struktur wiederverwenden kann – eine einzige Quelle für "welche Seite
// gehört zu welchem Menüpunkt/welcher Gruppe" statt sie zweimal zu
// pflegen (Sidebar-Aktiv-Status und Breadcrumbs würden sonst leicht
// auseinanderlaufen).
//
// `permission`/`anyPermission` sind für die SICHTBARKEIT zuständig, nicht
// für die Absicherung – die liegt beim jeweiligen API-Endpunkt
// (`@RequirePermission`, bzw. manuelle Prüfung bei Papierkorb/globalen
// Modulen). Jeder Eintrag, dessen Seite ein Recht verlangt, muss es hier
// tragen, sonst verlinkt die Sidebar auf einen 403.
export const navGroups = [
  {
    label: "Übersicht",
    icon: LayoutDashboard,
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Administration",
    icon: Server,
    items: [
      {
        title: "Mandanten",
        url: "/dashboard/mandanten",
        icon: Building2,
        permission: "settings:read",
        children: [
          {
            title: "Webseiten",
            url: "/dashboard/websites",
            icon: Globe,
            permission: "settings:read",
          },
        ],
      },
      {
        title: "Module",
        url: "/dashboard/modules",
        icon: Blocks,
        permission: "settings:read",
      },
    ],
  },
  {
    label: "Webseite",
    icon: Layers,
    items: [
      {
        title: "Seiten",
        url: "/dashboard/content",
        icon: FileText,
        permission: "content:read",
        children: [
          {
            title: "FAQs",
            url: "/dashboard/content/faqs",
            icon: HelpCircle,
            permission: "faq:read",
          },
          {
            title: "Galerien",
            url: "/dashboard/content/galleries",
            icon: Images,
            permission: "gallery:read",
          },
          {
            title: "Vorschau-Links",
            url: "/dashboard/content/preview-links",
            icon: Link2,
            permission: "preview-links:read",
          },
        ],
      },
      {
        title: "Medien",
        url: "/dashboard/media",
        icon: ImageIcon,
        permission: "media:read",
      },
      {
        title: "Kategorien",
        url: "/dashboard/categories",
        icon: FolderTree,
        permission: "categories:read",
      },
      {
        title: "Tags",
        url: "/dashboard/tags",
        icon: Tags,
        permission: "tags:read",
      },
      {
        title: "Formulare",
        url: "/dashboard/forms",
        icon: ClipboardList,
        permission: "forms:read",
        children: [
          {
            title: "Einsendungen",
            url: "/dashboard/forms/submissions",
            icon: Inbox,
            // Eigenes Recht, NICHT das `forms:read` des Elternpunkts – eine
            // Rolle darf Formulare bearbeiten dürfen, ohne die (personen-
            // bezogenen) Einsendungen lesen zu dürfen.
            permission: "form-submissions:read",
          },
        ],
      },
      {
        title: "Menüs",
        url: "/dashboard/navigation",
        icon: Compass,
        permission: "navigation:read",
      },
      {
        title: "Papierkorb",
        url: "/dashboard/trash",
        icon: Trash2,
        anyPermission: TRASH_READ_PERMISSIONS,
      },
    ],
  },
  {
    label: "Verwaltung",
    icon: FolderCog,
    items: [
      {
        title: "Firma",
        subtitle: "Firmenangaben & Standorte",
        url: "/dashboard/company",
        icon: Building2,
        permission: "company:read",
      },
      {
        title: "Datenschutz",
        subtitle: "Rechtstexte & Aufbewahrung",
        url: "/dashboard/privacy",
        icon: ShieldKeyhole,
        permission: "privacy:read",
        // Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28: "wenn
        // deaktiviert, soll der Menüpunkt Datenschutz auch weg" – gilt für
        // Master (ModuleSettings) genauso wie für einen Client, dem das
        // Modul nicht gebucht ist) – siehe `AdminMenu`, das zusätzlich zu
        // `permission` auch `moduleKey` gegen die aktuell freigeschalteten
        // Module prüft.
        moduleKey: "datenschutz",
      },
      {
        title: "Benutzer",
        subtitle: "Konten & Zugänge",
        url: "/dashboard/users",
        icon: Users,
        permission: "users:read",
      },
      {
        title: "Rollen & Rechte",
        subtitle: "Berechtigungen",
        url: "/dashboard/roles",
        icon: ShieldCheck,
        permission: "roles:read",
      },
      {
        title: "Benachrichtigungen",
        subtitle: "Postfach & Meldungen",
        url: "/dashboard/system-messages",
        icon: MessageSquare,
      },
    ],
  },
] as const;

const ALL_ITEM_URLS = navGroups.flatMap((group) =>
  group.items.flatMap((item) => [
    item.url,
    ...("children" in item ? item.children.map((child) => child.url) : []),
  ]),
);

// Routen außerhalb der Sidebar-Struktur, die inhaltlich zu einem
// Sidebar-Item gehören und dessen Aktiv-Hervorhebung/Gruppen-Aufklappen
// übernehmen sollen – z.B. ist das eigene Konto (übers Nutzer-Menü statt
// die Sidebar erreichbar) inhaltlich Teil von "Benutzer". Auch von
// `dashboard-breadcrumbs.tsx` genutzt, damit beide nicht auseinanderlaufen.
export const ROUTE_ALIASES: Record<string, string> = {
  "/dashboard/account": "/dashboard/users",
};

/**
 * Wählt die am genauesten passende Item-URL (längste übereinstimmende
 * URL, nicht nur die erste gefundene) – sonst würde z.B. "/dashboard"
 * (Dashboard-Link) als Präfix jeder anderen Route immer zuerst matchen.
 * `startsWith(url + "/")` sorgt dafür, dass auch Detailseiten (Anlegen,
 * Bearbeiten, [id]/...) ihr Eltern-Listen-Item als aktiv markieren –
 * z.B. macht `/dashboard/content/new` oder
 * `/dashboard/content/abc123/edit` den Menüpunkt "Seiten"
 * (`/dashboard/content`) aktiv.
 */
export function findBestMatchingUrl(
  pathname: string,
  urls: string[],
): string | null {
  let best: string | null = null;
  let bestLength = -1;
  for (const url of urls) {
    // "/dashboard" ist die Startseite, kein Container für andere Dashboard-
    // Routen – ohne diese Ausnahme würde Präfix-Matching z.B. auch
    // "/dashboard/settings" (kein eigenes Sidebar-Item, siehe separater
    // Fußzeilen-Button) fälschlich zusätzlich "Dashboard" markieren
    // (Nutzervorgabe, 2026-08-25: "wenn ich auf Einstellungen bin, soll
    // Dashboard nicht aktiv sein").
    const matches =
      pathname === url ||
      (url !== "/dashboard" && pathname.startsWith(`${url}/`));
    if (matches && url.length > bestLength) {
      best = url;
      bestLength = url.length;
    }
  }
  return best;
}

/** Ist `activeItemUrl` das Item selbst ODER eines seiner Unterpunkte
 * (siehe `SidebarMenuSub` unten) – steuert sowohl die Hervorhebung des
 * Eltern-Items als auch die fette Gruppen-Beschriftung. */
function itemMatchesActive(
  item: { url: string; children?: readonly { url: string }[] },
  activeItemUrl: string | null,
): boolean {
  return (
    item.url === activeItemUrl ||
    (item.children?.some((c) => c.url === activeItemUrl) ?? false)
  );
}

export function AppSidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state: sidebarState, isMobile } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const permissions = user.permissions ?? [];
  // "Administration" (Websites/Module) nur für die Master-Instanz sichtbar
  // (siehe knowledge-base/platform/master-slave-licensing.md) – eine
  // Client-Installation kennt diese Mandanten-Verwaltung gar nicht. Die
  // Wartungsseiten-Konfiguration für die Installation selbst liegt separat
  // unter Einstellungen → Wartungsseite (immer erreichbar).
  const isMaster = (user.deploymentMode ?? "master") === "master";
  // "Verwaltung" wird nicht mehr in der Sidebar gerendert, sondern über das
  // neue Header-Dropdown erreicht (siehe admin-menu.tsx) – bleibt trotzdem
  // Teil von `navGroups` (Datenquelle für Breadcrumbs/Befehlspalette/
  // Header-Menü), wird hier nur aus der sichtbaren Sidebar-Liste gefiltert.
  const visibleNavGroups = navGroups
    .filter((group) => group.label !== "Verwaltung")
    .filter((group) => group.label !== "Administration" || isMaster)
    .map((group) => ({
      ...group,
      originalItemCount: group.items.length as number,
      // Unterpunkte werden mitgefiltert und tragen ihr EIGENES Recht
      // (seit 2026-09-02) – vorher erbten sie stillschweigend die
      // Sichtbarkeit ihres Elternpunkts und konnten so auf eine Seite
      // verlinken, die dann 403 liefert.
      //
      // Bewusst hierarchisch: ist der Elternpunkt nicht erlaubt, sind auch
      // seine Unterpunkte weg (sie werden im Baum unter ihm gerendert).
      // Fehlt jemandem also `content:read`, sieht er auch FAQs/Galerien
      // nicht mehr, selbst mit `faq:read` – das versteckt im Zweifel zu
      // viel statt zu wenig und ist damit die sichere Richtung.
      items: group.items
        .filter((item) => hasNavAccess(item, permissions))
        .map((item) =>
          "children" in item
            ? {
                ...item,
                children: item.children.filter((child) =>
                  hasNavAccess(child, permissions),
                ),
              }
            : item,
        ),
    }))
    .filter((group) => group.originalItemCount === 0 || group.items.length > 0);
  const canViewSettings = permissions.includes("settings:read");

  // Best-match aktive Item-URL für den aktuellen Pfad – steuert die
  // Hervorhebung des Menüpunkts (siehe `findBestMatchingUrl`). Gruppen
  // selbst klappen nicht mehr auf/zu (siehe Kommentar bei `isOpen` unten),
  // daher wird hier keine aktive Gruppen-Beschriftung mehr gebraucht.
  const activeItemUrl = findBestMatchingUrl(
    ROUTE_ALIASES[pathname] ?? pathname,
    ALL_ITEM_URLS,
  );
  // Unterpunkte (z.B. "FAQs"/"Galerien" unter "Seiten") klappen unabhängig
  // von den Gruppen auf/zu, mehrere gleichzeitig möglich – Set statt
  // einzelnem String, da es (anders als bei Gruppen) kein Bedürfnis nach
  // "nur eine offen" gibt. Initial aufgeklappt, falls direkt auf einen
  // Unterpunkt navigiert wurde (z.B. Seitenaufruf von "/…/faqs").
  const [openSubItems, setOpenSubItems] = React.useState<ReadonlySet<string>>(
    () => {
      const initial = new Set<string>();
      for (const group of navGroups) {
        for (const item of group.items) {
          if (
            "children" in item &&
            item.children.some((c) => c.url === activeItemUrl)
          ) {
            initial.add(item.url);
          }
        }
      }
      return initial;
    },
  );
  // Beim Navigieren in eine andere Gruppe bzw. zu einem Unterpunkt diese
  // aufklappen (löst bei Gruppen die vorherige ab) – als Render-Zeit-
  // Anpassung statt Effekt, da es sich um eine reine Ableitung aus
  // `pathname` handelt.
  const [syncedPathname, setSyncedPathname] = React.useState(pathname);
  if (pathname !== syncedPathname) {
    setSyncedPathname(pathname);
    for (const group of navGroups) {
      for (const item of group.items) {
        if (
          "children" in item &&
          item.children.some((c) => c.url === activeItemUrl) &&
          !openSubItems.has(item.url)
        ) {
          setOpenSubItems((prev) => new Set(prev).add(item.url));
        }
      }
    }
  }

  function toggleSubItem(url: string) {
    setOpenSubItems((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch(bff("/api/auth/logout"), { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-[25px] transition-[padding] duration-200 ease-linear max-md:px-3 group-data-[collapsible=icon]:px-[10px]">
        <div className="relative flex items-center gap-2 py-2 transition-[gap] duration-200 ease-linear group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          <div className="relative flex h-8 w-0 shrink-0 items-center justify-center opacity-0 transition-[width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:opacity-100">
            <div className="flex size-full items-center justify-center overflow-hidden rounded-lg shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset("/brand/logo-collapsed.png")}
                alt="pivot CMS"
                className="pivot-logo size-full object-contain"
              />
            </div>
            {/* Master/Client-Indikator (Nutzervorgabe, 2026-08-24: "Slave"
                heißt in der UI "Client") – eingeklappt nur der
                Anfangsbuchstabe im kleinen Kreis (kein Platz für Text),
                ausgeklappt daneben der volle Name (siehe unten). Voller
                Name zusätzlich per Tooltip beim Hovern. */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      "absolute -top-1 -right-1 hidden size-3.5 items-center justify-center rounded-full text-[8px] font-semibold group-data-[collapsible=icon]:flex",
                      DEPLOYMENT_MODE_BADGE[isMaster ? "master" : "slave"]
                        .className,
                    )}
                  />
                }
              >
                {isMaster ? "M" : "C"}
              </TooltipTrigger>
              <TooltipContent side="right">
                {DEPLOYMENT_MODE_BADGE[isMaster ? "master" : "slave"].label}
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="whitespace-nowrap transition-[width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:opacity-0">
            <span className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset("/brand/logo-expanded.png")}
                alt="pivot CMS"
                className="pivot-logo h-11 w-auto max-w-full object-contain"
              />
              {/* Ausgeklappt: voll ausgeschriebener Name statt nur des
                  Anfangsbuchstabens (Nutzervorgabe: "m und c nur bei
                  eingeklappt. sonst ausgeschrieben"). Direkt am Logo-Bild
                  positioniert, moderater `rounded-md` statt der Standard-
                  Pillenform. */}
              <Badge
                variant="secondary"
                className={cn(
                  "absolute top-0 -right-3 h-3.5 gap-0 rounded-md px-1 py-0 text-[9px] leading-3",
                  DEPLOYMENT_MODE_BADGE[isMaster ? "master" : "slave"]
                    .className,
                )}
              >
                {DEPLOYMENT_MODE_BADGE[isMaster ? "master" : "slave"].label}
              </Badge>
            </span>
          </span>
          {/* Nutzervorgabe, 2026-08-26: Hell/Dunkel-Schalter passt nicht mehr
              in den Header (führte auf schmalen Handys zu horizontalem
              Scrollen) – nur mobil hier rechts neben dem Logo, Desktop-Header
              behält seinen eigenen (siehe dashboard-header.tsx). */}
          {isMobile && <ThemeToggle className="mr-0 ml-auto" />}
        </div>
      </SidebarHeader>
      {/* Eingeklappt ohne sichtbaren Scrollbalken (Nutzervorgabe,
          2026-08-31). Klasse statt reinem Attribut-Selektor, damit es
          nicht davon abhaengt, ob der data-collapsible-Selektor greift -
          gescrollt werden kann weiterhin. */}
      <SidebarContent
        className={sidebarState === "collapsed" ? "no-scrollbar" : undefined}
      >
        {visibleNavGroups.map((group) => {
          // Im eingeklappten (icon-only) Zustand macht ein Auf-/Zuklappen der
          // Gruppen keinen Sinn (Labels sind ohnehin ausgeblendet) – Items
          // bleiben dann immer sichtbar. Gruppen, die nach der Rechte-
          // Filterung komplett ohne Items dastehen, haben in diesem Zustand
          // nichts anzuzeigen (kein Icon, kein Platzhaltertext) und werden
          // komplett übersprungen – sonst entstünde eine leere Lücke im
          // eingeklappten Zustand.
          if (sidebarState === "collapsed" && group.items.length === 0) {
            return null;
          }
          // Maglo-Referenz zeigt eine flache Liste ohne Auf-/Zuklapp-
          // Menü – bei ~13 Menüpunkten braucht pivot weiterhin eine
          // Gruppierung fürs Auffinden, aber nicht mehr als interaktives
          // Akkordeon: Gruppen sind immer aufgeklappt, die Beschriftung
          // ist nur noch ein schlichtes, nicht klickbares Abschnitts-Label
          // (kein Icon, kein Pfeil, keine Hintergrund-/Rand-zu-Rand-Optik).
          const isOpen = true;
          return (
            <SidebarGroup
              key={group.label}
              className="px-[25px] transition-[padding] duration-200 ease-linear group-data-[collapsible=icon]:px-[10px]"
            >
              <SidebarGroupLabel className="px-1 pt-2 pb-1 text-xs font-semibold tracking-wide text-sidebar-foreground/50 uppercase">
                <span className={navLabelClass}>{group.label}</span>
              </SidebarGroupLabel>
              <div
                className={cn(
                  "-mx-2 grid w-[calc(100%+1rem)] transition-[grid-template-rows] duration-200 ease-linear",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <SidebarGroupContent>
                    {group.items.length === 0 ? (
                      <p
                        className={cn(
                          "px-4 py-1 text-xs text-sidebar-foreground/50",
                          navLabelClass,
                        )}
                      >
                        Bald verfügbar
                      </p>
                    ) : (
                      <SidebarMenu>
                        {group.items.map((item) => {
                          const hasChildren =
                            "children" in item && item.children.length > 0;

                          // Eingeklappter Icon-only-Zustand: kein Platz für
                          // Einrückung/Pfeil/Tooltip-Label der Unterpunkte –
                          // die Kind-Icons werden stattdessen als ganz normale,
                          // gleichrangige Zeilen direkt im Anschluss gerendert
                          // (optisch identisch zu allen anderen Items), statt
                          // sie wie im ausgeklappten Zustand einzurücken.
                          if (sidebarState === "collapsed") {
                            return (
                              <React.Fragment key={item.url}>
                                <SidebarMenuItem>
                                  <SidebarMenuButton
                                    render={<Link href={item.url} />}
                                    isActive={item.url === activeItemUrl}
                                    tooltip={item.title}
                                    className={navActiveClass}
                                  >
                                    <span className={navIconChipClass}>
                                      <item.icon />
                                    </span>
                                    <span className={navLabelClass}>
                                      {item.title}
                                    </span>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                                {hasChildren &&
                                  "children" in item &&
                                  item.children.map((child) => (
                                    <SidebarMenuItem key={child.url}>
                                      <SidebarMenuButton
                                        render={<Link href={child.url} />}
                                        isActive={child.url === activeItemUrl}
                                        tooltip={child.title}
                                        className={navActiveClass}
                                      >
                                        <span className={navIconChipClass}>
                                          <child.icon />
                                        </span>
                                        <span className={navLabelClass}>
                                          {child.title}
                                        </span>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  ))}
                              </React.Fragment>
                            );
                          }

                          // Ist dieses Item selbst (oder eines seiner Kinder)
                          // aktiv, bleiben die Unterpunkte immer aufgeklappt
                          // – unabhängig vom manuellen Auf-/Zuklapp-Status.
                          // Der Toggle-Button wird in diesem Fall ausgeblendet,
                          // da er ohnehin wirkungslos wäre.
                          const isForcedOpen = itemMatchesActive(
                            item,
                            activeItemUrl,
                          );
                          const isSubOpen =
                            isForcedOpen || openSubItems.has(item.url);
                          return (
                            <SidebarMenuItem key={item.url}>
                              <div className="relative">
                                <SidebarMenuButton
                                  render={<Link href={item.url} />}
                                  isActive={item.url === activeItemUrl}
                                  tooltip={item.title}
                                  className={cn(
                                    navActiveClass,
                                    hasChildren && "pr-9",
                                  )}
                                >
                                  <span className={navIconChipClass}>
                                    <item.icon />
                                  </span>
                                  <span
                                    className={cn(
                                      navLabelClass,
                                      itemMatchesActive(item, activeItemUrl) &&
                                        "font-semibold",
                                    )}
                                  >
                                    {item.title}
                                  </span>
                                </SidebarMenuButton>
                                {hasChildren && isForcedOpen && (
                                  // Aktiv (erzwungen aufgeklappt): der Pfeil
                                  // bleibt sichtbar und zeigt den offenen
                                  // Zustand (nach unten gedreht) – nur ohne
                                  // Klick-Handler, da Zu-/Aufklappen hier
                                  // ohnehin wirkungslos wäre.
                                  <span
                                    aria-hidden
                                    className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground"
                                  >
                                    <ChevronRight className="size-4 rotate-90" />
                                  </span>
                                )}
                                {hasChildren && !isForcedOpen && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleSubItem(item.url);
                                    }}
                                    aria-label={
                                      isSubOpen
                                        ? `${item.title}-Unterpunkte einklappen`
                                        : `${item.title}-Unterpunkte ausklappen`
                                    }
                                    className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
                                  >
                                    <ChevronRight
                                      className={cn(
                                        "size-4 transition-transform duration-200 ease-linear",
                                        isSubOpen && "rotate-90",
                                      )}
                                    />
                                  </button>
                                )}
                              </div>
                              {hasChildren && (
                                <div
                                  className={cn(
                                    "grid transition-[grid-template-rows] duration-200 ease-linear",
                                    isSubOpen
                                      ? "grid-rows-[1fr]"
                                      : "grid-rows-[0fr]",
                                  )}
                                >
                                  <div className="overflow-hidden">
                                    <SidebarMenuSub className="mx-0 border-l-0 px-0 py-1">
                                      {"children" in item &&
                                        item.children.map((child) => (
                                          <SidebarMenuSubItem key={child.url}>
                                            <SidebarMenuSubButton
                                              render={<Link href={child.url} />}
                                              isActive={
                                                child.url === activeItemUrl
                                              }
                                              className={navSubActiveClass}
                                            >
                                              <child.icon />
                                              <span className={navLabelClass}>
                                                {child.title}
                                              </span>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                  </div>
                                </div>
                              )}
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    )}
                  </SidebarGroupContent>
                </div>
              </div>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t px-[25px] transition-[padding] duration-200 ease-linear group-data-[collapsible=icon]:px-[10px]">
        <SidebarMenu>
          {canViewSettings && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/dashboard/settings" />}
                isActive={pathname === "/dashboard/settings"}
                tooltip="Einstellungen"
                className={navFooterActiveClass}
              >
                <span className={navIconChipClass}>
                  <Settings />
                </span>
                <span className={navLabelClass}>Einstellungen</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              disabled={isLoggingOut}
              tooltip="Abmelden"
              className={navFooterActiveClass}
            >
              <span className={navIconChipClass}>
                <LogOut />
              </span>
              <span className={navLabelClass}>
                {isLoggingOut ? "Wird abgemeldet…" : "Abmelden"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
