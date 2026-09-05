import type { TemplateManifest } from "@pivot/blocks";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth";
import type { SearchResult } from "./search";
import type { CompanyFieldKey } from "./company-fields";
import type {
  ContentTypeField,
  GlobalModule,
  MediaVariant,
} from "@pivot/blocks";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export interface UserRoleRef {
  id: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string;
  avatarUrl: string | null;
  department: string | null;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  twoFactorEnabledAt: string | null;
  failedLoginAttempts: number;
  deletedAt: string | null;
  anonymizedAt: string | null;
  createdAt: string;
  roles: UserRoleRef[];
  /** Nur bei getCurrentUser() (GET /auth/me) vorhanden, nicht bei getUsers(). */
  permissions?: string[];
  /** Nur bei getCurrentUser() (GET /auth/me) vorhanden, nicht bei getUsers(). */
  canAccessDashboard?: boolean;
  /** Nur bei getCurrentUser() während einer Impersonation gesetzt (Admin-ID). */
  impersonatedBy?: string;
  /** Nur bei getCurrentUser() (GET /auth/me) vorhanden, nicht bei getUsers(). */
  twoFactorSetupRequired?: boolean;
  /** Nur bei getCurrentUser() (GET /auth/me) vorhanden, nicht bei getUsers().
   * Steuert den Master-exklusiven "Administration"-Sidebar-Bereich. */
  deploymentMode?: "master" | "slave";
}

export interface UserSession {
  id: string;
  device: string;
  ipAddress: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export function getUser(id: string) {
  return apiFetch<CurrentUser>(`/users/${id}`);
}

export interface UserNotificationCounts {
  pendingActivation: number;
  failedLogins: number;
  pendingPasswordChange: number;
}

export function getUserNotificationCounts() {
  return apiFetch<UserNotificationCounts>("/users/notification-counts");
}

export function getUserStats(id: string) {
  return apiFetch<{ contentCount: number; mediaCount: number }>(
    `/users/${id}/stats`,
  );
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string };
}

