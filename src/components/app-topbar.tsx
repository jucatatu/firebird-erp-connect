import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar } from "./app-sidebar";
import { ErpStatusIndicator } from "./erp-status-indicator";
import type { AppRole } from "@/hooks/use-auth";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function roleLabel(role: AppRole | null) {
  if (role === "admin") return "Administrador";
  if (role === "aprovador") return "Aprovador";
  if (role === "vendedor") return "Vendedor";
  return "Sem papel";
}

export function AppTopbar({
  fullName,
  email,
  role,
  isAdmin,
}: {
  fullName: string;
  email?: string;
  role: AppRole | null;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-surface px-3 md:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <AppSidebar role={role} isAdmin={isAdmin} />
          </SheetContent>
        </Sheet>
        <div className="hidden text-xs capitalize text-muted-foreground md:block">{today}</div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden sm:block">
          <ErpStatusIndicator />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-full border bg-surface py-1 pl-1 pr-3 text-sm transition-colors hover:bg-muted"
              aria-label="Menu do usuário"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-semibold uppercase text-primary-foreground">
                {initials(fullName) || "U"}
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block max-w-[10rem] truncate text-xs font-medium">{fullName}</span>
                <span className="block text-[10px] text-muted-foreground">{roleLabel(role)}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{fullName}</div>
              {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
              <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {roleLabel(role)}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserIcon className="mr-2 h-4 w-4" /> Meu perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}