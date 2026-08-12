import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { NoDashboardAccess } from "@/components/no-dashboard-access";
import { getCurrentUser, getPublicSettings } from "@/lib/api-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, settings] = await Promise.all([
    getCurrentUser(),
    getPublicSettings(),
  ]);
  if (!user) {
    redirect("/login");
  }

  if (user.canAccessDashboard === false) {
    return <NoDashboardAccess user={user} />;
  }

  // Cookie-Name muss mit SIDEBAR_COOKIE_NAME in ui/sidebar.tsx übereinstimmen.
  // Kann nicht importiert werden: sidebar.tsx ist "use client", einfache
  // Konstanten-Exports daraus werden beim Import in eine Server Component
  // zu Client-Referenzen statt echten Werten (kein string mehr).
  const sidebarState = (await cookies()).get("sidebar_state")?.value;
  const defaultOpen = sidebarState !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        user={user}
        logoExpandedUrl={settings?.logoExpandedUrl}
        logoCollapsedUrl={settings?.logoCollapsedUrl}
        companyName={settings?.companyName}
      />
      <SidebarInset>
        {!user.emailVerifiedAt && <EmailVerificationBanner />}
        <DashboardHeader
          user={user}
          defaultPageSize={settings?.defaultPageSize ?? 10}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-6 bg-background px-6 pt-[40px] pb-[40px] sm:px-16">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