export interface ActivityLogResponse {
  items: ActivityLogEntry[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getUserActivity(id: string, page = 1, pageSize = 10) {
  return apiFetch<ActivityLogResponse>(
    `/users/${id}/activity?page=${page}&pageSize=${pageSize}`,
  );
}

/** "Diese Woche"-Kachel auf "Mein Konto" – eigener `/auth/me/stats`-Endpoint
 * statt `getUserStats()`, siehe Kommentar an AuthController.getMyStats(). */
export function getMyWeeklyStats() {
  return apiFetch<{ contentCount: number; mediaCount: number }>(
    "/auth/me/stats",
  );
}

// Eigener Fetch statt `apiFetch()`: braucht zusätzlich den Refresh-Token-
// Cookie-Wert als Header, damit das Backend die eigene Sitzung als
// "aktuelle Sitzung" markieren kann (siehe UsersController.listSessions).
export async function getUserSessions(id: string) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  const res = await fetch(`${API_URL}/users/${id}/sessions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(refreshToken && { "x-current-refresh-token": refreshToken }),
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<UserSession[]>;
}

/** Eigene Sitzungen auf "Mein Konto" – eigener `/auth/me/sessions`-Endpoint
 * statt `getUserSessions()`, siehe Kommentar an AuthController.listMySessions(). */
export async function getMySessions() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  const res = await fetch(`${API_URL}/auth/me/sessions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(refreshToken && { "x-current-refresh-token": refreshToken }),
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<UserSession[]>;
}

export type ContentStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type ContentVersionTrigger = "EDIT" | "ROLLBACK_BACKUP";

export interface AuthorRef {
  id: string;
  firstName: string | null;
  lastName: string;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface TagRef {
  id: string;
  name: string;
  slug: string;
}

export interface ContentListItem {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: string;
  contentType: { id: string; name: string; slug: string };
  author: AuthorRef;
  categories: CategoryRef[];
  tags: TagRef[];
  isFeatured: boolean;
  sectionsCount: number;
}

export interface ContentListResponse {
  items: ContentListItem[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

async function apiFetch<T>(path: string): Promise<T | null> {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  return res.json();
}

async function publicApiFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
}

export interface NavigationSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  _count: { items: number };
}

export interface NavigationItemNode {
  id: string;
  label: string;
  externalUrl: string | null;
  openInNewTab: boolean;
  /** Genau ein Menüpunkt app-weit ist die Startseite der öffentlichen
   * Website (siehe NavigationItem.isHomepage). */
  isHomepage: boolean;
  contentId: string | null;
  content: {
    id: string;
    title: string;
    slug: string;
    status: ContentStatus;
  } | null;
  /** Drittes Ziel neben Inhalt und externer URL (seit 2026-09-02): der
   * Menüpunkt zeigt auf die Übersichtsseite dieser Kategorie. */
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  /** Darstellung der Übersichtsseite – nur bei Kategorie-Ziel relevant. */
  categoryLayout: "LIST" | "BLOCKS";
  appearance: "LINK" | "TEXT_BUTTON" | "ACCENT_BUTTON";
  /** Abstand oben/unten der Zielseite in Pixeln, getrennt nach
   * Breakpoint (Nutzervorgabe, 2026-09-03) – bei jedem Menüpunkt setzbar,
   * unabhängig vom Ziel. `null` = Vorgabe des Templates; jede Stufe erbt
   * ohne eigenen Wert die nächstkleinere. */
  marginTopMobile: number | null;
  marginBottomMobile: number | null;
  marginTopTablet: number | null;
  marginBottomTablet: number | null;
  marginTopDesktop: number | null;
  marginBottomDesktop: number | null;
  sortOrder: number;
  parentId: string | null;
  children: NavigationItemNode[];
}

export interface NavigationDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  items: NavigationItemNode[];
}

export interface NavigationListResponse {
  items: NavigationSummary[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getNavigations(params?: { page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return apiFetch<NavigationListResponse>(`/navigations${qs ? `?${qs}` : ""}`);
}

export function getNavigation(id: string) {
  return apiFetch<NavigationDetail>(`/navigations/${id}`);
}

export function getContentList(params?: {
  status?: ContentStatus;
  categoryId?: string;
  search?: string;
  sortOrder?: CategorySortOrder;
  page?: number;
  pageSize?: number;
  /** Sortierung über einen Spaltenkopf (siehe SortableHead). */
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.categoryId) search.set("categoryId", params.categoryId);
  if (params?.search) search.set("search", params.search);
  if (params?.sortOrder) search.set("sortOrder", params.sortOrder);
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  const query = search.toString();

  return apiFetch<ContentListResponse>(`/content${query ? `?${query}` : ""}`);
}

export interface UserListResponse {
  items: CurrentUser[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getUsers(params?: {
  page?: number;
  pageSize?: number;
  roleId?: string;
  isActive?: boolean;
  anonymized?: boolean;
  deleted?: boolean;
  q?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.roleId) search.set("roleId", params.roleId);
  if (params?.isActive !== undefined)
    search.set("isActive", String(params.isActive));
  if (params?.anonymized !== undefined)
    search.set("anonymized", String(params.anonymized));
  if (params?.deleted !== undefined)
    search.set("deleted", String(params.deleted));
  if (params?.q) search.set("q", params.q);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  const query = search.toString();

  return apiFetch<UserListResponse>(`/users${query ? `?${query}` : ""}`);
}

// Kanonisch jetzt in packages/blocks (Schritt 2 des Frontend-
// Architekturplans) – hier nur re-exportiert, damit bestehende
// `from "@/lib/api-server"`-Importe dieser drei Typen unverändert bleiben.
export type { ContentTypeField, GlobalModule, MediaVariant };

export interface ContentType {
  id: string;
  name: string;
  slug: string;
  schema: { fields: ContentTypeField[] };
}

export function getContentTypes() {
  return apiFetch<ContentType[]>("/content-types");
}

export function getContentType(id: string) {
  return apiFetch<ContentType>(`/content-types/${id}`);
}

export interface ModuleType {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  schema: { fields: ContentTypeField[] };
}

// Öffentlicher Endpoint (siehe ModuleTypesController) – `publicApiFetch`
// statt `apiFetch`, damit auch die anonyme Vorschau-Seite
// (`/preview/[token]`, kein Login-Cookie) Modul-Typ-Schemas auflösen
// kann, um `Content.data.blocks` zu rendern.
export function getModuleTypes() {
  return publicApiFetch<ModuleType[]>("/module-types");
}

/** Globale Module für ANGEMELDETE Dashboard-Seiten (Block-Editor,
 * Content-Vorschau/Versionen). Seit 2026-09-02 authentifiziert und
 * serverseitig auf die lesbaren Ressourcen gefiltert – vorher lief das
 * über einen `@Public()`-Endpunkt, über den sich Galerien/FAQs von jedem
 * auslesen ließen.
 *
 * Folge im Editor: wer z.B. kein `faq:read` hat, bekommt eingebundene
 * FAQ-Bausteine nicht mehr aufgelöst. Das ist beabsichtigt – die
 * öffentliche AUSGABE der Seite ist davon nicht betroffen, sie läuft über
 * `getPublicGlobalModules()`. */
export function getGlobalModules() {
  return apiFetch<GlobalModule[]>("/global-modules");
}

/** Dieselben Daten ohne Anmeldung – ausschließlich für die anonyme
 * Vorschau-Seite `/preview/[token]`, die keine Session hat. Entspricht
 * dem, was `apps/site` für die öffentliche Website nutzt. */
export function getPublicGlobalModules() {
  return publicApiFetch<GlobalModule[]>("/public/global-modules");
}

export function getGlobalModule(id: string) {
  return apiFetch<GlobalModule>(`/global-modules/${id}`);
}

export interface GlobalModuleListResponse {
  items: GlobalModule[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

// Für die Galerien-/FAQ-Übersicht: paginiert und nach Modul-Typ gefiltert,
// im Gegensatz zu `getGlobalModules()` (liefert immer ALLE globalen Module
// unpaginiert – gebraucht von Stellen, die alle Referenzen zum Auflösen
// brauchen, z.B. Block-Editor und Content-Vorschau).
export function getGlobalModulesPaged(params: {
  moduleTypeId: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams({ moduleTypeId: params.moduleTypeId });
  query.set("page", String(params.page ?? 1));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  return apiFetch<GlobalModuleListResponse>(
    `/global-modules?${query.toString()}`,
  );
}

// Für die Detailsuche-Ergebnisseite (dashboard/search) – höheres Limit als
// die Dropdown-/Command-Palette-Vorschau (max. 50, siehe GlobalSearchDto).
export function getSearchResults(q: string, limit = 50) {
  return apiFetch<SearchResult[]>(
    `/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
}

export interface ContentDetail extends ContentListItem {
  data: Record<string, unknown>;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterCard: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  hideTitle: boolean;
  scheduledFor: string | null;
  lockedBy: AuthorRef | null;
  lockedAt: string | null;
}

export interface PreviewLink {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  createdBy: AuthorRef;
}

export interface PreviewLinkWithContent extends PreviewLink {
  content: { id: string; title: string };
}

export interface PreviewLinkListResponse {
  items: PreviewLinkWithContent[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getAllPreviewLinks(params?: {
  page?: number;
  pageSize?: number;
}) {
  return apiFetch<PreviewLinkListResponse>(
    `/content/preview-links${taxonomyQuery(params)}`,
  );
}

export interface PreviewContent {
  id: string;
  title: string;
  status: ContentStatus;
  data: Record<string, unknown>;
  excerpt: string | null;
  contentType: { id: string; name: string; slug: string };
}

export function getContent(id: string) {
  return apiFetch<ContentDetail>(`/content/${id}`);
}

export function getContentByPreviewToken(token: string) {
  return publicApiFetch<PreviewContent>(`/content/preview/${token}`);
}

export interface ContentVersion {
  id: string;
  data: Record<string, unknown>;
  /** Statusabbild zum Sicherungszeitpunkt – `null` bei Alt-Versionen, die
   * das noch nicht mitgespeichert haben (siehe Schema-Kommentar). */
  status: ContentStatus | null;
  trigger: ContentVersionTrigger | null;
  createdAt: string;
  createdBy: AuthorRef;
}

export interface ContentVersionsResponse {
  items: ContentVersion[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getContentVersions(
  id: string,
  params?: { page?: number; pageSize?: number },
) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return apiFetch<ContentVersionsResponse>(
    `/content/${id}/versions${qs ? `?${qs}` : ""}`,
  );
}

export interface MediaTagRef {
  id: string;
  name: string;
  slug: string;
}

export interface MediaItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  focalX: number | null;
  focalY: number | null;
  thumbnailUrl: string | null;
  createdAt: string;
  uploadedBy: AuthorRef;
  folderId: string | null;
  variants: MediaVariant[];
  tags: MediaTagRef[];
}

export interface MediaListResponse {
  items: MediaItem[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getMediaList(params?: {
  page?: number;
  pageSize?: number;
  folderId?: string;
  type?: string;
  minSize?: number;
  maxSize?: number;
  tagIds?: string[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.folderId) search.set("folderId", params.folderId);
  if (params?.type) search.set("type", params.type);
  if (params?.minSize) search.set("minSize", String(params.minSize));
  if (params?.maxSize) search.set("maxSize", String(params.maxSize));
  if (params?.tagIds && params.tagIds.length > 0)
    search.set("tagIds", params.tagIds.join(","));
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  const query = search.toString();

  return apiFetch<MediaListResponse>(`/media${query ? `?${query}` : ""}`);
}

export function getUnusedMedia(params?: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  return apiFetch<MediaListResponse>(
    `/media/unused${query ? `?${query}` : ""}`,
  );
}

export interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  isSystem: boolean;
  mediaCount: number;
  childCount: number;
}

export function getMediaFolders() {
  return apiFetch<MediaFolder[]>("/media-folders");
}

export interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface TaxonomyListResponse {
  items: TaxonomyItem[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

function taxonomyQuery(params?: {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export interface CategoryListItem extends TaxonomyItem {
  color: string | null;
  contentCount: number;
}

export interface CategoryListResponse {
  items: CategoryListItem[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getCategories(params?: {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  return apiFetch<CategoryListResponse>(`/categories${taxonomyQuery(params)}`);
}

export type CategorySortOrder = "NEWEST" | "OLDEST" | "MANUAL";

export interface CategoryDetail extends TaxonomyItem {
  color: string | null;
  contentCount: number;
  liveCount: number;
  rssEnabled: boolean;
  showFeaturedLarge: boolean;
  sortOrder: CategorySortOrder;
  postsPerPage: number | null;
}

export function getCategory(id: string) {
  return apiFetch<CategoryDetail>(`/categories/${id}`);
}

/** Kategorien-Seite, Anzeige der echten Feed-Adresse in den
 * Kategorie-Einstellungen (Nutzervorgabe, 2026-08-31) – die tatsächlich
 * erreichbare API-Route, keine erfundene Domain (siehe generateFeed() im
 * Backend: es gibt noch keine öffentliche Website/Basis-URL). */
export function getCategoryFeedUrl(id: string) {
  return `${API_URL}/categories/${id}/feed.xml`;
}

export interface TagWithCategoryCount extends TaxonomyItem {
  contentCount: number;
}

/** Kategorien-Seite, Kachel "Tags in dieser Kategorie" – nur Tags, die
 * tatsächlich an einem Beitrag dieser Kategorie hängen. */
export function getCategoryTags(categoryId: string) {
  return apiFetch<TagWithCategoryCount[]>(`/tags/by-category/${categoryId}`);
}

export interface Tag extends TaxonomyItem {
  mediaCount: number;
  createdAt: string;
}

export interface TagListResponse {
  items: Tag[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getTags(params?: {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  return apiFetch<TagListResponse>(`/tags${taxonomyQuery(params)}`);
}

/** Ungefiltert/unpaginiert, für die "Alle Tags"-Übersichtsleiste
 * (Nutzervorgabe, 2026-08-16) – zeigt jeden existierenden Tag, nicht nur
 * die aktuelle Tabellenseite. */
export function getAllTags() {
  return apiFetch<Tag[]>("/tags/all");
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastDeliveryStatus: "success" | "failure" | null;
  lastDeliveryAt: string | null;
  lastDeliveryError: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookListResponse {
  items: Webhook[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    failingCount: number;
  };
}

export function getWebhooks(params?: { page?: number; pageSize?: number }) {
  return apiFetch<WebhookListResponse>(`/webhooks${taxonomyQuery(params)}`);
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
  canAccessDashboard: boolean;
  userCount: number;
  updatedAt: string;
  permissions: string[];
}

export interface RoleListResponse {
  items: Role[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getRoles(params?: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();

  return apiFetch<RoleListResponse>(`/roles${query ? `?${query}` : ""}`);
}

export interface PermissionDescriptor {
  resource: string;
  action: string;
  key: string;
  category: "core" | "extensions" | "administration" | "system";
}

export function getPermissionsCatalog() {
  return apiFetch<PermissionDescriptor[]>("/permissions");
}

export interface AppSettings {
  id: number;
  // Siehe knowledge-base/platform/master-slave-licensing.md.
  deploymentMode: "master" | "slave";
  maintenancePageTitle: string | null;
  maintenancePageMessage: string | null;
  allowRegistration: boolean;
  allowPasswordReset: boolean;
  allowEmailChange: boolean;
  allowAdminEmailChange: boolean;
  requireAdminActivation: boolean;
  autosaveEnabled: boolean;
  mediaResponsiveVariantsEnabled: boolean;
  maintenanceModeEnabled: boolean;
  mediaStorageQuotaMb: number | null;
  maxUploadSizeMb: number | null;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecialChar: boolean;
  allowTwoFactor: boolean;
  requireTwoFactorForAdmins: boolean;
  requireTwoFactorForAll: boolean;
  requireTwoFactorForPublishers: boolean;
  passwordExpiryDays: number | null;
  failedLoginLockoutThreshold: number | null;
  passwordBlockLeaked: boolean;
  passwordPreventReuseEnabled: boolean;
  sessionIdleTimeoutMinutes: number | null;
  accentColor: string | null;
  tableDensity: string;
  sidebarCollapsedByDefault: boolean;
  keyboardShortcutsEnabled: boolean;
  reduceMotion: boolean;
  defaultPageSize: number;
  // Einstellungen → Frontend (öffentliche Website, siehe
  // knowledge-base/frontend/taxonomy-management.md, Update 2026-08-31).
  siteTitle: string | null;
  siteTagline: string | null;
  faviconUrl: string | null;
  defaultSeoDescription: string | null;
  defaultOgImageUrl: string | null;
  publicBaseUrl: string | null;
  mainNavigationId: string | null;
  footerNavigationPrimaryId: string | null;
  footerNavigationSecondaryId: string | null;
  footerNote: string | null;
  /** Globaler Abstand oben/unten ALLER Seiten der Webseite, je Breakpoint
   * (Nutzervorgabe, 2026-09-03). Ein Wert am Menüpunkt sticht den
   * globalen. `null` = kein globaler Abstand. */
  pageSpacingTopMobile: number | null;
  pageSpacingBottomMobile: number | null;
  pageSpacingTopTablet: number | null;
  pageSpacingBottomTablet: number | null;
  pageSpacingTopDesktop: number | null;
  pageSpacingBottomDesktop: number | null;
  /** Gilt der globale Abstand auch auf der Startseite? Ein am
   * Startseiten-Menüpunkt gesetzter Wert bleibt davon unberührt. */
  pageSpacingOnHomepage: boolean;
  /** Werte der Einstellungen, die das Frontend-Template dieser
   * Installation deklariert (2026-09-05). Schlüssel = `key` aus dessen
   * Manifest – die Verwaltung kennt sie nicht, sie rendert generisch. */
  templateSettings: Record<string, unknown> | null;
  /** Hochgeladenes Manifest; sticht die Datei des Frontend-Projekts.
   * `null` = die Datei gilt. */
  templateManifest: TemplateManifest | null;
  backendCacheEnabled: boolean;
  backendCacheTtlSeconds: number;
  frontendCacheEnabled: boolean;
  frontendCacheTtlSeconds: number;
  notifyMaintenanceMode: boolean;
  notifyStorageQuota: boolean;
  notifyWebhookFailures: boolean;
  notifyLocalDrafts: boolean;
  notifyPendingActivations: boolean;
  notifyFailedLogins: boolean;
  notifyPendingPasswordChanges: boolean;
  notifyCompanyIncomplete: boolean;
  notifyLegalDocuments: boolean;
  companyLogoUrl: string | null;
  companyLogoUrlDark: string | null;
  companyName: string | null;
  companyStreet: string | null;
  companyPostalCode: string | null;
  companyCity: string | null;
  companyCountry: string | null;
  companyRepresentative: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyRegisterCourt: string | null;
  companyRegisterNumber: string | null;
  companyVatId: string | null;
  companySupervisoryAuthority: string | null;
  companyDisputeResolution: string | null;
  dpoIsExternal: boolean;
  dpoName: string | null;
  dpoCompany: string | null;
  dpoEmail: string | null;
  dpoPhone: string | null;
  dpoAppointedAt: string | null;
  dpoReportedAt: string | null;
  dpoSupervisoryAuthority: string | null;
  dpoLastContactAt: string | null;
  dpoListInLegalTexts: boolean;
  dpoNotifyOnIncident: boolean;
  dpoMonthlyReportEnabled: boolean;
  retentionFormSubmissionsDays: number | null;
  retentionAccessLogMonths: number;
  retentionDeactivatedAccountsMonths: number;
  retentionTrashDays: number;
  dsbFormSelfServiceDisclosure: boolean;
  dsbFormStoreSubmissionIp: boolean;
  // Formular-Einsendungen (2026-09-02). Die Löschfrist gehört zum
  // Datenschutz-Modul (Reiter "Formulare"), die übrigen drei zu
  // Einstellungen → Mailing → Einsendungen.
  formSubmissionDeleteAfterReadDays: number | null;
  formSubmissionDeleteUnreadAfterDays: number | null;
  formSubmissionNotifyOnNew: boolean;
  formSubmissionRecipientEmail: string | null;
  formSubmissionConfirmationDefault: boolean;
  formSubmissionUnreadReminderDays: number | null;
  dsrAutoAcknowledgeReceipt: boolean;
  dsrDeadlineReminderEnabled: boolean;
  notifyDeletionRequests: boolean;
  notifyTrashExpiring: boolean;
  notifyUnreadSubmissions: boolean;
  // Schwellen der Zählerstand-Plausibilitätsprüfung (2026-09-01),
  // einstellbar unter Einstellungen → Verbindungen → Master-Client.
  statsAnomalyRelativeDropPercent: number;
  statsAnomalyAbsoluteDrop: number;
  notificationRecipientEmail: string | null;
  jobsGloballyPaused: boolean;
  jobRunRetentionDays: number | null;
  activityLogRetentionDays: number | null;
  sccTemplateMediaId: string | null;
  /** Nur bei `getPublicSettings()` (GET /settings/public) vorhanden, nicht bei `getSettings()`. */
  sccTemplateMedia?: { id: string; filename: string; url: string } | null;
  /** Nur bei `getPublicSettings()` (GET /settings/public) vorhanden – Version
   * dieser Installation (Nutzervorgabe, 2026-08-25), siehe
   * apps/api/src/common/utils/app-version.ts. */
  appVersion?: string;
  updatedAt: string;
}

export type PublicSettings = Omit<AppSettings, "id" | "updatedAt">;

export interface CompanyLocation {
  id: string;
  name: string;
  isPrimary: boolean;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  employeeCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export function getCompanyLocations() {
  return apiFetch<CompanyLocation[]>("/company-locations");
}

export interface CompanyChange {
  id: string;
  action: string;
  metadata: { field: string; wasEmpty: boolean } | null;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string };
}

export function getCompanyChanges() {
  return apiFetch<CompanyChange[]>("/settings/company/changes");
}

// "Protokoll"-Tab unter Einstellungen (Nutzervorgabe, 2026-08-22: "baue
// protokolierung"). Gleiches Muster wie CompanyChange, aber mit
// tatsächlichem before/after statt nur wasEmpty (siehe SettingsService.
// update()) und echter Pagination statt festem Limit.
export interface SettingsChangeEntry {
  id: string;
  action: string;
  metadata: { field: string; before: unknown; after: unknown } | null;
  createdAt: string;
  user: { id: string; firstName: string | null; lastName: string };
}

export interface SettingsChangesResponse {
  items: SettingsChangeEntry[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getSettingsChanges(params?: {
  page?: number;
  pageSize?: number;
}) {
  return apiFetch<SettingsChangesResponse>(
    `/settings/changes${taxonomyQuery(params)}`,
  );
}

// Einstellungen → Integrationen, Karte "Dienste" (Nutzervorgabe,
// 2026-08-22: "email versand bauen ... als dienst"). Passwort kommt nie
// mit, nur `hasPassword` (siehe SettingsService.getSmtpSettings()).
export interface SmtpSettings {
  host: string | null;
  port: number | null;
  username: string | null;
  hasPassword: boolean;
  fromAddress: string | null;
  fromName: string | null;
  secure: string;
  verifiedAt: string | null;
  configured: boolean;
}

export function getSmtpSettings() {
  return apiFetch<SmtpSettings>("/settings/smtp");
}

// Einstellungen → Master-Client, Schlüssel-Icon bei "Diese Installation"
// (Nutzervorgabe, 2026-08-24). Key kommt nie mit, nur `hasApiKey` (siehe
// SettingsService.getLicenseClientSettings()).
export interface LicenseClientSettings {
  hasApiKey: boolean;
}

export function getLicenseClientSettings() {
  return apiFetch<LicenseClientSettings>("/settings/license-client");
}

// Einstellungen → "Jobs"-Reiter (Nutzervorgabe, 2026-08-22, 1:1 nach
// Bildvorlage "Geplante Aufgaben"/"Letzte Läufe"). Nur die drei real
// vorhandenen Cron-Jobs (siehe JobsService.definitions im Backend).
export interface ScheduledJob {
  id: string;
  title: string;
  description: string;
  cronExpression: string;
  isPaused: boolean;
  isCritical: boolean;
  notifyOnFailure: boolean;
  effectivelyPaused: boolean;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  totalRuns: number;
  totalErrors: number;
  nextRunAt: string | null;
}

export interface ScheduledJobsResponse {
  items: ScheduledJob[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getJobs(params?: { page?: number; pageSize?: number }) {
  return apiFetch<ScheduledJobsResponse>(`/jobs${taxonomyQuery(params)}`);
}

export interface JobRunEntry {
  id: string;
  jobId: string;
  jobTitle: string;
  startedAt: string;
  durationMs: number;
  status: string;
  message: string | null;
}

export interface JobRunsResponse {
  items: JobRunEntry[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

/** `status` filtert die "Letzte Läufe"-Karte auf einen ihrer Reiter
 * (Nutzervorgabe, 2026-09-03). Ohne Angabe: alle Läufe. */
/** Ungelesene Einsendungen für das Briefsymbol in der Kopfzeile.
 * `null` ohne `form-submissions:read` – das Symbol bleibt dann aus. */
export function getUnreadSubmissionCount() {
  return apiFetch<{ unread: number }>("/forms/submissions/unread-count");
}

export function getJobRuns(params?: {
  page?: number;
  pageSize?: number;
  status?: JobRunStatusFilter;
}) {
  const query = taxonomyQuery(params);
  const suffix = params?.status
    ? `${query ? "&" : "?"}status=${params.status}`
    : "";
  return apiFetch<JobRunsResponse>(`/jobs/runs${query}${suffix}`);
}

/** Die beiden Status, die `JobsService` schreibt – ein dritter Reiter
 * wäre immer leer. */
export type JobRunStatusFilter = "success" | "error";

// Eigener, engerer Endpoint für `company:read` (Nutzervorgabe, 2026-08-21:
// "admin soll aber firma sehen können" – Administrator hat kein
// `settings:*` mehr, aber weiterhin `company:*`, siehe
// SettingsController.getCompany()). `CompanyFieldKey` ist dieselbe
// geteilte Feldliste wie companyFields.ts.
export type CompanySettings = Record<CompanyFieldKey, string>;

export function getCompanySettings() {
  return apiFetch<CompanySettings>("/settings/company");
}

// Eigener, engerer Endpoint für `privacy:read` statt `settings:read`
// (Nutzer-Bugreport, 2026-08-21: "warum habe ich als admin keine
// datenschutz zugriffsrechte, obwohl die rolle vergeben ist" – dieselbe
// Kopplungs-Ursache wie bei company:*, siehe SettingsController.getPrivacy()).
export type PrivacySettings = Pick<
  AppSettings,
  | "dpoIsExternal"
  | "dpoName"
  | "dpoCompany"
  | "dpoEmail"
  | "dpoPhone"
  | "dpoAppointedAt"
  | "dpoReportedAt"
  | "dpoSupervisoryAuthority"
  | "dpoLastContactAt"
  | "dpoListInLegalTexts"
  | "dpoNotifyOnIncident"
  | "dpoMonthlyReportEnabled"
  | "retentionFormSubmissionsDays"
  | "retentionAccessLogMonths"
  | "retentionDeactivatedAccountsMonths"
  | "retentionTrashDays"
  | "dsbFormSelfServiceDisclosure"
  | "dsbFormStoreSubmissionIp"
  | "formSubmissionDeleteAfterReadDays"
  | "formSubmissionDeleteUnreadAfterDays"
  | "dsrAutoAcknowledgeReceipt"
  | "dsrDeadlineReminderEnabled"
  | "sccTemplateMediaId"
>;

export function getPrivacySettings() {
  return apiFetch<PrivacySettings>("/settings/privacy");
}

export function getSettings() {
  return apiFetch<AppSettings>("/settings");
}

export function getPublicSettings() {
  return publicApiFetch<PublicSettings>("/settings/public");
}

// Siehe knowledge-base/platform/master-slave-licensing.md.
export interface LockedPageBranding {
  maintenanceTitle: string | null;
  maintenanceMessage: string | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyCity: string | null;
  accentColor: string | null;
}

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): `modules`/
// `moduleFeatures` kommen jetzt auf Master UND Slave mit (siehe
// EffectiveLicenseStatus im Backend) – Master über seine eigenen
// `ModuleSettings`, Slave signiert vom Master.
export type LicenseState =
  | {
      mode: "master";
      modules: string[];
      moduleFeatures: Record<string, string[]>;
    }
  | { mode: "slave"; status: "unchecked" }
  | {
      mode: "slave";
      status: "live";
      modules: string[];
      moduleFeatures: Record<string, string[]>;
      // Seit 2026-09-02 auch im laufenden Betrieb: der letzte
      // Verbindungsversuch zum Master wurde abgelehnt (Schlüssel passt
      // nicht), die Installation läuft aber noch auf dem zuletzt gültigen
      // Token. Siehe Warnhinweis in master-client-card.tsx.
      keySuspect: boolean;
      lastCheckInAt: string | null;
      lastCheckAttemptAt: string | null;
    }
  | {
      mode: "slave";
      status: "development";
      // Nutzervorgabe, 2026-08-25: "Entwicklermodus wird nach spätestens 3
      // Tagen automatisch gesperrt" – für die "wird gesperrt am ..."-
      // Anzeige im Toast (siehe license-development-toast.tsx).
      developmentModeSince: string | null;
      autoLockAt: string | null;
      modules: string[];
      moduleFeatures: Record<string, string[]>;
      // Seit 2026-09-02 auch im laufenden Betrieb: der letzte
      // Verbindungsversuch zum Master wurde abgelehnt (Schlüssel passt
      // nicht), die Installation läuft aber noch auf dem zuletzt gültigen
      // Token. Siehe Warnhinweis in master-client-card.tsx.
      keySuspect: boolean;
      lastCheckInAt: string | null;
      lastCheckAttemptAt: string | null;
    }
  | {
      mode: "slave";
      status: "pending";
      expiresAt: string;
      modules: string[];
      moduleFeatures: Record<string, string[]>;
      // Seit 2026-09-02 auch im laufenden Betrieb: der letzte
      // Verbindungsversuch zum Master wurde abgelehnt (Schlüssel passt
      // nicht), die Installation läuft aber noch auf dem zuletzt gültigen
      // Token. Siehe Warnhinweis in master-client-card.tsx.
      keySuspect: boolean;
      lastCheckInAt: string | null;
      lastCheckAttemptAt: string | null;
    }
  | ({
      mode: "slave";
      status: "locked";
      // Nutzervorgabe, 2026-08-26: "Login mit Lizenzeingabe darf nur
      // kommen, wenn der Schlüssel ungültig ist" – siehe ausführlicher
      // Kommentar bei `EffectiveLicenseStatus` im Backend
      // (license-client.service.ts).
      keySuspect: boolean;
    } & LockedPageBranding);

// Ergebnis des GERADE eben durchgeführten Prüf-Versuchs (Nutzer-Bugreport,
// 2026-08-24: "Key erneuert, dann ohne was anzupassen geprüft, und alles
// in Ordnung?????") – nur bei `POST /license/recheck`, nicht bei
// `GET /license/state`. Zeigt ehrlich, ob der Versuch selbst gerade
// erfolgreich war, statt nur den (evtl. veralteten) Gesamtstatus.
export interface LicenseCheckOutcome {
  status: "success" | "error";
  message: string;
}
export type LicenseRecheckResult = LicenseState & {
  lastCheck?: LicenseCheckOutcome;
};

/** Öffentlich, unauthentifiziert (GET /license/state) – steuert das
 * Entwicklungsinstanz-Hinweisbanner im Dashboard und die öffentliche
 * Wartungsseite. */
export function getLicenseState() {
  return publicApiFetch<LicenseState>("/license/state");
}

// Kleiner Helfer statt Duplikation der `moduleFeatures`-Prüfung an jeder
// Stelle, die wissen muss, ob ein Modul auf dieser Installation aktiv ist
// (z.B. users/page.tsx für den "sofort anonymisieren statt unter
// Datenschutz ablegen"-Hinweis, Bugreport 2026-08-29). Bewusst NICHT
// `modules.includes(moduleKey)` – ein Modul mit komplett deaktivierten
// Einzel-Features gilt für den Nutzer genauso als "nicht erreichbar" wie
// ein komplett ausgeschaltetes Modul (gleiche Bedingung wie
// `privacy/page.tsx`s Komplett-Sperre und das Backend-Gegenstück
// `UsersService.isDatenschutzModuleActive`).
export function isModuleActive(
  licenseState: LicenseState | null,
  moduleKey: string,
): boolean {
  return Boolean(
    licenseState && "moduleFeatures" in licenseState
      ? (licenseState.moduleFeatures[moduleKey]?.length ?? 0) > 0
      : false,
  );
}

export interface MessageResponse {
  message: string;
}

export interface MediaStorageUsage {
  usedBytes: number;
  quotaMb: number | null;
  percentUsed: number | null;
}

export function getMediaStorageUsage() {
  return apiFetch<MediaStorageUsage>("/media/storage-usage");
}

export interface MediaCounts {
  total: number;
  image: number;
  video: number;
  document: number;
}

export function getMediaCounts(folderId?: string | null) {
  const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
  return apiFetch<MediaCounts>(`/media/counts${query}`);
}

// ---------- Datenschutz-Seite (Verwaltung → Datenschutz, 2026-08-18) ----------

export type LegalDocumentStatus = "current" | "stale" | "missing";

export interface LegalDocument {
  id: string;
  key: string;
  title: string;
  slug: string;
  generatedContent: string;
  manualAddendum: string | null;
  lastGeneratedAt: string | null;
  contentId: string | null;
  contentStatus: "DRAFT" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED" | null;
  status: LegalDocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export function getLegalDocuments() {
  return apiFetch<LegalDocument[]>("/legal-documents");
}

export type DeletionRequestStatus =
  "open" | "in_progress" | "completed" | "rejected";

export type DataSubjectRequestType = "deletion" | "access" | "rectification";

export interface DeletionRequest {
  id: string;
  dsrId: string;
  type: DataSubjectRequestType;
  requesterName: string;
  requesterEmail: string;
  reason: string | null;
  source: string | null;
  affectedRecordsCount: number | null;
  linkedUserId: string | null;
  status: DeletionRequestStatus;
  dueAt: string | null;
  completedAt: string | null;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getDeletionRequests() {
  return apiFetch<DeletionRequest[]>("/deletion-requests");
}

/** "Meine Daten" (Mein Konto → Sicherheit) – eigene, bereits gestellte
 * Anfragen des aufrufenden Nutzers, keine `privacy:read`-Berechtigung
 * nötig (Selbstbedienungs-Endpoint). */
export function getMyDeletionRequests() {
  return apiFetch<DeletionRequest[]>("/deletion-requests/self-service");
}

export interface ProcessingActivity {
  id: string;
  purpose: string;
  legalBasis: string | null;
  dataCategories: string | null;
  retentionPeriod: string | null;
  recipients: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getProcessingActivities() {
  return apiFetch<ProcessingActivity[]>("/processing-activities");
}

export interface DataProcessor {
  id: string;
  name: string;
  purpose: string | null;
  hasContract: boolean;
  contractDate: string | null;
  contractMediaId: string | null;
  contractMedia: {
    id: string;
    filename: string;
    url: string;
    size: number;
  } | null;
  location: string | null;
  complianceNote: string | null;
  outsideEu: boolean;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getDataProcessors() {
  return apiFetch<DataProcessor[]>("/data-processors");
}

export type PrivacyIncidentSeverity = "low" | "medium" | "high";
export type PrivacyIncidentStatus = "open" | "resolved";

export interface PrivacyIncident {
  id: string;
  title: string;
  description: string | null;
  severity: PrivacyIncidentSeverity;
  status: PrivacyIncidentStatus;
  occurredAt: string | null;
  affectedCount: number | null;
  authorityNotifiedAt: string | null;
  subjectsNotifiedAt: string | null;
  measuresDocumented: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getPrivacyIncidents() {
  return apiFetch<PrivacyIncident[]>("/privacy-incidents");
}

export interface RetentionAuditLogEntry {
  id: string;
  action: string;
  createdAt: string;
}

export function getRetentionAccessLogDue() {
  return apiFetch<RetentionAuditLogEntry[]>("/privacy/retention/access-log");
}

export interface RetentionDeactivatedAccount {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string;
  deletedAt: string;
  deadlineAt: string;
  daysLeft: number;
  overdue: boolean;
}

export function getRetentionDeactivatedAccountsDue() {
  return apiFetch<RetentionDeactivatedAccount[]>(
    "/privacy/retention/deactivated-accounts",
  );
}

export interface RetentionTrashItem {
  id: string;
  label: string;
  deletedAt: string;
}

export interface RetentionTrashDue {
  content: RetentionTrashItem[];
  media: RetentionTrashItem[];
  categories: RetentionTrashItem[];
  tags: RetentionTrashItem[];
}

export function getRetentionTrashDue() {
  return apiFetch<RetentionTrashDue>("/privacy/retention/trash");
}

export type TrashType =
  "content" | "media" | "categories" | "tags" | "gallery" | "faq" | "forms";

export interface TrashItem {
  id: string;
  type: TrashType;
  title: string;
  subtitle: string | null;
  deletedAt: string;
  deletedBy: { id: string; firstName: string | null; lastName: string } | null;
  sizeBytes: number | null;
  expiresAt: string;
  daysLeft: number;
  expired: boolean;
}

export interface TrashStats {
  total: number;
  expiringSoonCount: number;
  storageBytes: number;
  retentionDays: number;
  typesCount: number;
  countsByType: Partial<Record<TrashType, number>>;
}

export interface TrashListResult {
  items: TrashItem[];
  stats: TrashStats;
}

export function getTrash(filter?: { type?: TrashType; q?: string }) {
  const params = new URLSearchParams();
  if (filter?.type) params.set("type", filter.type);
  if (filter?.q) params.set("q", filter.q);
  const search = params.toString();
  return apiFetch<TrashListResult>(`/trash${search ? `?${search}` : ""}`);
}

// ---------- Formulare & Mailing ----------

export type FormStatus = "draft" | "published" | "paused";

export interface FormFieldOption {
  id: string;
  type: string;
  label: string;
  required: boolean;
  /** Prozentuale Breite (10-100), siehe form-field.types.ts. */
  width: number;
  options?: string[];
  /** Nur für "radio"/"checkbox" – Anordnung der Optionen. */
  optionsLayout?: "vertical" | "horizontal";
  helpText?: string;
  /** `undefined`/`true` = Titel sichtbar. */
  showLabel?: boolean;
  /** Nur für "privacy_notice" – Verlinkung auf eine Content-Seite. */
  privacyPageSlug?: string;
  privacyPageTitle?: string;
}

export interface FormListItem {
  id: string;
  name: string;
  slug: string;
  status: FormStatus;
  fields: FormFieldOption[];
  emailFieldId: string | null;
  sendConfirmation: boolean;
  submitButtonText: string;
  submitButtonAlign: "left" | "center" | "right";
  redirectUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { submissions: number };
  unreadSubmissions: number;
}

export interface FormListResponse {
  items: FormListItem[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface FormDetail extends Omit<
  FormListItem,
  "_count" | "unreadSubmissions"
> {
  submissionCount: number;
}

export function getForms(params?: {
  page?: number;
  pageSize?: number;
  status?: FormStatus;
  q?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.status) search.set("status", params.status);
  if (params?.q) search.set("q", params.q);
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  const query = search.toString();
  return apiFetch<FormListResponse>(`/forms${query ? `?${query}` : ""}`);
}

export function getForm(id: string) {
  return apiFetch<FormDetail>(`/forms/${id}`);
}

export interface FormStats {
  total: number;
  published: number;
  draft: number;
  paused: number;
  submissionsLast30Days: number;
  unread: number;
}

export function getFormStats() {
  return apiFetch<FormStats>("/forms/stats");
}

export interface FormSubmission {
  id: string;
  formId: string;
  values: Record<string, unknown>;
  submitterIp: string | null;
  isRead: boolean;
  createdAt: string;
  form?: { id: string; name: string; slug: string; fields?: FormFieldOption[] };
}

export interface FormSubmissionListResponse {
  items: FormSubmission[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getFormSubmissions(
  formId: string,
  params?: { page?: number; pageSize?: number; isRead?: boolean },
) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.isRead !== undefined) search.set("isRead", String(params.isRead));
  const query = search.toString();
  return apiFetch<FormSubmissionListResponse>(
    `/forms/${formId}/submissions${query ? `?${query}` : ""}`,
  );
}

export function getAllFormSubmissions(params?: {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.isRead !== undefined) search.set("isRead", String(params.isRead));
  if (params?.sortBy) search.set("sortBy", params.sortBy);
  if (params?.sortDir) search.set("sortDir", params.sortDir);
  const query = search.toString();
  return apiFetch<FormSubmissionListResponse>(
    `/forms/submissions${query ? `?${query}` : ""}`,
  );
}

export type MailTemplateCategory = "auth" | "privacy" | "forms" | "system";

export interface MailTemplateListItem {
  id: string;
  category: MailTemplateCategory;
  label: string;
  subject: string;
  body: string;
  enabled: boolean;
  recipientTo: string | null;
  recipientEditable: boolean;
  placeholders: string[];
  placeholderLabels?: Record<string, string>;
  isCustomized: boolean;
  formId: string | null;
  // Welche E-Mail-Template-Hülle beim Versand verwendet wird (Nutzervorgabe,
  // 2026-08-30: "bei allen Vorlagen soll man das Template aussuchen
  // können") – `null` = Standard-Hülle der Installation.
  shellId: string | null;
}

export function getMailTemplates() {
  return apiFetch<MailTemplateListItem[]>("/settings/mail-templates");
}

export interface MailShellListItem {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  updatedAt: string;
  usedByCount: number;
}

export function getMailShells() {
  return apiFetch<MailShellListItem[]>("/settings/mail-shells");
}

export type WebsiteStatus = "live" | "development" | "locked";

// Einzelnes Teilergebnis eines "Wecken"-Durchlaufs (Nutzervorgabe,
// 2026-08-25: "schreibe alle Prüfungen untereinander, die OK sind mit
// Haken, die nicht OK mit X").
export interface WebsiteCheckItem {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface WebsiteListItem {
  id: string;
  name: string;
  domain: string;
  status: WebsiteStatus;
  deploymentMode: "master" | "slave";
  // Mandantenfähigkeit, 2026-08-27 – jede Website gehört zu genau einem
  // Mandanten (siehe MandantListItem).
  mandantId: string;
  mandant: {
    id: string;
    name: string;
    logoUrl: string | null;
    // Am Mandanten gebuchte, aktive Module – auf der Webseiten-Kachel als
    // Icons rechts neben den Zahlen (Nutzervorgabe, 2026-09-01).
    modules: { moduleKey: string }[];
  };
  testUrl: string | null;
  lastCheckInAt: string | null;
  // Ergebnis des letzten "Wecken"-Diagnose-Durchlaufs (Nutzervorgabe,
  // 2026-08-24: "soll den Status ausgeben, der gerade ist, z.B. ob der Key
  // korrekt ist") – `lastWakeupOk: null` = noch nie geprüft.
  lastWakeupAt: string | null;
  lastWakeupOk: boolean | null;
  lastWakeupMessage: string | null;
  // Von der Installation selbst gemeldete Version (Semver+Commit-Hash),
  // zuletzt beim "Wecken"/"Prüfen" eingeholt (Nutzervorgabe, 2026-08-25:
  // "damit man den aktuellen Stand ermitteln kann").
  lastReportedVersion: string | null;
  // Von der Installation beim "Prüfen" selbst gemeldete Größe
  // (Nutzervorgabe, 2026-09-01) – Selbstauskunft der Slave-Seite, kein
  // Master-seitiger Datenbankzugriff; `null`, solange nie erfolgreich
  // geprüft wurde.
  reportedPageCount: number | null;
  reportedUserCount: number | null;
  // Plausibilitätsprüfung dieser Selbstauskünfte (2026-09-01): gesetzt,
  // wenn ein gemeldeter Wert unglaubwürdig eingebrochen ist. Bleibt
  // stehen, bis jemand ihn quittiert.
  statsAnomalyAt: string | null;
  statsAnomalyMessage: string | null;
  // Vom Client zuletzt selbst bestätigter Lizenzstatus (Nutzervorgabe,
  // 2026-08-25: "hier die entsprechenden Badges nehmen") – nur bei
  // erfolgreicher Prüfung gesetzt, sonst bleibt der letzte bekannte Stand.
  lastReportedLicenseStatus: WebsiteStatus | null;
  // Detail-Aufschlüsselung des letzten Checks für das Info-Popup (siehe
  // website-check-details-dialog.tsx) – `null`, solange noch nie geprüft.
  lastCheckChecks: WebsiteCheckItem[] | null;
  createdAt: string;
  updatedAt: string;
}

/** Verlauf der von den Installationen gemeldeten Zählerstände – eine Zeile
 * je Änderung, nicht je Prüfung (siehe WebsiteStatsReport im Schema).
 * `lastReportedAt` sagt, bis wann dieser Stand zuletzt bestätigt wurde. */
export interface WebsiteStatsReport {
  id: string;
  pageCount: number;
  userCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  website: { id: string; name: string; domain: string };
}

export interface WebsiteStatsHistoryResponse {
  items: WebsiteStatsReport[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getWebsiteStatsHistory(params?: {
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return apiFetch<WebsiteStatsHistoryResponse>(
    `/websites/stats-history${qs ? `?${qs}` : ""}`,
  );
}

export interface WebsiteListResponse {
  items: WebsiteListItem[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface WebsiteCheckAllResult {
  checkedAt: string;
  results: {
    id: string;
    name: string;
    domain: string;
    ok: boolean;
    message: string;
    version: string | null;
    licenseStatus: WebsiteStatus | null;
    checks: WebsiteCheckItem[];
  }[];
}

export function getWebsites(params?: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  return apiFetch<WebsiteListResponse>(`/websites${query ? `?${query}` : ""}`);
}

// ---------- Mandantenfähigkeit ----------
// Nutzervorgabe, 2026-08-27: ein Mandant ist der eigentliche Kunde des
// Masters und kann mehrere Website-Installationen haben. Modul-Buchung
// liegt am Mandanten, nicht an der einzelnen Website.
// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): manche Module
// gliedern sich in einzeln (de)aktivierbare Unter-Features (bei
// Datenschutz: die 7 Reiter von /dashboard/privacy).
export interface ModuleFeatureEntry {
  key: string;
  label: string;
}

export interface ModuleCatalogEntry {
  key: string;
  label: string;
  description: string;
  category: "compliance" | "integration";
  features?: ModuleFeatureEntry[];
}

export interface MandantWebsite {
  id: string;
  name: string;
  domain: string;
  status: WebsiteStatus;
}

export interface MandantListItem {
  id: string;
  name: string;
  status: "active" | "inactive" | "locked";
  lockReason: string | null;
  logoUrl: string | null;
  legalName: string | null;
  representativeName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  registerInfo: string | null;
  vatId: string | null;
  createdAt: string;
  updatedAt: string;
  websites: MandantWebsite[];
  modules: {
    moduleKey: string;
    enabled: boolean;
    enabledFeatures: string[];
  }[];
}

export interface MandantListResponse {
  items: MandantListItem[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface MandantStats {
  mandantsTotal: number;
  mandantsActive: number;
  websitesTotal: number;
  moduleBookingsTotal: number;
  modulesAvailableCount: number;
  lockedOrInactiveCount: number;
  withLockReasonCount: number;
}

export function getMandanten(params?: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  return apiFetch<MandantListResponse>(`/mandanten${query ? `?${query}` : ""}`);
}

export function getMandantStats() {
  return apiFetch<MandantStats>("/mandanten/stats");
}

export function getMandant(id: string) {
  return apiFetch<MandantListItem>(`/mandanten/${id}`);
}

export function getMandantModuleCatalog() {
  return apiFetch<ModuleCatalogEntry[]>("/mandanten/modules");
}

// Datenschutz-als-Modul (Nutzervorgabe, 2026-08-28): Masters EIGENE
// Modul-/Feature-Freischaltung ("Master wird nicht über Mandanten
// geregelt") – editierbar unter Einstellungen → Module.
export interface ModuleSettingsEntry {
  moduleKey: string;
  label: string;
  category: "compliance" | "integration";
  /** Nur relevant für Einstellungen → Module (settings-form.tsx filtert
   * danach) – Administration → Module zeigt weiterhin alle. */
  usedByMasterItself: boolean;
  features: ModuleFeatureEntry[];
  enabled: boolean;
  enabledFeatures: string[];
  autoInstallForNewMandants: boolean;
}

export function getModuleSettings() {
  return apiFetch<ModuleSettingsEntry[]>("/module-settings");
}

export type NotificationCategory =
  "system" | "security" | "privacy" | "accounts";

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  actorName: string | null;
  isUrgent: boolean;
  actionLabel: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export function getNotifications() {
  return apiFetch<AppNotification[]>("/notifications");
}

/**
 * Das Manifest des Frontend-Templates dieser Installation – serverseitig,
 * für Seiten, die die Bereichsliste schon beim Rendern brauchen
 * (Inhalte → Bereiche).
 *
 * Die Staffelung der Adresse entspricht `resolveSiteBaseUrl` in
 * `lib/site-base-url.ts`, kommt hier aber ohne `Request` aus: gepflegte
 * Basis-URL, sonst `SITE_URL`, sonst der Entwicklungs-Port. Der letzte
 * Schritt dort (gleiche Origin) entfällt – ohne Request gibt es keine.
 *
 * `null` ist kein Fehler: die Website kann gerade nicht laufen, oder ihr
 * Template bringt kein Manifest mit. Die Seite zeigt dann einen Hinweis.
 */
export async function getTemplateManifest(): Promise<TemplateManifest | null> {
  const settings = await getPublicSettings();
  const base =
    settings?.publicBaseUrl?.replace(/\/+$/, "") ||
    process.env.SITE_URL?.replace(/\/+$/, "") ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3002" : null);
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/template`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as TemplateManifest;
  } catch {
    return null;
  }
}

/** Bausteine eines Bereichs (`{ blocks: [...] }`), leer wenn nie
 * bearbeitet. */
export async function getTemplateRegion(key: string) {
  return apiFetch<{
    key: string;
    data: Record<string, unknown>;
    updatedAt: string | null;
  }>(`/template-regions/${encodeURIComponent(key)}`);
}
