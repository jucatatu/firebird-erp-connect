import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, ClipboardList, PlusCircle, Wrench, LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

interface NavItem {
  label: string;
  to: string;
  icon: typeof Home;
  requireAdmin?: boolean;
}

const ITEMS: NavItem[] = [
  { label: "Início", to: "/", icon: Home },
  { label: "Pedidos", to: "/orders", icon: ClipboardList },
  { label: "Novo pedido", to: "/orders/new", icon: PlusCircle },
  { label: "Diagnóstico ERP", to: "/settings/erp", icon: Wrench, requireAdmin: true },
];

export function AppShell({
  children,
  fullName,
  role,
  isAdmin,
}: {
  children: ReactNode;
  fullName: string;
  role: AppRole | null;
  isAdmin: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const items = ITEMS.filter((i) => !i.requireAdmin || isAdmin);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const Nav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {items.map((i) => {
        const Icon = i.icon;
        const active = i.to === "/" ? pathname === "/" : pathname === i.to || pathname.startsWith(i.to + "/");
        return (
          <Link
            key={i.to}
            to={i.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const roleLabel =
    role === "admin" ? "Administrador" : role === "aprovador" ? "Aprovador" : role === "vendedor" ? "Vendedor" : "Sem papel";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-card">
          <div className="flex h-16 items-center border-b px-4">
            <div className="text-sm font-semibold tracking-tight">ERP · Pedidos</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <Nav />
          </div>
          <div className="border-t p-3">
            <div className="mb-2">
              <div className="truncate text-sm font-medium">{fullName}</div>
              <div className="text-xs text-muted-foreground">{roleLabel}</div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <div className="flex h-16 items-center border-b px-4 text-sm font-semibold">
                    ERP · Pedidos
                  </div>
                  <div className="p-3">
                    <Nav />
                  </div>
                </SheetContent>
              </Sheet>
              <div className="text-sm text-muted-foreground md:hidden">ERP · Pedidos</div>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <div className="text-right">
                <div className="text-sm font-medium leading-none">{fullName}</div>
                <div className="text-xs text-muted-foreground">{roleLabel}</div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}