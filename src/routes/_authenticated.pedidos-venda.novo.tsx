import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useCreateErpOrder } from "@/hooks/use-erp";
import { getErpOrderDetail, updateErpOrder } from "@/lib/erp-orders.functions";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/pedidos-venda/novo")({
  validateSearch: (search: Record<string, unknown>) => ({
    repeat: search.repeat as string | undefined,
    client: search.client as string | undefined,
    edit: search.edit as string | undefined
  }),
  component: NewOrderPage
});

function NewOrderPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/pedidos-venda/novo" });
  const editOrderNumber = search.edit;
  
  const queryClient = useQueryClient();
  const [, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<"client" | "items" | "delivery" | "payment" | "review">("client");
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  const {
    clientId, items, equipments, erpOrderNumber, isEditing,
    editErpOrder, setSubmissionStatus, companyId, submissionStatus
  } = useOrderFormStore();

  const fetchErpOrderDetail = useServerFn(getErpOrderDetail);
  const updateErpOrderFn = useServerFn(updateErpOrder);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (editOrderNumber) {
      console.log("[EDIT WIZARD STATE]", {
        isEditing,
        erpOrderNumber,
        clientId,
        companyId,
        itemsCount: items.length,
        step
      });
    }
  }, [editOrderNumber, isEditing, erpOrderNumber, clientId, companyId, items.length, step]);

  useEffect(() => {
    async function hydrate() {
      if (!editOrderNumber) return;
      
      if (isEditing && erpOrderNumber === Number(editOrderNumber) && clientId && companyId) {
        if (step === 'client') {
          console.log("[HYDRATE] Data already present, advancing to items");
          setStep("items");
        }
        return;
      }

      setIsHydrating(true);
      setHydrationError(null);

      try {
        console.log("[HYDRATE] Fetching ERP detail for", editOrderNumber);
        const result = await fetchErpOrderDetail({ data: Number(editOrderNumber) });
        
        if (result.ok && result.data) {
          console.log("[HYDRATE] Success, calling editErpOrder");
          editErpOrder(result.data);
          setIsHydrating(false);
          
          setTimeout(() => {
            console.log("[HYDRATE] Timeout trigger: setting step to items");
            setStep("items");
          }, 100);
        } else {
          console.error("[HYDRATE] Failed to fetch ERP detail:", result.error);
          setHydrationError(result.error?.message || "Erro ao carregar pedido.");
          setIsHydrating(false);
        }
      } catch (err) {
        console.error("[HYDRATE] Exception:", err);
        setHydrationError("Erro fatal na hidratação.");
        setIsHydrating(false);
      }
    }
    hydrate();
  }, [editOrderNumber, fetchErpOrderDetail, editErpOrder, isEditing, erpOrderNumber, clientId, companyId]);

  const handleCreateOrder = async () => {
    toast.info("Processando criação...");
  };

  const handleUpdateOrder = async () => {
    if (!erpOrderNumber || !clientId) return;
    setSubmissionStatus("submitting");
    
    try {
      const state = useOrderFormStore.getState();
      const payload = {
        companyId: state.companyId,
        clientId: state.clientId!,
        sellerId: 0,
        saleTypeId: state.saleTypeId,
        paymentTermId: state.paymentTermId,
        paymentMethodId: state.paymentMethodId,
        deliver: state.deliver,
        deliveryAt: state.deliveryAt,
        returnEquipment: state.returnEquipment,
        returnAt: state.returnAt,
        notes: state.notes,
        items: state.items.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          manualUnitPrice: it.manualPrice
        })),
        equipments: state.equipments.map(eq => ({
          equipmentTypeId: eq.equipmentTypeId,
          quantity: eq.quantity
        }))
      };

      const result = await updateErpOrderFn({ 
        data: { 
          orderNumber: erpOrderNumber, 
          data: payload as any 
        } 
      });

      if (result.ok) {
        toast.success(`Pedido ${erpOrderNumber} atualizado com sucesso!`);
        setSubmissionStatus("created", { orderNumber: erpOrderNumber });
        queryClient.invalidateQueries({ queryKey: ["erp-order-status"] });
        queryClient.invalidateQueries({ queryKey: ["order-drafts"] });
      } else {
        toast.error(result.error?.message || "Erro ao atualizar pedido.");
        setSubmissionStatus("failed");
      }
    } catch (err) {
      console.error("[UPDATE] Exception:", err);
      toast.error("Erro técnico na atualização.");
      setSubmissionStatus("failed");
    }
  };

  if (isHydrating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4 mx-auto" />
        <h2 className="text-xl font-bold">Carregando pedido ERP {editOrderNumber}...</h2>
        <p className="text-sm text-muted-foreground mt-2">[EDIT LOAD] editParam={editOrderNumber}</p>
      </div>
    );
  }

  if (hydrationError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4 mx-auto" />
        <h2 className="text-xl font-bold">Erro: {hydrationError}</h2>
        <p className="text-sm text-muted-foreground mt-2 mb-4">
          Não foi possível localizar o pedido {editOrderNumber} no ERP.
        </p>
        <Button onClick={() => navigate({ to: "/pedidos-venda" })}>Voltar para Meus Pedidos</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6 pb-32">
      <PageHeader 
        title={isEditing ? `Editar Pedido ${erpOrderNumber}` : "Novo Pedido ERP"} 
        description="Acesse o wizard para completar seu pedido." 
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Passo Atual: {step}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-8 border-2 border-dashed rounded-lg text-center">
            <p className="text-muted-foreground mb-4">
              O Wizard completo está sendo restaurado. Hidratação para ERP {editOrderNumber} concluída.
            </p>
            {isEditing && (
              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                MODO EDIÇÃO ATIVO
              </Badge>
            )}
          </div>

          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => navigate({ to: "/pedidos-venda" })}>Cancelar</Button>
            <Button 
              className={isEditing ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}
              onClick={isEditing ? handleUpdateOrder : handleCreateOrder}
              disabled={submissionStatus === "submitting"}
            >
              {submissionStatus === "submitting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                isEditing ? "Salvar Alterações" : "Criar Pedido"
              )}
            </Button>
          </div>
          
          {submissionStatus === "created" && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-bold text-green-800">Sucesso!</p>
              <Button className="mt-2" onClick={() => navigate({ to: "/pedidos-venda" })}>Ver Meus Pedidos</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}