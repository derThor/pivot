"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Monitor, ShieldCheck, ShieldOff } from "lucide-react";

import { AccountForm } from "@/components/account-form";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ExportProfileButton } from "@/components/export-profile-button";
import { TwoFactorSetupCard } from "@/components/two-factor-setup-card";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { PaginationControls } from "@/components/pagination-controls";
import { SelfServiceRequestCard } from "@/components/self-service-request-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mediaUrl } from "@/lib/media";
import { formatName, formatRelativeTime, initials } from "@/lib/utils";
import type {
  CurrentUser,
  DeletionRequest,
  Role,
  UserSession,
} from "@/lib/api-server";
import type { PasswordPolicy } from "@/lib/password-policy";

const PROFILE_FORM_ID = "my-account-profile-form";
const PASSWORD_FORM_ID = "my-account-password-form";
const SESSIONS_PAGE_SIZE = 5;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function MyAccountView({
  user,
  allowEmailChange,
  allowTwoFactor,
  passwordPolicy,
  primaryRole,
  weeklyStats,
  sessions,
  myDeletionRequests,
}: {
  user: CurrentUser;
  allowEmailChange: boolean;
  allowTwoFactor: boolean;
  passwordPolicy: PasswordPolicy;
  primaryRole: Role | null;
  weeklyStats: { contentCount: number; mediaCount: number };
  sessions: UserSession[];
  myDeletionRequests: DeletionRequest[];
}) {
  const name = formatName(user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  // Landet der Nutzer per middleware.ts-Weiterleitung hier (mustChangePassword
  // oder twoFactorSetupRequired), soll direkt der Sicherheit-Tab offen sein
  // statt Profil – dort passiert der eigentlich nötige Schritt. Das hat
  // Vorrang vor einem `?tab=`-Deep-Link aus dem Header-Menü (Sicherheit
  // sperrt den Zugriff auf alles andere ohnehin über middleware.ts).
  const tabParam = searchParams.get("tab");
  const initialTab =
    user.mustChangePassword || user.twoFactorSetupRequired ? "security"
    : tabParam === "security" || tabParam === "display" ||
      tabParam === "notifications" ?
      tabParam
    : "profile";
  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "display" | "notifications"
  >(initialTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionsState, setSessionsState] = useState(sessions);
  const [sessionsPage, setSessionsPage] = useState(1);
  const sessionsPageCount = Math.max(
    1,
    Math.ceil(sessionsState.length / SESSIONS_PAGE_SIZE),
  );
  const visibleSessions = sessionsState.slice(
    (sessionsPage - 1) * SESSIONS_PAGE_SIZE,
    sessionsPage * SESSIONS_PAGE_SIZE,
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarFile(file);
    setAvatarCropOpen(true);
  }

  async function handleRevokeSession(sessionId: string) {
    await fetch(`/api/auth/me/sessions/${sessionId}`, { method: "DELETE" });
    setSessionsState((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      const maxPage = Math.max(1, Math.ceil(next.length / SESSIONS_PAGE_SIZE));
      setSessionsPage((page) => Math.min(page, maxPage));
      return next;
    });
  }

  async function handleRevokeOtherSessions() {
    await fetch("/api/auth/me/sessions/revoke-others", { method: "POST" });
    setSessionsState((prev) => prev.filter((s) => s.isCurrent));
  }

  const activeFormId =
    activeTab === "profile"
      ? PROFILE_FORM_ID
      : activeTab === "security"
        ? PASSWORD_FORM_ID
        : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mein Konto</h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex items-center gap-2">
          <ExportProfileButton user={user} />
          {activeFormId && (
            <Button type="submit" form={activeFormId} disabled={isSubmitting}>
              {isSubmitting
                ? activeTab === "profile"
                  ? "Speichert…"
                  : "Ändert…"
                : activeTab === "profile"
                  ? "Profil speichern"
                  : "Passwort ändern"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[#E5E5E5] bg-card shadow-sm p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="size-14">
            {user.avatarUrl && (
              <AvatarImage src={mediaUrl({ url: user.avatarUrl })} />
            )}
            <AvatarFallback className="bg-neutral-900 text-lg font-medium text-white">
              {initials(user)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{name}</span>
              {user.roles.map((role) => (
                <Badge
                  key={role.id}
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                >
                  {role.name}
                </Badge>
              ))}
              {allowTwoFactor && (
                <Badge
                  variant="secondary"
                  className={
                    user.twoFactorEnabled
                      ? "gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : "gap-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                  }
                >
                  {user.twoFactorEnabled ? (
                    <ShieldCheck className="size-3" />
                  ) : (
                    <ShieldOff className="size-3" />
                  )}
                  {user.twoFactorEnabled ? "2FA aktiv" : "2FA inaktiv"}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{user.email}</span>
              <span>Dabei seit {formatDate(user.createdAt)}</span>
            </div>
          </div>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <Button
            type="button"
            variant="outline"
            className="border-[#D4D4D4]"
            onClick={() => fileInputRef.current?.click()}
          >
            Foto ändern
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="security">Sicherheit</TabsTrigger>
          <TabsTrigger value="display">Darstellung</TabsTrigger>
          <TabsTrigger value="notifications">Benachrichtigungen</TabsTrigger>
        </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <AccountForm
                  user={user}
                  allowEmailChange={allowEmailChange}
                  formId={PROFILE_FORM_ID}
                  onSubmittingChange={setIsSubmitting}
                />
              </div>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-[#E5E5E5] bg-card shadow-sm p-6">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">
                    Meine Rolle
                  </h3>
                  <p className="mt-2 text-lg font-semibold">
                    {user.roles.map((role) => role.name).join(", ") || "–"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {primaryRole?.description ??
                      "Änderungen an der eigenen Rolle sind nicht möglich."}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E5E5] bg-card shadow-sm p-6">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">
                    Diese Woche
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-semibold">
                        {weeklyStats.contentCount}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        Seiten
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold">
                        {weeklyStats.mediaCount}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        Medien
                      </div>
                    </div>
                  </div>
                </div>
                <SelfServiceRequestCard requests={myDeletionRequests} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security">
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-4 lg:col-span-2">
                <ChangePasswordForm
                  passwordPolicy={passwordPolicy}
                  formId={PASSWORD_FORM_ID}
                  onSubmittingChange={setIsSubmitting}
                />
                <TwoFactorSetupCard
                  enabled={user.twoFactorEnabled}
                  enabledAt={user.twoFactorEnabledAt}
                  allowTwoFactor={allowTwoFactor}
                />
              </div>
              <div className="rounded-xl border border-[#E5E5E5] bg-card shadow-sm p-6">
                <h3 className="text-xs font-medium text-muted-foreground uppercase">
                  Meine Sitzungen
                </h3>
                {sessionsState.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Keine aktiven Sitzungen.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {visibleSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-3"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Monitor className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {session.device}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {session.isCurrent
                                ? "aktuelle Sitzung"
                                : formatRelativeTime(session.createdAt)}
                            </p>
                          </div>
                        </div>
                        {session.isCurrent ? (
                          <Badge
                            variant="secondary"
                            className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                          >
                            aktiv
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                            onClick={() => handleRevokeSession(session.id)}
                          >
                            beenden
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <PaginationControls
                  page={sessionsPage}
                  pageCount={sessionsPageCount}
                  onPageChange={setSessionsPage}
                />
                {sessionsState.some((s) => !s.isCurrent) && (
                  <button
                    type="button"
                    className="mt-2 self-start rounded-xl border border-[#E5E5E5] bg-transparent px-3 py-2 text-[12.5px] font-medium text-destructive transition-colors duration-150 hover:bg-destructive/5"
                    onClick={handleRevokeOtherSessions}
                  >
                    Alle anderen Sitzungen beenden
                  </button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="display">
            <div className="rounded-xl border border-[#E5E5E5] bg-card shadow-sm p-6">
              <h2 className="font-semibold">Darstellung</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Persönliche Anzeige-Einstellungen sind in Vorbereitung und
                folgen in einem späteren Ausbauschritt.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className="rounded-xl border border-[#E5E5E5] bg-card shadow-sm p-6">
              <h2 className="font-semibold">Benachrichtigungen</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Persönliche Benachrichtigungs-Einstellungen sind in
                Vorbereitung und folgen in einem späteren Ausbauschritt.
              </p>
            </div>
          </TabsContent>
      </Tabs>

      <AvatarCropDialog
        file={avatarFile}
        open={avatarCropOpen}
        onOpenChange={setAvatarCropOpen}
      />
    </div>
  );
}
