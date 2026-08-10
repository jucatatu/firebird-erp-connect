import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  const [session, setSession] = useState<any>(null);
  const { reset } = useOrderFormStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = () => {
    reset();
    toast.success("Estado do formulário resetado com sucesso.");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background p-8">
      <div className="flex flex-col items-center justify-center text-center mb-12">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Firebird ERP Bridge</h1>
        <p className="mb-8 max-w-lg text-lg text-muted-foreground">
          Integração operacional em tempo real entre o app de vendas e o banco de dados Firebird.
        </p>
        
        {!session ? (
          <a 
            href="/login" 
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Acessar Sistema
          </a>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">Bem-vindo, {session.user.email}</p>
            <button 
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:underline"
            >
              Resetar Formulário de Pedido
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-muted/30 rounded-lg border border-border font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[800px]">
        <h2 className="text-xl font-bold mb-4 font-sans tracking-tight text-green-600">SPRINT 8.9.10 — OTIMIZAÇÃO DE CHOPEIRAS + CICLO DE VIDA CONCLUÍDA</h2>
        
        {"Foram corrigidas as regressões de sugestão de equipamentos e persistência de estado.\n\n"}

        {"==================================================\n"}
        {"1. OTIMIZAÇÃO DE CHOPEIRAS (VIAS)\n"}
        {"==================================================\n"}
        {"- Sugestão por Vias: Agora calculada pelo número de produtos distintos de CHOPP (logistics_type=draft), não pelo volume.\n"}
        {"- Algoritmo de Minimização: O sistema agora prioriza equipamentos que cubram as vias necessárias com a menor quantidade física (ex: 1x 2 vias ao invés de 2x 1 via).\n"}
        {"- Metadados Reais: A regra agora utiliza os campos 'equipment_role' e 'tap_count' adicionados ao catálogo, eliminando a dependência de parsing de texto.\n\n"}

        {"==================================================\n"}
        {"2. CICLO DE VIDA DO FORMULÁRIO\n"}
        {"==================================================\n"}
        {"- Reset Explícito: O estado agora é limpo deliberadamente ao clicar em 'Novo Pedido' na listagem ou após sucesso/falha.\n"}
        {"- Preservação Transacional: Durante o preenchimento (wizard), o Zustand continua preservando os dados entre os passos.\n"}
        {"- Isolamento por Empresa: Correção na validação de reset ao trocar de empresa para evitar itens órfãos.\n\n"}

        {"==================================================\n"}
        {"3. CHOPEIRA CONTINUA OPCIONAL\n"}
        {"==================================================\n"}
        {"- A sugestão é automática, mas a validação bloqueante de vias foi removida. O pedido segue se os barris cobrirem a litragem.\n\n"}

        {"==================================================\n"}
        {"ENTREGA FINAL\n"}
        {"==================================================\n"}
        {"1. Migração Supabase: Adicionados equipment_role e tap_count em order_catalog_settings.\n"}
        {"2. Novo Pedido: Botão na lista agora dispara resetItemsAndClient().\n"}
        {"3. ProductCard: Preservados botões rápidos 10L/20L/30L/50L.\n"}
        {"4. Arquivos alterados:\n"}
        {"   - src/lib/erp.functions.ts (Metadata loading)\n"}
        {"   - src/hooks/use-order-form.ts (State logic)\n"}
        {"   - src/routes/_authenticated.pedidos-venda.novo.tsx (Algoritmo & LifeCycle)\n"}
        {"   - src/routes/_authenticated.pedidos-venda.index.tsx (Reset trigger)\n"}

      </div>
    </div>
  );
}
