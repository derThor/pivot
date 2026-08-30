"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Download, Monitor, ShieldCheck, ShieldOff } from "lucide-react";

import { toastEdited, toastDeleted } from "@/components/app-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { ExportProfileButton } from "@/components/export-profile-button";
import { PaginationControls } from "@/components/pagination-controls";
import { UserActivityTimeline } from "@/components/user-activity-timeline";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type {
  ActivityLogResponse,
  CurrentUser,
  Role,
  UserSession,
} from "@/lib/api-server";
import { mediaUrl } from "@/lib/media";
import {
  cn,
  formatName,
  formatRelativeTime,
  initials,
  truncateMiddle,
} from "@/lib/utils";

const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().min(1, "Nachname ist erforderlich."),
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  department: z.string().optional(),
  phone: z.string().optional(),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  roleIds: z.array(z.string()).min(1, "Mindestens eine Rolle wählen."),
  mustChangePassword: z.boolean(),
});
type ProfileValues = z.infer<typeof profileSchema>;

const SESSIONS_PAGE_SIZE = 5;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE");
}

export function UserEditView({
  user,
  roles,
  allowEmailChange,
  allowTwoFactor,
  viewerId,
  viewerPermissions,
  viewerIsAdministrator,
  viewerIsPivot,
  sessions,
  stats,
  activity,
  datenschutzActive,
}: {
  user: CurrentUser;
  roles: Role[];
  allowEmailChange: boolean;
  allowTwoFactor: boolean;
  viewerId: string;
  viewerPermissions: string[];
  viewerIsAdministrator: boolean;
  /** Nur Pivot darf die Pivot-Rolle vergeben (Nutzervorgabe, 2026-08-21:
   * "admin darf sich auch nicht die pivot rolle geben") – strenger als
   * `viewerIsAdministrator`, das Administrator UND Pivot einschließt. */
  viewerIsPivot: boolean;
  sessions: UserSession[];
  stats: { contentCount: number; mediaCount: number };
  activity: ActivityLogResponse;
  /** Bugreport, 2026-08-29: ist der Reiter "Nutzer" unter Datenschutz
   * nirgends erreichbar (Modul komplett aus oder alle Features
   * einzeln deaktiviert), anonymisiert `UsersService.delete()`
   * serverseitig sofort statt in die Warteschlange zu legen – der
   * Bestätigungstext muss das widerspiegeln. */
  datenschutzActive: boolean;
}) {
  const router = useRouter();
  const name = formatName(user);
  const isSelf = user.id === viewerId;
  const targetIsAdministrator = user.roles.some((role) =>
    ["Administrator", "Pivot"].includes(role.name),
  );

  const canDeactivate = viewerPermissions.includes("users:deactivate");
  const canDelete = viewerPermissions.includes("users:delete");
  const canImpersonate = viewerPermissions.includes("users:impersonate");

  const [isActive, setIsActive] = useState(user.isActive);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDisablingTwoFactor, setIsDisablingTwoFactor] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [isExportingActivity, setIsExportingActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.firstName ?? "",
      lastName: user.lastName,
      email: user.email,
      department: user.department ?? "",
      phone: user.phone ?? "",
      street: user.street ?? "",
      postalCode: user.postalCode ?? "",
      city: user.city ?? "",
      roleIds: user.roles.map((role) => role.id),
      mustChangePassword: user.mustChangePassword,
    },
  });

  async function onSubmit(values: ProfileValues) {
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName || undefined,
          lastName: values.lastName,
          email: values.email,
          department: values.department || undefined,
          phone: values.phone || undefined,
          street: values.street || undefined,
          postalCode: values.postalCode || undefined,
          city: values.city || undefined,
          roleIds: values.roleIds,
          mustChangePassword: values.mustChangePassword,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.message ?? "Änderungen konnten nicht gespeichert werden.",
        );
        return;
      }
      toastEdited(`„${name}“ wurde gespeichert.`);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar. Bitte später erneut versuchen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLock() {
    setIsTogglingActive(true);
    try {
      await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      setIsActive(false);
      toastEdited(`„${name}“ wurde gesperrt.`);
      router.refresh();
    } finally {
      setIsTogglingActive(false);
    }
  }

  async function handleUnlock() {
    setIsTogglingActive(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        setIsActive(true);
        toastEdited(`„${name}“ wurde entsperrt.`);
        router.refresh();
      }
    } finally {
      setIsTogglingActive(false);
    }
  }

  async function handleResetPassword() {
    setIsResetting(true);
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        toastEdited(body?.message ?? "Link zum Zurücksetzen wurde gesendet.");
      }
    } finally {
      setIsResetting(false);
    }
  }

  // Notausgang bei Geräteverlust ohne gültigen Recovery-Code – anders als
  // die Self-Service-Deaktivierung (Konto-Seite) ohne Passwort-Bestätigung,
  // der Admin bestätigt sich bereits über sein eigenes users:update-Recht.
  async function handleDisableTwoFactor() {
    setIsDisablingTwoFactor(true);
    try {
      const res = await fetch(`/api/users/${user.id}/disable-2fa`, {
        method: "POST",
      });
      if (res.ok) {
        toastEdited(
          `Zwei-Faktor-Authentifizierung für „${name}“ wurde deaktiviert.`,
        );
        router.refresh();
      }
    } finally {
      setIsDisablingTwoFactor(false);
    }
  }

  async function handleImpersonate() {
    setIsImpersonating(true);
    try {
      const res = await fetch(`/api/users/${user.id}/impersonate`, {
        method: "POST",
      });
      if (res.ok) {
        window.location.assign("/dashboard");
        return;
      }
    } finally {
      setIsImpersonating(false);
    }
  }

  // "Nutzer löschen" (Nutzervorgabe, 2026-08-21): löst NICHT mehr direkt
  // die Anonymisierung aus, sondern nur noch den reversiblen Löschen-
  // Zustand (`deletedAt`) – der Nutzer verschwindet aus dieser Liste und
  // taucht unter Datenschutz → "Nutzer" auf. Erst von dort aus wird
  // endgültig anonymisiert. Ist Datenschutz nicht aktiv, anonymisiert
  // `UsersService.delete()` serverseitig direkt (siehe `datenschutzActive`
  // oben) – dieser Aufruf bleibt derselbe, nur das Backend-Verhalten und
  // der Bestätigungstext unten unterscheiden sich.
  async function handleExportActivity() {
    setIsExportingActivity(true);
    try {
      const res = await fetch(`/api/users/${user.id}/activity/export`);
      if (!res.ok) return;
      // `res.blob()` statt `res.text()`: `text()` entfernt laut WHATWG-Spec
      // ein führendes UTF-8-BOM beim Dekodieren, Excel zeigt Umlaute dann
      // als Mojibake (gleiches Muster wie SettingsExportCard).
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `aktivitaet-${name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingActivity(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/users/${user.id}/delete`, { method: "POST" });
    toastDeleted(`„${name}“ wurde gelöscht.`);
    router.push("/dashboard/users");
  }

  async function handleRevokeSession(sessionId: string) {
    await fetch(`/api/users/${user.id}/sessions/${sessionId}`, {
      method: "DELETE",
    });
    setSessionsState((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      const maxPage = Math.max(1, Math.ceil(next.length / SESSIONS_PAGE_SIZE));
      setSessionsPage((page) => Math.min(page, maxPage));
      return next;
    });
  }

  async function handleRevokeOthers() {
    await fetch(`/api/users/${user.id}/sessions/revoke-others`, {
      method: "POST",
    });
    setSessionsState((prev) => prev.filter((s) => s.isCurrent));
    setSessionsPage(1);
    toastEdited("Alle anderen Sitzungen wurden beendet.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <DashboardBreadcrumbs />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border"
            onClick={() => router.push("/dashboard/users")}
          >
            ‹ Zurück
          </Button>
          <ExportProfileButton user={user} />
          <Button
            type="button"
            variant="outline"
            className="border-border"
            disabled={isResetting}
            onClick={handleResetPassword}
          >
            {isResetting ? "Sendet…" : "Passwort zurücksetzen"}
          </Button>
          <Button type="submit" form="user-edit-form" disabled={isSaving}>
            {isSaving ? "Speichert…" : "Änderungen speichern"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl bg-card shadow-sm p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="size-14">
            {user.avatarUrl && (
              <AvatarImage src={mediaUrl({ url: user.avatarUrl })} />
            )}
            <AvatarFallback className="bg-dark-surface text-lg font-medium text-white">
              {initials(user)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{name}</span>
              <Badge
                variant="secondary"
                className={
                  isActive ? "badge--green border-0" : "badge--ink border-0"
                }
              >
                {isActive ? "Aktiv" : "Gesperrt"}
              </Badge>
              {allowTwoFactor && (
                <Badge
                  variant="secondary"
                  className={
                    user.twoFactorEnabled
                      ? "badge--green gap-1 border-0"
                      : "badge--ink gap-1 border-0"
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
              <span>
                Rolle: {user.roles.map((role) => role.name).join(", ")}
              </span>
              <span>Dabei seit {formatDate(user.createdAt)}</span>
              <span>
                {user.lastLoginAt
                  ? `Zuletzt aktiv ${formatRelativeTime(user.lastLoginAt)}`
                  : "Noch nie angemeldet"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canImpersonate && !isSelf && !targetIsAdministrator && isActive && (
            <Button
              type="button"
              variant="outline"
              className="border-border"
              disabled={isImpersonating}
              onClick={handleImpersonate}
            >
              Als Nutzer ansehen
            </Button>
          )}
          {canDeactivate &&
            !isSelf &&
            (isActive ? (
              <ConfirmDeleteDialog
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border text-destructive"
                  >
                    Sperren
                  </Button>
                }
                title={`„${name}“ sperren?`}
                description="Der Zugriff wird sofort entzogen. Über „Entsperren“ lässt sich das Konto jederzeit wieder aktivieren."
                confirmLabel="Sperren"
                confirmingLabel="Sperrt…"
                onConfirm={handleLock}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="border-border"
                disabled={isTogglingActive}
                onClick={handleUnlock}
              >
                Entsperren
              </Button>
            ))}
        </div>
      </div>

      <form id="user-edit-form" onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs defaultValue="profil" className="gap-4">
          <TabsList>
            <TabsTrigger value="profil">Profil</TabsTrigger>
            <TabsTrigger value="zugang">Zugang & Sicherheit</TabsTrigger>
            <TabsTrigger value="aktivitaet">Aktivität</TabsTrigger>
          </TabsList>

          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

          <TabsContent value="profil">
            <Form {...form}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-6 rounded-xl bg-card shadow-sm p-6 lg:col-span-2">
                  <h2 className="font-semibold">Stammdaten</h2>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground uppercase">
                            Vorname
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground uppercase">
                            Name
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground uppercase">
                            E-Mail
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              disabled={!allowEmailChange}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground uppercase">
                            Telefon
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground uppercase">
                            Abteilung
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div />
                    <FormField
                      control={form.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel className="text-xs text-muted-foreground uppercase">
                            Straße und Hausnummer
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground uppercase">
                            PLZ
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground uppercase">
                            Ort
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <FormField
                    control={form.control}
                    name="roleIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold text-foreground">
                          Rolle
                        </FormLabel>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {roles.map((role) => {
                            const checked = field.value.includes(role.id);
                            const isPivotRole = role.name === "Pivot";
                            const isAdminRole = role.name === "Administrator";
                            const disabled =
                              (isPivotRole && !viewerIsPivot) ||
                              (isAdminRole && !viewerIsAdministrator);
                            return (
                              <label
                                key={role.id}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm",
                                  checked
                                    ? "border-primary bg-primary/10"
                                    : "border-border",
                                  disabled && "cursor-not-allowed opacity-50",
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={disabled}
                                  onCheckedChange={(next) => {
                                    field.onChange(
                                      next
                                        ? [...field.value, role.id]
                                        : field.value.filter(
                                            (id) => id !== role.id,
                                          ),
                                    );
                                  }}
                                />
                                {role.name}
                              </label>
                            );
                          })}
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Rechte kommen aus der Rolle. Einzelrechte lassen sich
                          unter{" "}
                          <Link
                            href="/dashboard/roles"
                            className="font-semibold text-foreground hover:underline"
                          >
                            Rollen & Rechte
                          </Link>{" "}
                          anpassen.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-xl bg-card shadow-sm p-6">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase">
                      Aktivität
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-semibold">
                          {stats.contentCount}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase">
                          Seiten
                        </div>
                      </div>
                      <div>
                        <div className="text-2xl font-semibold">
                          {stats.mediaCount}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase">
                          Medien
                        </div>
                      </div>
                    </div>
                  </div>

                  {canDelete && !isSelf && (
                    <div className="flex flex-col gap-3 rounded-xl bg-card shadow-sm p-6">
                      <h3 className="font-semibold text-destructive">
                        Konto entfernen
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {datenschutzActive
                          ? "Der Nutzer wird aus der Benutzerliste entfernt und erscheint stattdessen unter Datenschutz → „Benutzer“. Die endgültige Anonymisierung erfolgt erst von dort aus."
                          : "Das Datenschutz-Modul ist auf dieser Installation nicht aktiv – der Nutzer wird deshalb sofort und unwiderruflich anonymisiert."}
                      </p>
                      <ConfirmDeleteDialog
                        trigger={
                          <Button
                            variant="outline"
                            className="w-full border-border text-destructive"
                          >
                            Benutzer löschen
                          </Button>
                        }
                        title={`„${truncateMiddle(name)}“ löschen?`}
                        description={
                          datenschutzActive
                            ? "Wird aus der Benutzerliste entfernt und steht unter Datenschutz → „Benutzer“ zur endgültigen Anonymisierung bereit."
                            : "Datenschutz ist nicht aktiv: Der Nutzer wird sofort und unwiderruflich anonymisiert, nicht nur gelöscht."
                        }
                        onConfirm={handleDelete}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Form>
          </TabsContent>

          <TabsContent value="zugang">
            <Form {...form}>
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-4 lg:col-span-2">
                  <div className="flex flex-col gap-4 rounded-xl bg-card shadow-sm p-6">
                    <h2 className="font-semibold">Anmeldung</h2>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted p-4">
                        <div>
                          <p className="text-sm font-medium">
                            Zwei-Faktor-Authentifizierung
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {!allowTwoFactor
                              ? "Systemweit deaktiviert (siehe Einstellungen)"
                              : user.twoFactorEnabled
                                ? "Vom Nutzer selbst eingerichtet"
                                : "Vom Nutzer noch nicht eingerichtet"}
                          </p>
                        </div>
                        {allowTwoFactor && user.twoFactorEnabled ? (
                          <ConfirmDeleteDialog
                            trigger={
                              <Button
                                type="button"
                                variant="outline"
                                className="border-border"
                                disabled={isDisablingTwoFactor}
                              >
                                Deaktivieren
                              </Button>
                            }
                            title="Zwei-Faktor-Authentifizierung deaktivieren?"
                            description={`Entfernt den zweiten Faktor von „${name}“ – z.B. bei Verlust des Geräts ohne verbliebenen Recovery-Code. Der Nutzer kann 2FA anschließend erneut einrichten.`}
                            confirmLabel="Deaktivieren"
                            confirmingLabel="Deaktiviert…"
                            onConfirm={handleDisableTwoFactor}
                          />
                        ) : (
                          <Switch checked={false} disabled />
                        )}
                      </div>
                      <FormField
                        control={form.control}
                        name="mustChangePassword"
                        render={({ field }) => (
                          <div className="flex items-center justify-between rounded-lg border border-border bg-muted p-4">
                            <p className="text-sm font-medium">
                              Passwortwechsel bei nächster Anmeldung erzwingen
                            </p>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </div>
                        )}
                      />
                    </div>

                    <Separator />

                    <h2 className="font-semibold">Aktive Sitzungen</h2>
                    {sessionsState.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Keine aktiven Sitzungen.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {visibleSessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-muted p-4"
                          >
                            <div className="flex items-center gap-3">
                              <Monitor className="size-4 shrink-0 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">
                                  {session.device}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {session.ipAddress ?? "Unbekannte IP"} ·{" "}
                                  {formatRelativeTime(session.createdAt)}
                                </p>
                              </div>
                            </div>
                            {session.isCurrent ? (
                              <Badge
                                variant="secondary"
                                className="badge--green border-0"
                              >
                                aktiv
                              </Badge>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-border bg-card"
                                onClick={() => handleRevokeSession(session.id)}
                              >
                                Abmelden
                              </Button>
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
                        className="self-start rounded-xl border border-border bg-transparent px-3 py-2 text-[12.5px] font-medium text-destructive transition-colors duration-150 hover:bg-destructive/5"
                        onClick={handleRevokeOthers}
                      >
                        Alle anderen Sitzungen beenden
                      </button>
                    )}
                  </div>
                </div>

                <div className="h-fit rounded-xl bg-card shadow-sm p-6">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase">
                    Konto
                  </h3>
                  <div className="mt-3 flex flex-col divide-y divide-border text-sm">
                    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <span className="text-muted-foreground">Benutzer-ID</span>
                      <span className="font-mono text-xs">{user.id}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <span className="text-muted-foreground">Erstellt</span>
                      <span>{formatDate(user.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <span className="text-muted-foreground">
                        Letzter Login
                      </span>
                      <span>
                        {user.lastLoginAt
                          ? formatRelativeTime(user.lastLoginAt)
                          : "–"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <span className="text-muted-foreground">
                        Fehlversuche
                      </span>
                      <span>{user.failedLoginAttempts}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Form>
          </TabsContent>

          <TabsContent value="aktivitaet">
            <div className="rounded-xl bg-card shadow-sm p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Verlauf</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border"
                  onClick={handleExportActivity}
                  disabled={activity.meta.total === 0 || isExportingActivity}
                >
                  <Download className="size-4" />
                  {isExportingActivity ? "Exportiert…" : "Export"}
                </Button>
              </div>
              <UserActivityTimeline userId={user.id} initialData={activity} />
            </div>
          </TabsContent>
        </Tabs>
      </form>
    </div>
  );
}
