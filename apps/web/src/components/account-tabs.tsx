"use client";

import { useState } from "react";

import { AccountForm } from "@/components/account-form";
import { Button } from "@/components/ui/button";
import { ChangePasswordForm } from "@/components/change-password-form";
import { PageContent } from "@/components/page-content";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CurrentUser } from "@/lib/api-server";
import type { PasswordPolicy } from "@/lib/password-policy";

const PROFILE_FORM_ID = "account-profile-form";
const PASSWORD_FORM_ID = "account-password-form";

/** Trägt Tab-Zustand + Speichern-Button außerhalb der Client-Grenze, da
 * account/page.tsx (Server Component) selbst kein `useState` haben kann.
 * Der Button referenziert das jeweils aktive `<form>` per `form={id}`
 * (natives HTML) statt in der weißen Fläche zu liegen – siehe
 * content-editor-form.tsx/global-module-form-dialog.tsx für dasselbe
 * Muster bei einem einzelnen Formular. */
export function AccountTabs({
  user,
  allowEmailChange,
  passwordPolicy,
}: {
  user: CurrentUser;
  allowEmailChange: boolean;
  passwordPolicy: PasswordPolicy;
}) {
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <PageContent>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="security">Sicherheit</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <AccountForm
              user={user}
              allowEmailChange={allowEmailChange}
              formId={PROFILE_FORM_ID}
              onSubmittingChange={setIsSubmitting}
            />
          </TabsContent>
          <TabsContent value="security">
            <ChangePasswordForm
              passwordPolicy={passwordPolicy}
              formId={PASSWORD_FORM_ID}
              onSubmittingChange={setIsSubmitting}
            />
          </TabsContent>
        </Tabs>
      </PageContent>

      <PageContent plain className="mt-10 items-start">
        <Button
          type="submit"
          form={activeTab === "profile" ? PROFILE_FORM_ID : PASSWORD_FORM_ID}
          disabled={isSubmitting}
        >
          {activeTab === "profile"
            ? isSubmitting
              ? "Speichert…"
              : "Profil speichern"
            : isSubmitting
              ? "Ändert…"
              : "Passwort ändern"}
        </Button>
      </PageContent>
    </>
  );
}
