import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMapWindow, useSetMapWindow } from "@/hooks/use-operations";
import { useMyRoles } from "@/hooks/use-auth";
import {
  MAP_WINDOW_OPTIONS,
  mapWindowLabel,
  parseMapWindow,
  type MapWindow,
} from "@/lib/operations/history";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/settings/mapa")({
  head: () => ({
    meta: [
      { title: "Configurações do mapa — Operação" },
      {
        name: "description",
        content:
          "Defina por quanto tempo entregas concluídas continuam visíveis no mapa operacional.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Configurações do mapa" },
      {
        property: "og:description",
        content: "Janela de exibição de entregas concluídas no mapa.",
      },
    ],
  }),
  component: MapSettingsPage,
});

function MapSettingsPage() {
  const { data: roles } = useMyRoles();
  const isAdmin = (roles ?? []).includes("admin");
  const windowQ = useMapWindow();
  const setM = useSetMapWindow();

  const current: MapWindow = windowQ.data ?? 7;

  async function onChange(v: string) {
    const w = parseMapWindow(v === "always" ? "always" : Number(v));
    try {
      await setM.mutateAsync(w);
      toast.success("Configuração salva", {
        description: `Concluídos visíveis por ${mapWindowLabel(w).toLowerCase()}.`,
      });
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: (err as Error)?.message ?? String(err),
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-4 md:p-6">
      <PageHeader
        title="Configurações"
        description="Preferências globais da operação."
      />

      <section className="mt-4 rounded-lg border bg-surface p-4">
        <h2 className="text-sm font-semibold">Mapa</h2>
        <div className="mt-3 space-y-2">
          <label className="text-sm font-medium" htmlFor="map-window">
            Exibir entregas concluídas por
          </label>
          <Select
            value={String(current)}
            onValueChange={onChange}
            disabled={!isAdmin || setM.isPending || windowQ.isLoading}
          >
            <SelectTrigger id="map-window" className="h-10 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAP_WINDOW_OPTIONS.map((o) => (
                <SelectItem key={String(o)} value={String(o)}>
                  {mapWindowLabel(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Essa configuração altera somente a exibição no mapa. O histórico
            permanece salvo.
          </p>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">
              Somente administradores podem alterar esta configuração.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
