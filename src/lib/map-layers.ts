import type { LucideIcon } from "lucide-react";
import { Truck, Sparkles, PackageCheck, PackageOpen, PackageX, Bell } from "lucide-react";

export type MapLayerKey =
  | "pedidos"
  | "higienizacao"
  | "entregues"
  | "liberados"
  | "recolhidos"
  | "avisar";

export interface MapLayerDef {
  key: MapLayerKey;
  label: string;
  short: string;
  colorVar: string;
  icon: LucideIcon;
  helper: string;
}

export const MAP_LAYERS: MapLayerDef[] = [
  {
    key: "pedidos",
    label: "Pedidos do dia",
    short: "Pedidos",
    colorVar: "var(--map-pedido)",
    icon: Truck,
    helper: "Pedidos com entrega prevista para a data selecionada.",
  },
  {
    key: "higienizacao",
    label: "Higienização",
    short: "Higienização",
    colorVar: "var(--map-higienizacao)",
    icon: Sparkles,
    helper: "Equipamentos aguardando processo de higienização.",
  },
  {
    key: "entregues",
    label: "Entregues",
    short: "Entregues",
    colorVar: "var(--map-entregue)",
    icon: PackageCheck,
    helper: "Equipamentos entregues aguardando recolha.",
  },
  {
    key: "liberados",
    label: "Liberados",
    short: "Liberados",
    colorVar: "var(--map-liberado)",
    icon: PackageOpen,
    helper: "Equipamentos liberados para recolha.",
  },
  {
    key: "recolhidos",
    label: "Recolhidos",
    short: "Recolhidos",
    colorVar: "var(--map-recolhido)",
    icon: PackageX,
    helper: "Equipamentos recolhidos no dia.",
  },
  {
    key: "avisar",
    label: "Cliente irá avisar",
    short: "Avisar",
    colorVar: "var(--map-avisar)",
    icon: Bell,
    helper: "Clientes que sinalizaram que irão avisar.",
  },
];