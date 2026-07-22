import { Link, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon, Truck, PackageX, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/hooks/use-auth";

type Tab = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (path: string) => boolean;
};

function tabsFor(_role: AppRole | null, _isAdmin: boolean): Tab[] {
  return [
    { to: "/", label: "Mapa", icon: MapIcon, match: (p) => p === "/" },
    { to: "/entregas", label: "Entregas", icon: Truck, match: (p) => p.startsWith("/entregas") },
    { to: "/recolhas", label: "Recolhas", icon: PackageX, match: (p) => p.startsWith("/recolhas") },
    { to: "/settings/erp", label: "Mais", icon: MoreHorizontal, match: (p) => p.startsWith("/settings") || p.startsWith("/pedidos-venda") },
  ];
}

export function BottomNav({ role, isAdmin }: { role: AppRole | null; isAdmin: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = tabsFor(role, isAdmin);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.match ? t.match(pathname) : pathname === t.to;
        return (
          <Link
            key={t.to + t.label}
            to={t.to}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-primary")} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}