import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  ShieldCheck,
  Truck,
  PackageX,
  Wrench,
  Users,
  Settings,
} from "lucide-react";

type Item = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  roles?: AppRole[];
  adminOnly?: boolean;
};

type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Operação",
    items: [
      { label: "Mapa", to: "/", icon: LayoutDashboard },
      { label: "Entregas", to: "/entregas", icon: Truck },
      { label: "Recolhas", to: "/recolhas", icon: PackageX },
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Pedidos", to: "/pedidos-venda", icon: ClipboardList },
      { label: "Novo pedido", to: "/pedidos-venda/novo", icon: PlusCircle, roles: ["vendedor", "admin"] },
      { label: "Aprovações", to: "/pedidos-venda/aprovacoes", icon: ShieldCheck, roles: ["aprovador", "admin"] },
      { label: "Integração ERP", to: "/settings/erp", icon: Wrench, adminOnly: true },
    ],
  },
  {
    label: "Administração",
    items: [
      { label: "Usuários", to: "/admin/users", icon: Users, adminOnly: true, disabled: true },
      { label: "Configurações", to: "/settings/mapa", icon: Settings },
    ],
  },
];

export function AppSidebar({
  role,
  isAdmin,
  onNavigate,
}: {
  role: AppRole | null;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visible = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (i.adminOnly) return isAdmin;
      if (i.roles && role && !i.roles.includes(role) && !isAdmin) return false;
      return true;
    }),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-semibold">
          E
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">ERP Operacional</div>
          <div className="truncate text-[11px] text-sidebar-foreground/70">Pedidos e Entregas</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visible.map((g) => (
          <div key={g.label} className="mb-6">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {g.label}
            </div>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const Icon = i.icon;
                const active =
                  i.to === "/"
                    ? pathname === "/"
                    : pathname === i.to || pathname.startsWith(i.to + "/");
                if (i.disabled) {
                  return (
                    <li key={i.to}>
                      <div className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/40">
                        <Icon className="h-4 w-4" />
                        <span>{i.label}</span>
                        <span className="ml-auto rounded bg-sidebar-accent/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                          em breve
                        </span>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={i.to}>
                    <Link
                      to={i.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{i.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-foreground/50">
        v1 · Uso interno
      </div>
    </div>
  );
}