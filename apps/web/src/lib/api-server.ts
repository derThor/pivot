import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth";
import type { SearchResult } from "./search";
import type { CompanyFieldKey } from "./company-fields";

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

export interface ContentListItem {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: string;
  contentType: { id: string; name: string; slug: string };
  author: AuthorRef;
  categories: CategoryRef[];
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
  contentId: string | null;
  content: {
    id: string;
    title: string;
    slug: string;
    status: ContentStatus;
  } | null;
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
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
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
  const query = search.toString();

  return apiFetch<UserListResponse>(`/users${query ? `?${query}` : ""}`);
}

export interface ContentTypeField {
  name: string;
  type: string;
  required?: boolean;
  // Nur für Modul-Felder relevant: Feld ist eine Einstellung (z.B. Alt-Text,
  // Link-Ziel) statt echter, sichtbarer Inhalt – wird im Block-Editor daher
  // nicht inline auf der Fläche gerendert, sondern im Optionen-Popup.
  option?: boolean;
  // Nur für Modul-Felder relevant: reine CSS-Darstellungs-Hinweise für die
  // Inline-Vorschau im Block-Editor (kein echtes Rendering der späteren
  // Frontend-Optik, dafür ist pivot als Headless-CMS zu themenunabhängig).
  // "cover" gilt nur für `type: "image"`-Felder: markiert das Bild eines
  // Cover-Bausteins als Vollflächen-Hintergrund statt normaler
  // Fließ-/Ausrichtungs-Logik (siehe isCoverModuleType).
  variant?: "button" | "quote" | "caption" | "cover";
  // Nur für Modul-Felder relevant: Beispielwert, mit dem eine neu
  // eingefügte Modul-Instanz vorbefüllt wird, damit man beim Einfügen
  // sofort sieht, wie der Baustein aussieht, statt eine leere Fläche.
  // `unknown` statt `string`, weil Repeater-Beispieldaten Arrays sind.
  example?: unknown;
  // Nur für `type: "repeater"`: Schema der Unterfelder pro Listen-Eintrag
  // (z.B. Frage/Antwort bei FAQ, Bild/Bildunterschrift bei einer Galerie).
  fields?: ContentTypeField[];
}

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

export interface GlobalModule {
  id: string;
  name: string;
  values: Record<string, unknown>;
  // Anzeige-Einstellungen der Instanz (z.B. Swiper-Konfiguration bei
  // Galerien) – siehe gallery-settings.ts für Parsing/Defaults.
  settings?: Record<string, unknown> | null;
  moduleTypeId: string;
  moduleType: { id: string; name: string; icon: string | null };
  createdAt: string;
  updatedAt: string;
}

// Öffentlicher Endpoint (siehe GlobalModulesController) – aus demselben
// Grund wie `getModuleTypes()`: Block-Editor UND die anonyme Vorschau-Seite
// müssen die aktuellen Werte eines eingebundenen globalen Moduls live
// auflösen können.
export function getGlobalModules() {
  return publicApiFetch<GlobalModule[]>("/global-modules");
}

export function getGlobalModule(id: string) {
  return publicApiFetch<GlobalModule>(`/global-modules/${id}`);
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
  return publicApiFetch<GlobalModuleListResponse>(
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

export interface MediaVariant {
  id: string;
  width: number;
  format: string;
  url: string;
  size: number;
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

function taxonomyQuery(params?: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getCategories(params?: { page?: number; pageSize?: number }) {
  return apiFetch<TaxonomyListResponse>(`/categories${taxonomyQuery(params)}`);
}

export interface Tag extends TaxonomyItem {
  mediaCount: number;
  createdAt: string;
}

export interface TagListResponse {
  items: Tag[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getTags(params?: { page?: number; pageSize?: number }) {
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
  dsrAutoAcknowledgeReceipt: boolean;
  dsrDeadlineReminderEnabled: boolean;
  notifyDeletionRequests: boolean;
  notifyTrashExpiring: boolean;
  notificationRecipientEmail: string | null;
  jobsGloballyPaused: boolean;
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

export function getJobRuns(params?: { page?: number; pageSize?: number }) {
  return apiFetch<JobRunsResponse>(`/jobs/runs${taxonomyQuery(params)}`);
}

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

export type LicenseState =
  | { mode: "master" }
  | { mode: "slave"; status: "live" | "unchecked" }
  | {
      mode: "slave";
      status: "development";
      // Nutzervorgabe, 2026-08-25: "Entwicklermodus wird nach spätestens 3
      // Tagen automatisch gesperrt" – für die "wird gesperrt am ..."-
      // Anzeige im Toast (siehe license-development-toast.tsx).
      developmentModeSince: string | null;
      autoLockAt: string | null;
    }
  | { mode: "slave"; status: "pending"; expiresAt: string }
  | ({ mode: "slave"; status: "locked" } & LockedPageBranding);

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
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.status) search.set("status", params.status);
  if (params?.q) search.set("q", params.q);
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
}) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.isRead !== undefined) search.set("isRead", String(params.isRead));
  const query = search.toString();
  return apiFetch<FormSubmissionListResponse>(
    `/forms/submissions${query ? `?${query}` : ""}`,
  );
}

export type MailTemplateCategory = "auth" | "privacy" | "forms";

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
}

export function getMailTemplates() {
  return apiFetch<MailTemplateListItem[]>("/settings/mail-templates");
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
