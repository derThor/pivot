import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "./auth";
import type { SearchResult } from "./search";

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
  isActive: boolean;
  emailVerifiedAt: string | null;
  role: UserRoleRef;
  /** Nur bei getCurrentUser() (GET /auth/me) vorhanden, nicht bei getUsers(). */
  permissions?: string[];
  /** Nur bei getCurrentUser() (GET /auth/me) vorhanden, nicht bei getUsers(). */
  canAccessDashboard?: boolean;
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
  contentId: string | null;
  content: { id: string; title: string; slug: string; status: ContentStatus } | null;
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

export function getUsers(params?: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
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

export function getUnusedMedia() {
  return apiFetch<{ items: MediaItem[] }>("/media/unused");
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

export function getTags(params?: { page?: number; pageSize?: number }) {
  return apiFetch<TaxonomyListResponse>(`/tags${taxonomyQuery(params)}`);
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookListResponse {
  items: Webhook[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
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

export function getPermissionsCatalog() {
  return apiFetch<string[]>("/permissions");
}

export interface AppSettings {
  id: number;
  allowRegistration: boolean;
  allowPasswordReset: boolean;
  allowEmailChange: boolean;
  requireAdminActivation: boolean;
  autosaveEnabled: boolean;
  mediaResponsiveVariantsEnabled: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecialChar: boolean;
  defaultPageSize: number;
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
  updatedAt: string;
}

export type PublicSettings = Omit<AppSettings, "id" | "updatedAt">;

export function getSettings() {
  return apiFetch<AppSettings>("/settings");
}

export function getPublicSettings() {
  return publicApiFetch<PublicSettings>("/settings/public");
}

export interface MessageResponse {
  message: string;
}
