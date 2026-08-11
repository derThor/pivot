import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { ChangePasswordForm } from "@/components/change-password-form";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser, getPublicSettings } from "@/lib/api-server";

export default async function AccountPage() {
  const [user, publicSettings] = await Promise.all([
    getCurrentUser(),
    getPublicSettings(),
  ]);

  if (!user) {
    redirect("/login");
  }

  const passwordPolicy = publicSettings ?? {
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecialChar: true,
  };

  return (
    <div className="flex max-w-[550px] flex-col gap-4">
      <PageHeader title="Konto" />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="security">Sicherheit</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <AccountForm
            user={user}
            allowEmailChange={publicSettings?.allowEmailChange ?? true}
          />
        </TabsContent>
        <TabsContent value="security">
          <ChangePasswordForm passwordPolicy={passwordPolicy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
