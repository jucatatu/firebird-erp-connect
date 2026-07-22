import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useMyProfile, useMyRoles, primaryRole } from "@/hooks/use-auth";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setUser(data.session.user);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      if (!s) navigate({ to: "/login", replace: true });
      else setUser(s.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const rolesQ = useMyRoles(user);
  const profileQ = useMyProfile(user);

  if (!checked || !user || rolesQ.isLoading || profileQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const roles = rolesQ.data ?? [];
  const role = primaryRole(roles);
  const isAdmin = roles.includes("admin");
  const fullName = profileQ.data?.full_name || user.email || "Usuário";

  return (
    <AppShell fullName={fullName} email={user.email ?? undefined} role={role} isAdmin={isAdmin}>
      <Outlet />
    </AppShell>
  );
}