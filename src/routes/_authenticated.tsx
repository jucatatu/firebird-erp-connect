import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Loader2, UserX, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useMyProfile, useMyRoles, primaryRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { ForcePasswordChange } from "@/components/admin/ForcePasswordChange";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const isFullBleed = useMemo(() => {
    return location.pathname === "/";
  }, [location.pathname]);

  if (!checked || !user || rolesQ.isLoading || profileQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Verifica se o usuário deve trocar a senha
  if (profileQ.data?.must_change_password === true) {
    return (
      <ForcePasswordChange 
        onLogout={handleLogout}
        onSuccess={() => profileQ.refetch()}
      />
    );
  }

  // Verifica se o usuário está desativado
  if (profileQ.data?.active === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <UserX className="h-10 w-10" />
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Conta desativada</h1>
        <p className="mb-8 max-w-sm text-muted-foreground">
          Seu acesso ao ERP Operacional está desativado. Entre em contato com um administrador.
        </p>
        <Button 
          variant="outline" 
          onClick={handleLogout}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    );
  }

  const roles = rolesQ.data ?? [];
  const role = primaryRole(roles);
  const isAdmin = roles.includes("admin");
  const fullName = profileQ.data?.full_name || user.email || "Usuário";

  return (
    <AppShell 
      fullName={fullName} 
      email={user.email ?? undefined} 
      role={role} 
      isAdmin={isAdmin}
      variant={isFullBleed ? "fullBleed" : "default"}
    >
      <Outlet />
    </AppShell>
  );
}
