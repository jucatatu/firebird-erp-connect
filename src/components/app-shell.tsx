import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { BottomNav } from "./bottom-nav";
import type { AppRole } from "@/hooks/use-auth";

export function AppShell({
  children,
  fullName,
  email,
  role,
  isAdmin,
  variant = "default",
}: {
  children: ReactNode;
  fullName: string;
  email?: string;
  role: AppRole | null;
  isAdmin: boolean;
  variant?: "default" | "fullBleed";
}) {
  const isFullBleed = variant === "fullBleed";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 md:block">
        <AppSidebar role={role} isAdmin={isAdmin} />
      </aside>
      <div className="flex min-h-screen flex-col md:pl-60">
        <AppTopbar fullName={fullName} email={email} role={role} isAdmin={isAdmin} />
        {isFullBleed ? (
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
        ) : (
          <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        )}
      </div>
      <BottomNav role={role} isAdmin={isAdmin} />
    </div>
  );
}