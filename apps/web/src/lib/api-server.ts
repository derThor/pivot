import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "./auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001/v1";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "EDITOR" | "AUTHOR" | "VIEWER";
  avatarUrl: string | null;
  isActive: boolean;
}

export type ContentStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export interface ContentListItem {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  updatedAt: string;
  contentType: { id: string; name: string; slug: string };
  author: { id: string; name: string };
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

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
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

export function getUsers() {
  return apiFetch<CurrentUser[]>("/users");
}

export interface ContentTypeField {
  name: string;
  type: string;
  required?: boolean;
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

export interface ContentDetail extends ContentListItem {
  data: Record<string, unknown>;
}

export function getContent(id: string) {
  return apiFetch<ContentDetail>(`/content/${id}`);
}

export interface MediaItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  alt: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

export interface MediaListResponse {
  items: MediaItem[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function getMediaList(params?: { page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();

  return apiFetch<MediaListResponse>(`/media${query ? `?${query}` : ""}`);
}

export interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
}

export function getCategories() {
  return apiFetch<TaxonomyItem[]>("/categories");
}

export function getTags() {
  return apiFetch<TaxonomyItem[]>("/tags");
}
