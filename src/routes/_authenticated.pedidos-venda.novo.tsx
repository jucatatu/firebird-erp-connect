import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, useMyProfile, useMyCompanies } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Plus, ShoppingCart, Truck, CreditCard, ChevronRight, ChevronLeft, Trash2, CheckCircle2, Send, RefreshCcw, AlertCircle, Pencil, History, User as UserIcon } from "lucide-react";
import { useErpClients, useErpProducts, useErpEquipmentTypes, useErpPrice, useCreateErpOrder, useErpClientDetail } from "@/hooks/use-erp";
import { getErpPaymentOptions, resolveErpPrice, type CreateOrderInput, type PaymentOptionsPayload, updateErpOrder, getErpOrderDetail } from "@/lib/erp-orders.functions";
import { useOrderFormStore, type OrderFormStore, type OrderEquipment } from "@/hooks/use-order-form";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecentOrderDrafts } from "@/hooks/use-order-drafts";
import { getItemsSummary, getEquipmentsSummary } from "@/lib/order-summary";
import { companyLabel } from "@/components/order-identifier";
import { formatDateOnly } from "@/utils/date-utils";
import { useSwipeable } from "react-swipeable";

export const Route = createFileRoute("/_authenticated/pedidos-venda/novo")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      repeat: search.repeat as string | undefined,
      client: search.client as string | undefined,
      edit: search.edit as string | undefined
    };
  },
  component: NewOrderPage
});

function NewOrderPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/pedidos-venda/novo" });
  const editOrderNumber = search.edit;
  
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<"client" | "items" | "delivery" | "payment" | "review">("client");
  const [isResolvingRepeat, setIsResolvingRepeat] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  const {
    clientId, clientName, companyId, items, equipments, deliver, deliveryAt,
    returnEquipment, returnAt, notes, paymentTermId, paymentMethodId, saleTypeId,
    idempotencyKey, submissionStatus, erpOrderId, erpOrderNumber, isEditing,
    setClient, setCompany, addItem, removeItem, updateItemQuantity, updateItemPrice, addEquipment, removeEquipment,
    setDelivery, setReturn, setNotes, setPayment, setSaleType, reset,
    setIdempotencyKey, setSubmissionStatus, resetItemsAndClient,
    repeatOrder, newOrderFromClient, editErpOrder
  } = useOrderFormStore();

  const fetchErpOrderDetail = useServerFn(getErpOrderDetail);

  // SPRINT 8.9.36 — HIDRATAÇÃO ÚNICA DO WIZARD
  useEffect(() => {
    async function hydrate() {
      if (!editOrderNumber) return;
      
      // Se já estivermos com o pedido certo na store, não re-hidratamos
      if (isEditing && erpOrderNumber === Number(editOrderNumber)) return;

      setIsHydrating(true);
      setHydrationError(null);
      console.log(`[WIZARD] SPRINT 8.9.36 - Iniciando hidratação ERP ${editOrderNumber}`);

      try {
        const result = await fetchErpOrderDetail({ data: Number(editOrderNumber) });
        
        if (result.ok && result.data) {
          const order = result.data;
          
          // Validação de Status
          const { canEditErpOrder } = await import("@/lib/erp-orders.functions");
          if (!canEditErpOrder(order.statusId)) {
            setHydrationError(`Pedido ${editOrderNumber} não pode ser editado no status ${order.statusDescription || order.statusId}.`);
            setIsHydrating(false);
            return;
          }

          // HIDRATAÇÃO ATÔMICA
          console.log("[WIZARD] Executando editErpOrder atômico");
          editErpOrder(order);
          setIsHydrating(false);
          toast.success(`Pedido ERP ${editOrderNumber} carregado com sucesso.`);
        } else {
          setHydrationError(result.error?.message || `Não foi possível carregar o pedido ERP ${editOrderNumber}.`);
          setIsHydrating(false);
        }
      } catch (err: any) {
        console.error("[WIZARD] Erro na hidratação:", err);
        setHydrationError(`Erro fatal ao carregar pedido ${editOrderNumber}.`);
        setIsHydrating(false);
      }
    }

    hydrate();
  }, [editOrderNumber, fetchErpOrderDetail, editErpOrder, isEditing, erpOrderNumber]);
  // SPRINT 8.9.36 — TELA DE LOADING E ERRO
  if (isHydrating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold">Carregando pedido ERP {editOrderNumber}...</h2>
        <p className="text-muted-foreground">Aguarde a hidratação atômica dos dados.</p>
      </div>
    );
  }

  if (hydrationError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold text-destructive">Erro na Edição</h2>
        <p className="text-muted-foreground mt-2 mb-6 max-w-md">{hydrationError}</p>
        <Button onClick={() => navigate({ to: "/pedidos-venda" })}>
          Voltar ao pedido
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6 pb-32">
      <div className="flex flex-col gap-4">
        <PageHeader 
          title={isEditing ? `Editar Pedido ${erpOrderNumber}` : "Novo Pedido ERP"} 
          description={isEditing ? "Edite as informações do pedido diretamente no ERP." : "Fluxo de criação de pedido integrado ao Firebird."} 
        />

        <div className="bg-card rounded-xl border p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { id: "client", label: "Cliente" },
              { id: "items", label: "Itens" },
              { id: "delivery", label: "Entrega" },
              { id: "payment", label: "Pagamento" },
              { id: "review", label: "Revisão" }
            ].map((s, i) => {
              const steps = ["client", "items", "delivery", "payment", "review"];
              const currentIndex = steps.indexOf(step);
              const targetIndex = i;
              const isCurrent = step === s.id;
              
              const canNavigate = () => {
                if (targetIndex <= currentIndex) return true;
                if (targetIndex === 1) return !!clientId;
                if (targetIndex === 2) return !!clientId && items.length > 0;
                if (targetIndex === 3) return !!clientId && items.length > 0 && !!deliveryAt;
                if (targetIndex === 4) return !!clientId && items.length > 0 && !!deliveryAt && !!paymentTermId;
                return false;
              };

              const navigateToStep = () => {
                if (canNavigate()) setStep(s.id as any);
                else toast.error("Complete os passos anteriores primeiro.");
              };

              const isBlocked = !canNavigate() && !isCurrent;
