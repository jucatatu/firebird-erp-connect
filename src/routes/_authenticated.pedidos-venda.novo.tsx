import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { getErpPaymentOptions, resolveErpPrice, getErpOrderDetail, type CreateOrderInput, type PaymentOptionsPayload, updateErpOrder } from "@/lib/erp-orders.functions";
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
      edit: search.edit ? String(search.edit) : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Novo Pedido — ERP" },
      { name: "description", content: "Fluxo de criação de pedido de venda integrado ao ERP." },
    ],
  }),
  component: NewOrderPage,
});

function ProductPriceDisplay({ 
  productId, 
  clientId, 
  unit, 
  onPriceLoaded,
  manualPrice,
  appliedPrice,
  onEditPrice
}: { 
  productId: number, 
  clientId: number, 
  unit: string,
  onPriceLoaded?: (price: number | null) => void,
  manualPrice?: boolean,
  appliedPrice?: number,
  onEditPrice: () => void
}) {
  const { data, isLoading } = useErpPrice({ productId, clientId });
  
  useEffect(() => {
    // We notify the parent if a price was found or not found
    if (!isLoading) {
      if (data?.ok && data.data?.priceFound) {
        onPriceLoaded?.(data.data.unitPrice);
      } else {
        onPriceLoaded?.(null);
      }
    }
  }, [data, isLoading, onPriceLoaded]);
  
  if (isLoading) return <p className="text-xs text-muted-foreground animate-pulse mt-1">Consultando preço...</p>;
  
  const erpPrice = data?.ok && data.data?.priceFound ? data.data.unitPrice : null;
  const strategyLabel = data?.data?.strategy === 'client_specific' ? 'Preço do cliente' : 'Preço padrão';
  
  const hasEffectivePrice = (appliedPrice !== undefined && appliedPrice > 0) || (erpPrice !== null);

  return (
    <div className="mt-1">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          {hasEffectivePrice ? (
            <span className="text-sm font-bold text-primary">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appliedPrice ?? (erpPrice || 0))} / {unit}
            </span>
          ) : (
            <span className="text-xs text-destructive font-medium">Preço não cadastrado</span>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-muted-foreground hover:text-primary" 
            onClick={(e) => { e.stopPropagation(); onEditPrice(); }}
          >
            {hasEffectivePrice ? (
              <Pencil className="h-3.5 w-3.5" />
            ) : (
              <span className="text-[10px] underline px-1 text-blue-600 font-bold whitespace-nowrap">[Definir preço]</span>
            )}
          </Button>
        </div>

        {manualPrice && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-orange-600 font-bold uppercase">Preço alterado manualmente</span>
            {erpPrice !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground font-medium">
                  Original ERP: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(erpPrice)}
                </span>
              </div>
            )}
          </div>
        )}
        {!manualPrice && erpPrice !== null && (
          <p className="text-[10px] font-medium uppercase text-muted-foreground tracking-tight">{strategyLabel}</p>
        )}
      </div>
    </div>
  );
}

function SubtotalDisplay({ productId, clientId, quantity, appliedPrice, erpPrice }: { productId: number, clientId: number, quantity: number, appliedPrice?: number, erpPrice?: number | null }) {
  // If we have an explicit applied price or an erp price, we use it.
  const effectivePrice = appliedPrice ?? erpPrice;
  
  if (!effectivePrice || effectivePrice <= 0) return null;
  
  const subtotal = effectivePrice * quantity;
  return (
    <p className="text-xs font-bold text-muted-foreground">
      Subtotal: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}
    </p>
  );
}

function ProductCard({ product, clientId, addItem, removeItem, updateItemPrice, cartItem }: { product: any, clientId: number, addItem: any, removeItem: any, updateItemPrice: any, cartItem: any }) {
  const punit = product.unit?.code || "UN";
  const pstep = Number(product.quantity_step || 1);
  const pinitial = Number(product.default_quantity || 1);
  const isChopp = product.logistics_type === 'draft';
  const [localQty, setLocalQty] = useState(pinitial);
  const [erpPrice, setErpPrice] = useState<number | null>(null);
  const [draftManualPrice, setDraftManualPrice] = useState<number | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  useEffect(() => {
    if (cartItem) {
      setLocalQty(cartItem.quantity);
    } else {
      setLocalQty(pinitial);
      setDraftManualPrice(null); // Reset when not in cart
    }
  }, [cartItem, pinitial]);

  const handleQtyChange = (val: number) => {
    const remainder = val % pstep;
    const adjustedVal = remainder === 0 ? val : val + (pstep - remainder);
    const newQty = Math.max(0, adjustedVal);
    
    setLocalQty(newQty);
    if (cartItem) {
      useOrderFormStore.getState().updateItemQuantity(product.id, newQty);
    }
  };

  const handlePriceClick = () => {
    setIsEditingPrice(true);
  };

  const effectivePrice = cartItem 
    ? cartItem.appliedUnitPrice 
    : (draftManualPrice ?? erpPrice);

  const isManual = cartItem 
    ? cartItem.manualPrice 
    : (draftManualPrice !== null);

  const shortcuts = isChopp ? [10, 20, 30, 50] : [];

  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 shadow-sm transition-colors ${cartItem ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-bold text-sm leading-tight">{product.description}</h4>
          {isEditingPrice ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="h-8 w-24 text-sm font-bold"
                defaultValue={effectivePrice ?? 0}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = Number((e.target as HTMLInputElement).value);
                    if (!isNaN(val) && val > 0) {
                      if (cartItem) {
                        updateItemPrice(product.id, val);
                      } else {
                        setDraftManualPrice(val);
                      }
                    }
                    setIsEditingPrice(false);
                  }
                  if (e.key === 'Escape') setIsEditingPrice(false);
                }}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val) && val > 0 && val !== effectivePrice) {
                    if (cartItem) {
                      updateItemPrice(product.id, val);
                    } else {
                      setDraftManualPrice(val);
                    }
                  }
                  setIsEditingPrice(false);
                }}
              />
              {erpPrice !== null && (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={(e) => {
                  e.stopPropagation();
                  if (cartItem) {
                    updateItemPrice(product.id, null);
                  } else {
                    setDraftManualPrice(null);
                  }
                  setIsEditingPrice(false);
                }} title="Restar para preço ERP">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1">
              <ProductPriceDisplay 
                productId={product.id} 
                clientId={clientId} 
                unit={punit} 
                onPriceLoaded={setErpPrice}
                manualPrice={isManual}
                appliedPrice={effectivePrice}
                onEditPrice={handlePriceClick}
              />
              {isManual && (
                <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-blue-600 border-blue-200 cursor-help ml-1" title="Preço editado manualmente">
                  Manual
                </Badge>
              )}
            </div>
          )}
        </div>
        {cartItem && <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] h-5 shrink-0"><CheckCircle2 className="h-3 w-3 mr-1"/> Adicionado</Badge>}
      </div>

      {isChopp && (
        <div className="flex flex-wrap gap-1 mt-1">
          {shortcuts.map(val => (
            <Button 
              key={val} 
              variant={localQty === val ? "default" : "outline"} 
              size="sm" 
              className={`h-6 px-2 text-[10px] font-bold ${localQty === val ? 'bg-primary text-primary-foreground' : ''}`}
              onClick={() => handleQtyChange(val)}
            >
              {val}L
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={() => handleQtyChange(localQty - pstep)}
            disabled={localQty <= 0}
          >-</Button>
          <div className="flex items-center px-1">
            <Input 
              type="number"
              className="h-7 w-10 border-none bg-transparent text-center font-bold text-xs p-0 focus-visible:ring-0" 
              value={localQty}
              onChange={(e) => handleQtyChange(Number(e.target.value))}
            />
            {isChopp && <span className="text-[10px] font-bold text-muted-foreground ml-0.5">L</span>}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={() => handleQtyChange(localQty + pstep)}
          >+</Button>
        </div>
        
        <div className="text-right">
           <SubtotalDisplay productId={product.id} clientId={clientId} quantity={localQty} appliedPrice={effectivePrice} erpPrice={erpPrice} />
           {!cartItem ? (
             <Button size="sm" className="h-8 px-3 text-xs mt-1" onClick={() => {
               if (localQty > 0 && (erpPrice !== null || draftManualPrice !== null)) {
                 addItem({ 
                   productId: product.id, 
                   description: product.description, 
                   quantity: localQty, 
                   unitPrice: erpPrice || 0,
                   manualUnitPrice: draftManualPrice
                 });
               }
             }} disabled={localQty <= 0 || (erpPrice === null && draftManualPrice === null)}>
               Adicionar
             </Button>
           ) : (
             <Button variant="ghost" size="sm" className="h-8 px-2 text-xs mt-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeItem(product.id)}>
               Remover
             </Button>
           )}
        </div>
      </div>
    </div>
  );
}

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [step, setStepState] = useState<"client" | "items" | "delivery" | "payment" | "review">("client");

  const {
    clientId, clientName, companyId, items, equipments, deliver, deliveryAt,
    returnEquipment, returnAt, notes, paymentTermId, paymentMethodId, saleTypeId,
    idempotencyKey, submissionStatus, erpOrderId, erpOrderNumber, isEditing, identityLocked,
    setClient, setCompany, addItem, removeItem, updateItemQuantity, updateItemPrice, addEquipment, removeEquipment,
    setDelivery, setReturn, setNotes, setPayment, setSaleType, reset,
    setIdempotencyKey, setSubmissionStatus, resetItemsAndClient,
    repeatOrder, newOrderFromClient, editErpOrder
  } = useOrderFormStore();

  // SPRINT 8.9.36.1: Ignora guard se houver editParam para permitir hidratação direta no step correto
  const { edit: editParam } = Route.useSearch();
  const setStep = (newStep: typeof step) => {
    if (identityLocked && newStep === "client" && !editParam) {
      console.log("[WIZARD] Bloqueando navegação para 'client' porque a identidade está travada.");
      return;
    }
    setStepState(newStep);
  };
  const [isResolvingRepeat, setIsResolvingRepeat] = useState(false);

  const fetchPaymentOptions = useServerFn(getErpPaymentOptions);
  const fetchPrice = useServerFn(resolveErpPrice);
  const fetchOrderDetail = useServerFn(getErpOrderDetail);
  
  const [hydrationLoading, setHydrationLoading] = useState(false);

  useEffect(() => {
    const hydrate = async () => {
      if (!editParam) return;
      
      console.log("[EDIT FLOW] editParam=", editParam);

      // Se já está na store com o mesmo número, apenas garante o step
      if (isEditing && erpOrderNumber === Number(editParam)) {
        console.log("[EDIT FLOW] Already in store, step=items");
        if (step === "client") setStepState("items");
        return;
      }

      if (hydrationLoading) return;

      const orderNum = Number(editParam);
      if (isNaN(orderNum)) return;

      setHydrationLoading(true);
      console.log("[EDIT FLOW] loading ERP order...");
      toast.info(`Carregando pedido ERP ${orderNum}...`);
      
      try {
        const result = await fetchOrderDetail({ data: orderNum });
        console.log("[EDIT FLOW] ERP response status=", result.ok ? "success" : "error");
        
        if (result.ok && result.data) {
          console.log("[EDIT FLOW] hydrating store...");
          editErpOrder(result.data);
          
          console.log("[EDIT FLOW] identityLocked=true");
          console.log("[EDIT FLOW] step=items");
          setStepState("items");
          console.log("[EDIT FLOW] ready");
          toast.success(`Pedido ${orderNum} carregado para edição.`);
        } else {
          console.log("[EDIT FLOW] REDIRECT TO LIST reason=ERP_FETCH_FAILED");
          toast.error(result.error?.message || "Erro ao carregar pedido.");
          // Mantém na página para diagnóstico conforme item 6
        }
      } catch (err) {
        console.log("[EDIT FLOW] REDIRECT TO LIST reason=NETWORK_ERROR");
        toast.error("Erro na comunicação com o servidor.");
      } finally {
        setHydrationLoading(false);
      }
    };
    hydrate();
  }, [editParam, isEditing, erpOrderNumber, fetchOrderDetail, editErpOrder]);

  const [localPaymentOptions, setLocalPaymentOptions] = useState<{

    loading: boolean;
    error: string | null;
    data: PaymentOptionsPayload | null;
  }>({ loading: false, error: null, data: null });

  const loadPaymentOptionsDirectly = async () => {
    console.log("[PAYMENT UI] calling getErpPaymentOptions directly");
    setLocalPaymentOptions(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fetchPaymentOptions();
      console.log("[PAYMENT UI] result received", {
        type: typeof result,
        keys: Object.keys(result || {}),
        ok: result?.ok,
        status: result?.status,
        hasData: !!result?.data
      });

      if (result.ok && result.data) {
        // Validação de contrato (Item 7 da instrução)
        const isValid = Array.isArray(result.data.paymentTerms) && 
                      Array.isArray(result.data.paymentMethods) && 
                      Array.isArray(result.data.saleTypes);
        
        if (!isValid) {
          console.error("[PAYMENT UI] Erro de contrato: Dados malformados", result.data);
          setLocalPaymentOptions({ loading: false, error: "Erro de contrato no ERP API (formato inválido)", data: null });
          return;
        }

        setLocalPaymentOptions({ loading: false, error: null, data: result.data });
      } else {
        console.error("[PAYMENT UI] error", result.error);
        setLocalPaymentOptions({ 
          loading: false, 
          error: result.error?.message || "Não foi possível carregar as opções de pagamento.", 
          data: null 
        });
      }
    } catch (err: any) {
      console.error("[PAYMENT UI] exception", err);
      setLocalPaymentOptions({ loading: false, error: "Falha na comunicação com o servidor.", data: null });
    }
  };

  useEffect(() => {
    if (step === "payment" && !localPaymentOptions.data && !localPaymentOptions.loading) {
      console.log("[PAYMENT UI] entered payment step, triggering load");
      loadPaymentOptionsDirectly();
    }
  }, [step]);

  const clientDetailQ = useErpClientDetail(clientId);
  
  // Usamos os campos erpOrderId e erpOrderNumber diretamente da store
  const submissionMeta = { orderId: erpOrderId, orderNumber: erpOrderNumber };

  // Efeito para carregar padrões do cliente usando localPaymentOptions
  useEffect(() => {
    if (clientDetailQ.data?.ok && clientDetailQ.data.data && localPaymentOptions.data) {
      const detail = clientDetailQ.data.data;
      const options = localPaymentOptions.data;

      const termId = detail.defaultPaymentTermId;
      const methodId = detail.defaultPaymentMethodId;
      const saleTypeId = detail.defaultSaleTypeId;

      const termExists = termId ? options.paymentTerms.some((t: any) => t.id === termId) : false;
      const methodExists = methodId ? options.paymentMethods.some((m: any) => m.id === methodId) : false;
      const saleTypeExists = saleTypeId ? options.saleTypes.some((s: any) => s.id === saleTypeId) : false;

      // Se o cliente tem padrão mas não está na lista (inativo/deletado no ERP), não selecionamos
      setPayment(
        termExists ? (termId as number) : null,
        methodExists ? (methodId as number) : null
      );
      
      if (saleTypeExists) {
        setSaleType(saleTypeId as number);
      } else {
        // Fallback homologado: se não tem padrão ou padrão é inválido, manter 1 se existir
        const saleType1Exists = options.saleTypes.some((s: any) => s.id === 1);
        if (saleType1Exists) setSaleType(1);
      }
      
      if (termId && !termExists) {
        toast.warning("Condição de pagamento padrão do cliente não disponível ou inativa no ERP.");
      }
      if (methodId && !methodExists) {
        toast.warning("Forma de pagamento padrão do cliente não disponível ou inativa no ERP.");
      }
    }
  }, [clientDetailQ.data, localPaymentOptions.data, clientId, setPayment, setSaleType]);

  const myProfile = useMyProfile(user);
  const myCompanies = useMyCompanies(user);

  useEffect(() => {
    // Ciclo de vida: O formulário deve começar limpo apenas quando iniciamos 
    // explicitamente um Novo Pedido (sem clientId ou vindo de sucesso/falha).
    // O Zustand persist cuida da preservação entre passos do wizard.
    if (submissionStatus === "created" || submissionStatus === "failed") {
      resetItemsAndClient();
    }
    
    // Se o usuário está na rota /novo e não tem empresa definida, 
    // e o sistema tem apenas uma empresa, pré-selecionamos.
    if (myCompanies.data && myCompanies.data.length === 1 && !companyId) {
      setCompany(myCompanies.data[0]);
    }
  }, [myCompanies.data, companyId, setCompany, submissionStatus]);

  useEffect(() => {
    if (!idempotencyKey) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [idempotencyKey, setIdempotencyKey]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const [clientSearch, setClientSearch] = useState("");
  const recentOrders = useRecentOrderDrafts(user?.id, companyId);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(clientSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const clientsQ = useErpClients(
    debouncedSearch.length >= 3 
      ? { q: debouncedSearch, companyId: companyId as 1 | 3 } 
      : null
  );

  const [productSearch, setProductSearch] = useState("");
  const productsQ = useErpProducts({
    q: "",
    companyId: companyId as 1 | 3,
    limit: 200,
  });

  const equipmentTypesQ = useErpEquipmentTypes({
    q: "",
    companyId: companyId as 1 | 3,
    active: true,
  });

  const createOrderM = useCreateErpOrder();

  const [showAddEquip, setShowAddEquip] = useState(false);

  const choppItems = items.filter(it => {
    const p = (productsQ.data as any)?.data?.products?.find((prod: any) => prod.id === it.productId);
    // Sprint 8.9.8: Regra logística oficial
    return p?.logistics_type === 'draft';
  });

  const getRequiredVias = () => choppItems.length;

  const getAvailableVias = () => {
    let total = 0;
    equipments.forEach(eq => {
      // Prioridade 1: Usar campo tapLines (taps_count da migration)
      if (eq.tapLines) {
        total += eq.tapLines * eq.quantity;
      } else {
        // Fallback: Parsing de nome
        const desc = eq.description.toLowerCase();
        const viasMatch = desc.match(/(\d+)\s*vias/i);
        if (viasMatch) total += Number(viasMatch[1]) * eq.quantity;
        else if (desc.includes("via")) total += 1 * eq.quantity;
      }
    });
    return total;
  };

  const getProductCoverage = (productId: number) => {
    const it = items.find(i => i.productId === productId);
    if (!it) return { required: 0, provided: 0 };
    
    let provided = 0;
    
    equipments.forEach(eq => {
      // Sprint 8.9.11: Cobertura estrita por assignedProductId
      if (eq.assignedProductId === productId) {
        if (eq.capacityLiters) {
          provided += eq.capacityLiters * eq.quantity;
        } else {
          const litersMatch = eq.description.match(/(\d+)\s*l/i);
          if (litersMatch) provided += Number(litersMatch[1]) * eq.quantity;
        }
      }
    });

    return { required: it.quantity, provided };
  };

  const [suggestionDirty, setSuggestionDirty] = useState(false);
  useEffect(() => {
    if (choppItems.length > 0) {
      // Sprint 8.9.8: Chopeira agora é opcional, validamos apenas litros (barris)
      const litersValid = choppItems.every(it => {
        const cov = getProductCoverage(it.productId);
        return cov.provided >= cov.required;
      });
      if (!litersValid) setSuggestionDirty(true);
      else setSuggestionDirty(false);
    } else {
      setSuggestionDirty(false);
    }
  }, [items, equipments, choppItems]);

  // Sprint 8.9.19: P1 - Auto-marcar Recolher Equipamentos se houver retornáveis
  useEffect(() => {
    const hasReturnables = equipments.length > 0; // Se a sugestão ou manual adicionou algo, provavelmente é retornável
    if (hasReturnables && !returnEquipment && step === "items") {
      console.log("[LOGISTICS] auto-enabling returnEquipment due to items in cart");
      setReturn(true, returnAt);
    }
  }, [equipments.length, step]);

  const suggestEquipments = () => {
    const newEquips: any[] = [];
    const allEquipTypes = (equipmentTypesQ.data as any)?.data?.equipmentTypes || [];
    
    // 1. Otimizar Vias (CHOPEIRAS)
    const requiredVias = getRequiredVias();
    if (requiredVias > 0) {
      const chopeiras = allEquipTypes.filter((et: any) => 
        et.equipment_role === 'dispenser' || et.description?.toLowerCase().includes("chopeira")
      );

      // Algoritmo: Encontrar combinação que use MENOS equipamentos
      // Como o número de vias é pequeno (geralmente < 5), podemos fazer uma busca simples
      // ou apenas priorizar a chopeira que mais se aproxima das vias necessárias sem excesso desnecessário
      
      const sortedChopeiras = [...chopeiras].sort((a, b) => {
         const vA = a.tap_count || Number(a.description.match(/(\d+)\s*vias/i)?.[1] || 1);
         const vB = b.tap_count || Number(b.description.match(/(\d+)\s*vias/i)?.[1] || 1);
         return vB - vA; // Maior primeiro
      });

      // Busca por equipamento único que cubra tudo
      const exactMatch = sortedChopeiras.find(ch => (ch.tap_count || 1) === requiredVias);
      const nextBest = [...sortedChopeiras].reverse().find(ch => (ch.tap_count || 1) >= requiredVias);

      if (exactMatch) {
        newEquips.push({ 
          equipmentTypeId: exactMatch.id, 
          description: exactMatch.description, 
          quantity: 1,
          role: "TAP",
          tapLines: exactMatch.tap_count || 1
        });
      } else if (nextBest) {
        newEquips.push({ 
          equipmentTypeId: nextBest.id, 
          description: nextBest.description, 
          quantity: 1,
          role: "TAP",
          tapLines: nextBest.tap_count || 1
        });
      } else {
        // Fallback: Combinar equipamentos se não houver um que cubra tudo sozinho
        let remaining = requiredVias;
        for (const ch of sortedChopeiras) {
          const vias = ch.tap_count || 1;
          const qty = Math.floor(remaining / vias);
          if (qty > 0) {
            newEquips.push({ 
              equipmentTypeId: ch.id, 
              description: ch.description, 
              quantity: qty,
              role: "TAP",
              tapLines: vias
            });
            remaining -= qty * vias;
          }
        }
        if (remaining > 0 && sortedChopeiras.length > 0) {
          const smallest = [...sortedChopeiras].reverse()[0];
          const existing = newEquips.find(e => e.equipmentTypeId === smallest.id);
          if (existing) existing.quantity += 1;
          else newEquips.push({
            equipmentTypeId: smallest.id,
            description: smallest.description,
            quantity: 1,
            role: "TAP",
            tapLines: smallest.tap_count || 1
          });
        }
      }
    }

    // 2. Otimizar Barris (KEG) - CÁLCULO POR PRODUTO INDIVIDUAL
    choppItems.forEach(it => {
      let remainingLiters = it.quantity;
      const p = (productsQ.data as any)?.data?.products?.find((prod: any) => prod.id === it.productId);
      const style = p?.description?.split(" ")[0]?.toUpperCase() || "CHOPE";
      
      const barris = allEquipTypes.filter((et: any) => 
        et.equipment_role === 'KEG' || et.description?.toLowerCase().includes("barril")
      );

      const sortedBarris = [...barris].sort((a, b) => {
         const lA = a.capacity_liters || Number(a.description.match(/(\d+)\s*l/i)?.[1] || 0);
         const lB = b.capacity_liters || Number(b.description.match(/(\d+)\s*l/i)?.[1] || 0);
         return lB - lA;
      });

      for (const b of sortedBarris) {
        const capacity = b.capacity_liters || Number(b.description.match(/(\d+)\s*l/i)?.[1] || 0);
        if (capacity <= 0 || remainingLiters <= 0) continue;
        const qty = Math.floor(remainingLiters / capacity);
        if (qty > 0) {
          newEquips.push({ 
            equipmentTypeId: b.id, 
            description: `${b.description} (${style})`, 
            quantity: qty,
            role: "KEG",
            capacityLiters: capacity,
            assignedProductId: it.productId
          });
          remainingLiters -= qty * capacity;
        }
      }

      // Se sobrar, pegar o menor barril que cubra o resto do produto
      if (remainingLiters > 0 && sortedBarris.length > 0) {
        const smallestToCover = [...sortedBarris].reverse().find(b => {
          const capacity = b.capacity_liters || Number(b.description.match(/(\d+)\s*l/i)?.[1] || 0);
          return capacity >= remainingLiters;
        });
        if (smallestToCover) {
           const capacity = smallestToCover.capacity_liters || Number(smallestToCover.description.match(/(\d+)\s*l/i)?.[1] || 0);
           newEquips.push({ 
             equipmentTypeId: smallestToCover.id, 
             description: `${smallestToCover.description} (${style})`, 
             quantity: 1,
             role: "KEG",
             capacityLiters: capacity,
             assignedProductId: it.productId
           });
        }
      }
    });

    useOrderFormStore.setState({ equipments: newEquips });
    setSuggestionDirty(false);
    toast.success("Sugestão otimizada de equipamentos aplicada");
  };

  const updateEquipmentQty = (id: number, qty: number, assignedProductId?: number | null) => {
    if (qty <= 0) removeEquipment(id, assignedProductId);
    else {
      const eqs = [...equipments];
      const idx = eqs.findIndex(e => e.equipmentTypeId === id && e.assignedProductId === assignedProductId);
      if (idx >= 0) {
        eqs[idx].quantity = qty;
        useOrderFormStore.setState({ equipments: eqs });
      }
    }
  };

  const isCoverageValid = () => {
    if (choppItems.length === 0) return true;
    // Sprint 8.9.11: Cobertura estrita por produto
    for (const it of choppItems) {
      const cov = getProductCoverage(it.productId);
      if (cov.provided < cov.required) return false;
    }
    return true;
  };

  const EquipmentCoverageIndicators = () => {
    if (choppItems.length === 0) return null;
    if (equipments.length === 0) return null;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 animate-in fade-in duration-300">
        <div className="p-3 border rounded-lg bg-muted/10">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2">
            Chopeira (Opcional)
            {getAvailableVias() >= getRequiredVias() ? <CheckCircle2 className="h-3 w-3 text-green-600"/> : <Badge variant="outline" className="h-3 text-[9px] px-1 font-normal">Não adicionada</Badge>}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-sm">Vias sugeridas: {getRequiredVias()}</span>
            <Badge variant="secondary" className="bg-muted/30 text-muted-foreground border-none">
              {getAvailableVias()} disponíveis
            </Badge>
          </div>
        </div>
        {choppItems.map(it => {
          const cov = getProductCoverage(it.productId);
          const diff = cov.required - cov.provided;
          return (
            <div key={it.productId} className="p-3 border rounded-lg bg-muted/10">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-1 truncate flex items-center gap-2">
                {it.description}
                {diff <= 0 ? <CheckCircle2 className="h-3 w-3 text-green-600"/> : null}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-sm font-mono">{cov.provided} / {cov.required} L</span>
                {diff > 0 ? (
                  <Badge variant="destructive" className="text-[10px]">Faltam {diff}L</Badge>
                ) : diff < 0 ? (
                  <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">+{Math.abs(diff)}L excesso</Badge>
                ) : (
                  <span className="text-[10px] text-green-600 font-bold">Coberto</span>
                )}
              </div>
              
              {/* Sprint 8.9.11: Mostrar barris alocados especificamente a este produto */}
              <div className="mt-2 space-y-1">
                {equipments.filter(e => e.assignedProductId === it.productId).map(eq => (
                  <div key={`${eq.equipmentTypeId}-${eq.assignedProductId}`} className="flex justify-between text-[10px] text-muted-foreground border-t border-muted/20 pt-1">
                    <span>{eq.description}</span>
                    <span>{eq.quantity}x</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const CoverageSummary = () => {
    const allLitersValid = choppItems.every(it => {
      const cov = getProductCoverage(it.productId);
      return cov.provided >= cov.required;
    });
    const viasValid = getAvailableVias() >= getRequiredVias();
    
    if (choppItems.length === 0) return null;

    return (
      <div className="space-y-1 mt-2">
         <div className="flex items-center gap-2 text-[10px]">
            {allLitersValid ? <CheckCircle2 className="h-3 w-3 text-green-600"/> : <Loader2 className="h-3 w-3 text-destructive animate-spin"/>}
            <span className={allLitersValid ? "text-green-600 font-medium" : "text-destructive font-medium"}>Barris {allLitersValid ? 'cobertos' : 'insuficientes'}</span>
         </div>
         <div className="flex items-center gap-2 text-[10px]">
            {viasValid ? <CheckCircle2 className="h-3 w-3 text-green-600"/> : <div className="h-3 w-3 rounded-full border border-muted-foreground/30" />}
            <span className="text-muted-foreground font-medium">Chopeira {viasValid ? 'adicionada' : 'opcional'}</span>
         </div>
      </div>
    );
  };

  const handleCreateOrder = async () => {
    if (!clientId || items.length === 0 || submissionStatus === "submitting" || submissionStatus === "created") {
      console.log("[ORDER UI] submit blocked", { clientId, itemsCount: items.length, submissionStatus });
      return;
    }
    
    if (!myProfile.data?.erp_seller_id) {
      toast.error("Vendedor não mapeado no servidor.");
      return;
    }
    
    if (!companyId) {
      toast.error("Empresa não selecionada.");
      setStep("client");
      return;
    }

    if (!paymentTermId || !paymentMethodId || !saleTypeId) {
      toast.error("Selecione a condição, forma de pagamento e tipo de venda.");
      setStep("payment");
      return;
    }

    console.log("[ORDER UI] submit-start", { idempotencyKey });
    setSubmissionStatus("submitting");
    const currentKey = idempotencyKey || crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(currentKey);

    try {
      const payload: CreateOrderInput = {
        companyId: companyId as number,
        clientId: clientId,
        client_snapshot: {
          id: clientId,
          name: clientName || "(sem nome)",
          fantasyName: clientDetailQ.data?.data?.tradingName || null
        },
        sellerId: myProfile.data.erp_seller_id,
        saleTypeId: saleTypeId,
        paymentTermId: paymentTermId,
        paymentMethodId: paymentMethodId,
        deliver,
        deliveryAt: deliveryAt || new Date().toISOString(),
        returnEquipment,
        returnAt: returnEquipment ? returnAt : null,
        items: items.map(i => ({ 
          productId: i.productId, 
          description: i.description,
          quantity: i.quantity, 
          unit: i.description.toUpperCase().includes("CHOPP") ? "L" : "x",
          manualUnitPrice: i.manualPrice ? i.appliedUnitPrice : undefined 
        })),
        equipments: equipments.map(e => ({ 
          equipmentTypeId: e.equipmentTypeId, 
          description: e.description,
          quantity: e.quantity 
        })),
        notes: notes || null
      };

      console.log("[ORDER SERVER] create-start", { ...payload, sellerId: "PROTECTED" });
      
      const result = await createOrderM.mutateAsync({ data: payload, idempotencyKey: currentKey });
      
      console.log("[ORDER SERVER] erp-response", { 
        ok: result.ok, 
        status: result.status,
        orderNumber: result.data?.orderNumber
      });

      if (result.ok && result.data && result.data.orderNumber) {
        console.log("[ORDER UI] result success", result.data);
        
        // Salva metadados da submissão para navegação segura
        setSubmissionStatus("created", { 
          orderId: result.data.orderId, 
          orderNumber: result.data.orderNumber 
        });

        if (result.error?.code === "ORDER_CREATED_MIRROR_FAILED") {
          console.error("[ORDER SERVER] mirror-failed", result.error);
          toast.warning(`Pedido ${result.data.orderNumber} criado no ERP, mas falha ao registrar no aplicativo.`);
        } else {
          console.log("[ORDER SERVER] mirror-success");
          toast.success(`Pedido ${result.data.orderNumber} criado com sucesso!`);
        }

        queryClient.invalidateQueries({ queryKey: ["order_drafts"] });
        
        setTimeout(async () => {
          await navigate({ to: "/pedidos-venda", search: { status: "all" } as any });
          resetItemsAndClient();
        }, 2000);
      } else {
        console.error("[ORDER UI] result error", result.error);
        const errorMsg = result.error?.message || "Erro desconhecido ao criar pedido.";
        setSubmissionStatus("failed", { orderId: undefined, orderNumber: undefined });
        toast.error(`Falha ao criar pedido: ${errorMsg}`);
      }
    } catch (err: any) {
      console.error("[ORDER UI] exception", err);
      setSubmissionStatus("failed", { orderId: undefined, orderNumber: undefined });
      toast.error(err.message || "Erro ao criar pedido.");
    }
  };

  const handleUpdateOrder = async () => {
    if (!erpOrderNumber || !clientId || items.length === 0 || submissionStatus === "submitting" || submissionStatus === "created") {
      return;
    }
    
    if (!myProfile.data?.erp_seller_id) {
      toast.error("Vendedor não mapeado no servidor.");
      return;
    }
    
    setSubmissionStatus("submitting");

    try {
      const payload: CreateOrderInput = {
        companyId: companyId as number,
        clientId: clientId,
        client_snapshot: {
          id: clientId,
          name: clientName || "(sem nome)",
          fantasyName: clientDetailQ.data?.data?.tradingName || null
        },
        sellerId: myProfile.data.erp_seller_id,
        saleTypeId: saleTypeId!,
        paymentTermId: paymentTermId!,
        paymentMethodId: paymentMethodId!,
        deliver,
        deliveryAt: deliveryAt || new Date().toISOString(),
        returnEquipment,
        returnAt: returnEquipment ? returnAt : null,
        items: items.map(i => ({ 
          productId: i.productId, 
          description: i.description,
          quantity: i.quantity, 
          unit: i.description.toUpperCase().includes("CHOPP") ? "L" : "x",
          manualUnitPrice: i.manualPrice ? i.appliedUnitPrice : undefined 
        })),
        equipments: equipments.map(e => ({ 
          equipmentTypeId: e.equipmentTypeId, 
          description: e.description,
          quantity: e.quantity 
        })),
        notes: notes || null
      };

      const result = await updateErpOrder({ data: { orderNumber: erpOrderNumber, data: payload } });
      
      if (result.ok && result.data) {
        setSubmissionStatus("created", { 
          orderId: result.data.orderId, 
          orderNumber: result.data.orderNumber 
        });
        
        toast.success(`Pedido ${result.data.orderNumber} atualizado com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ["order_drafts"] });
        
        setTimeout(async () => {
          await navigate({ to: "/pedidos-venda", search: { status: "all" } as any });
          resetItemsAndClient();
        }, 2000);
      } else {
        const errorMsg = result.error?.message || "Erro desconhecido ao atualizar pedido.";
        setSubmissionStatus("failed", { orderId: undefined, orderNumber: undefined });
        toast.error(`Falha ao atualizar pedido: ${errorMsg}`);
      }
    } catch (err: any) {
      setSubmissionStatus("failed", { orderId: undefined, orderNumber: undefined });
      toast.error(err.message || "Erro ao atualizar pedido.");
    }
  };


  const stepsOrder = ["client", "items", "delivery", "payment", "review"] as const;
  const currentStepIndex = stepsOrder.indexOf(step);

  const canNavigateTo = (targetStep: (typeof stepsOrder)[number]) => {
    if (targetStep === "client") return true;
    if (targetStep === "items") return !!clientId;
    if (targetStep === "delivery") return !!clientId && items.length > 0 && isCoverageValid();
    if (targetStep === "payment") return !!clientId && items.length > 0 && isCoverageValid() && (deliver ? !!deliveryAt : true);
    if (targetStep === "review") return !!clientId && items.length > 0 && isCoverageValid() && (deliver ? !!deliveryAt : true) && !!paymentTermId && !!paymentMethodId && !!saleTypeId;
    return false;
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const nextStep = stepsOrder[currentStepIndex + 1];
      if (nextStep && canNavigateTo(nextStep)) {
        setStep(nextStep);
      } else if (nextStep) {
        if (nextStep === "delivery" && !isCoverageValid()) toast.error("Complete os itens e equipamentos antes de acessar Entrega");
        else if (nextStep === "payment" && deliver && !deliveryAt) toast.error("Selecione a data de entrega");
        else if (nextStep === "review") toast.error("Selecione as opções de pagamento");
      }
    },
    onSwipedRight: () => {
      // Sprint 8.9.36: Bloqueio de retorno ao cliente via swipe
      if (step === "items" && identityLocked) {
        console.log("[WIZARD] Swipe para a direita bloqueado: identidade travada no Passo 2.");
        return;
      }
      const prevStep = stepsOrder[currentStepIndex - 1];
      if (prevStep) setStep(prevStep);
    },
    delta: 70,
    trackMouse: false,
    preventScrollOnSwipe: true,
  });

  return (
    <div {...swipeHandlers} className="flex flex-col min-h-screen bg-background pb-10">

      <ManualEquipmentSheet 
        open={showAddEquip} 
        onOpenChange={setShowAddEquip}
        equipmentTypes={(equipmentTypesQ.data as any)?.data?.equipmentTypes || []}
        choppItems={choppItems}
        addEquipment={addEquipment}
        getProductCoverage={getProductCoverage}
      />
      <div className="container max-w-5xl py-4 sm:py-6 px-4">
      <PageHeader 
        title={isEditing ? `Editando Pedido ${erpOrderNumber}` : "Novo Pedido"} 
        description={isEditing ? "Altere os dados necessários e salve as modificações no ERP." : "Siga os passos para cadastrar um novo pedido no ERP."}
        crumbs={[{ label: "Pedidos", to: "/pedidos-venda" }, { label: isEditing ? `Editar ${erpOrderNumber}` : "Novo" }]}
      />

      {identityLocked && (
        <div className="mt-4 mb-2 p-3 bg-muted/40 border border-muted-foreground/20 rounded-lg flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                {isEditing ? `Pedido ERP ${erpOrderNumber}` : "Identidade Bloqueada"}
              </p>
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                {clientName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Empresa: {companyId === 3 ? "GROTT" : "GRAAL"}
              </p>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs border-destructive/20 hover:bg-destructive/10 hover:text-destructive text-destructive"
              onClick={() => {
                if (window.confirm(isEditing ? "Deseja cancelar a edição? As alterações não salvas serão perdidas." : "Deseja cancelar o pedido atual?")) {
                  reset();
                  navigate({ to: "/pedidos-venda" });
                }
              }}
            >
              {isEditing ? "Cancelar Edição" : "Cancelar Pedido"}
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4">
        {/* Stepper responsivo: Faixa rolável no mobile */}
        <div className="flex w-full overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth">
          <div className="flex gap-2 min-w-max">
            {[
              { id: "client", label: "Cliente" },
              { id: "items", label: "Itens + Equipamentos" },
              { id: "delivery", label: "Entrega" },
              { id: "payment", label: "Pagamento" },
              { id: "review", label: "Revisão" }
            ].filter(s => {
              // Sprint 8.9.36: No mobile, oculta a aba Cliente se a identidade estiver bloqueada
              if (s.id === "client" && identityLocked) return false;
              return true;
            }).map((s, i) => {
              const stepIds = ["client", "items", "delivery", "payment", "review"];
              const currentIndex = stepIds.indexOf(step);
              const targetIndex = stepIds.indexOf(s.id);
              const isPast = targetIndex < currentIndex;
              const isCurrent = step === s.id;
              
              const canNavigate = () => {
                if (isPast) return true;
                if (isCurrent) return true;
                
                // Regras de Navegação Sprint 8.9.23
                if (s.id === "items") return !!companyId && !!clientId;
                if (s.id === "delivery") return !!companyId && !!clientId && items.length > 0 && isCoverageValid();
                if (s.id === "payment") return !!companyId && !!clientId && items.length > 0 && isCoverageValid() && !!deliveryAt;
                if (s.id === "review") return !!companyId && !!clientId && items.length > 0 && isCoverageValid() && !!deliveryAt && !!paymentTermId && !!paymentMethodId && !!saleTypeId;
                
                return false;
              };

              const navigateToStep = () => {
                if (s.id === "client" && identityLocked) return;
                if (canNavigate()) {
                  setStep(s.id as any);
                } else {
                  if (!companyId || !clientId) toast.error("Selecione a empresa e o cliente primeiro.");
                  else if (items.length === 0) toast.error("Adicione pelo menos um produto.");
                  else if (!isCoverageValid()) toast.error("Complete os itens e equipamentos antes de acessar Entrega.");
                  else if (!deliveryAt) toast.error("Defina os dados de entrega antes de avançar.");
                  else toast.error("Complete as etapas anteriores para acessar esta fase.");
                }
              };

              const isBlocked = !canNavigate() && !isCurrent;

              return (
                <div 
                  key={s.id}
                  className="flex flex-col items-center gap-1 cursor-pointer group"
                  onClick={navigateToStep}
                >
                  <Badge 
                    variant={step === s.id ? "default" : "outline"} 
                    className={`px-3 py-1.5 whitespace-nowrap text-[11px] sm:text-xs transition-all duration-200 
                      ${step === s.id ? 'bg-orange-600 hover:bg-orange-700 text-white scale-105 shadow-md ring-2 ring-orange-200 border-orange-600' : 
                        isBlocked ? 'opacity-40 grayscale cursor-not-allowed' : 'opacity-80 hover:bg-muted group-hover:scale-105'}`}
                  >
                    {i + 1}. {s.label}
                  </Badge>
                  {isCurrent && <div className="h-0.5 w-full bg-orange-600 rounded-full animate-in zoom-in-50 duration-300" />}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Nome do cliente/usuário: Linha separada ou compacto no mobile */}
        {clientId && (
          <div className="flex items-center gap-2 bg-muted/30 px-3 py-2 rounded-lg border border-muted/50 w-full overflow-hidden animate-in fade-in duration-300">
            <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase whitespace-nowrap shrink-0">Pedido para:</span>
            <p className="text-xs sm:text-sm font-bold truncate text-primary">{clientName}</p>
          </div>
        )}
      </div>

      {step === "client" && (
        <Card className="shadow-none border-none sm:border">
          <CardHeader className="pb-2"><CardTitle className="text-xl font-bold flex items-center gap-2"><UserIcon className="h-5 w-5 text-primary" /> Identificação</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label>Empresa</Label>
              <div className="flex gap-4">
                {(myCompanies.data || []).map((id: any) => (
                  <Button
                    key={id}
                    variant={companyId === id ? "default" : "outline"}
                    className="flex-1 py-8 text-lg font-bold"
                    onClick={() => setCompany(id)}
                  >
                    {id === 1 ? "GRAAL" : id === 3 ? "GROTT" : `Empresa ${id}`}
                  </Button>
                ))}
              </div>
              {!companyId && (
                <p className="text-sm text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Selecione uma empresa para buscar clientes
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base font-bold flex items-center gap-2">
                <Search className="h-4 w-4" /> Buscar cliente
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder={companyId ? "Digite nome, código ou documento..." : "Selecione a empresa primeiro"} 
                  className="pl-9 h-12 text-base"
                  value={clientSearch} 
                  onChange={(e) => setClientSearch(e.target.value)} 
                  disabled={!companyId}
                />
              </div>
            </div>

            <div className="space-y-6">
              {/* RESULTADOS DA BUSCA (Prioridade quando há texto) */}
              {debouncedSearch.length >= 3 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Resultados da pesquisa</h3>
                    {clientsQ.isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  
                  <div className="space-y-2">
                    {clientsQ.data?.data?.clients?.map((c) => (
                      <div 
                        key={c.id} 
                        className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all active:scale-[0.98] ${clientId === c.id ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10' : 'bg-card hover:bg-muted shadow-sm'}`} 
                        onClick={() => {
                          setClient(c.id, c.name);
                          setStep("items");
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-sm text-primary">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium">
                            ID {c.id} {c.document && `· ${c.document}`} {c.code && `· ${c.code}`}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}

                    {clientsQ.isSuccess && (clientsQ.data?.data?.clients || []).length === 0 && (
                      <div className="py-6 text-center border-2 border-dashed rounded-xl bg-muted/5">
                        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado para "{debouncedSearch}"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PEDIDOS RECENTES (ÚLTIMOS PEDIDOS) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {debouncedSearch.length >= 3 ? "Pedidos Recentes" : "Últimos Pedidos"}
                  </h3>
                </div>

                <div className="grid gap-3">
                  {recentOrders.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : recentOrders.data?.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic px-2">Nenhum pedido recente encontrado.</p>
                  ) : (
                    recentOrders.data?.map((order: any) => {
                      const payload = order.payload as any;
                      const itemsSummary = getItemsSummary(payload);
                      const equipmentsSummary = getEquipmentsSummary(payload);

                      return (
                        <div key={order.id} className="group relative flex flex-col gap-3 p-4 rounded-xl border bg-card hover:shadow-md transition-all">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1 pr-8">
                              <span className="font-bold text-sm truncate">{order.customer_name_snapshot || "Cliente não identificado"}</span>
                              <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground font-medium uppercase">
                                <span>{order.erp_order_number ? `ERP ${order.erp_order_number}` : 'Rascunho'}</span>
                                <span>·</span>
                                <span>{companyLabel(order.company_id)}</span>
                                <span>·</span>
                                <span>{formatDateOnly(order.created_at)}</span>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                          </div>
                          
                          <div className="space-y-1.5 py-1">
                            <div className="flex items-start gap-1 text-[10px]">
                              <span className="font-bold text-muted-foreground shrink-0">Produtos:</span>
                              <span className="text-foreground/80 line-clamp-1">{itemsSummary}</span>
                            </div>
                            <div className="flex items-start gap-1 text-[10px]">
                              <span className="font-bold text-muted-foreground shrink-0">Equipamentos:</span>
                              <span className="text-foreground/80 line-clamp-1">{equipmentsSummary}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-1">
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="h-8 flex-1 text-[11px] font-bold shadow-sm"
                              onClick={() => {
                                newOrderFromClient(payload.clientId, order.customer_name_snapshot, order.company_id);
                                setStep("items");
                              }}
                            >
                              Novo
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 flex-1 text-[11px] font-bold border-primary/20 text-primary hover:bg-primary/5"
                              onClick={async () => {
                                setIsResolvingRepeat(true);
                                try {
                                  // 1. Reconstruir estado base (empresa, cliente, produtos, equipamentos, logística)
                                  repeatOrder(payload, order.customer_name_snapshot);
                                  
                                  // 2. Resolver preços atuais do ERP
                                  const updatedItems = [...useOrderFormStore.getState().items];
                                  let allPricesResolved = true;
                                  let firstErrorProduct = "";

                                  for (let i = 0; i < updatedItems.length; i++) {
                                    const item = updatedItems[i];
                                    try {
                                      const priceRes = await fetchPrice({ data: { productId: item.productId, clientId: payload.clientId } });
                                      if (priceRes.ok && priceRes.data?.priceFound) {
                                        updatedItems[i] = {
                                          ...item,
                                          unitPrice: priceRes.data.unitPrice,
                                          appliedUnitPrice: priceRes.data.unitPrice,
                                          total: item.quantity * priceRes.data.unitPrice
                                        };
                                      } else {
                                        allPricesResolved = false;
                                        if (!firstErrorProduct) firstErrorProduct = item.description;
                                      }
                                    } catch (err) {
                                      allPricesResolved = false;
                                      if (!firstErrorProduct) firstErrorProduct = item.description;
                                    }
                                  }

                                  // Atualiza os itens com preços resolvidos
                                  useOrderFormStore.setState({ items: updatedItems });
                                  
                                  // Sprint 8.9.36: Transição automática para Passo 2 após repetir pedido
                                  setStep("items");

                                  // 3. Validar se a logística do snapshot ainda é válida com o catálogo atual
                                  // (as funções de cobertura usam o estado do Zustand que acabamos de setar)
                                  const currentEquips = useOrderFormStore.getState().equipments;
                                  const coverageValid = updatedItems.every(it => {
                                    // Simulação local da lógica getProductCoverage sem precisar do componente
                                    const p = (productsQ.data as any)?.data?.products?.find((prod: any) => prod.id === it.productId);
                                    if (p?.logistics_type !== 'draft') return true;
                                    
                                    let provided = 0;
                                    currentEquips.forEach(eq => {
                                      if (eq.assignedProductId === it.productId) {
                                        if (eq.capacityLiters) provided += eq.capacityLiters * eq.quantity;
                                        else {
                                          const litersMatch = eq.description.match(/(\d+)\s*l/i);
                                          if (litersMatch) provided += Number(litersMatch[1]) * eq.quantity;
                                        }
                                      }
                                    });
                                    return provided >= it.quantity;
                                  });

                                  if (allPricesResolved && coverageValid && updatedItems.length > 0) {
                                    setStep("delivery");
                                    toast.success("Pedido repetido com sucesso. Revise a entrega.");
                                  } else {
                                    setStep("items");
                                    if (!allPricesResolved) toast.error(`Não foi possível resolver o preço de: ${firstErrorProduct}`);
                                    else if (!coverageValid) toast.error("A logística do pedido anterior precisa de revisão.");
                                    else toast.warning("Revise os itens do pedido.");
                                  }
                                } catch (err) {
                                  console.error("Erro ao repetir pedido:", err);
                                  toast.error("Erro ao processar repetição do pedido.");
                                } finally {
                                  setIsResolvingRepeat(false);
                                }
                              }}
                              disabled={isResolvingRepeat}
                            >
                              {isResolvingRepeat ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                              Repetir
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "items" && clientId && companyId && (
        <div className="grid gap-6 md:grid-cols-4">
          <div className="md:col-span-3 space-y-6">
            <Card className="shadow-none border-none sm:border">
              <CardHeader className="pb-3"><CardTitle className="text-xl">1. Produtos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Filtrar produtos..." className="pl-9" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {((productsQ.data as any)?.data?.products || []).filter((p: any) => 
                    !productSearch || p.description?.toLowerCase().includes(productSearch.toLowerCase())
                  ).map((p: any) => (
                    <ProductCard 
                      key={p.id}
                      product={p}
                      clientId={clientId!}
                      addItem={addItem}
                      removeItem={removeItem}
                      updateItemPrice={updateItemPrice}
                      cartItem={items.find(it => it.productId === p.id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none border-none sm:border">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-xl">2. Equipamentos</CardTitle>
                <div className="flex gap-2">
                   <Button variant="outline" size="sm" className="text-xs h-8" onClick={suggestEquipments} disabled={choppItems.length === 0}>
                     ✨ Sugerir
                   </Button>
                   <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowAddEquip(true)}>
                     <Plus className="h-3 w-3 mr-1"/> Manual
                   </Button>
                </div>
              </CardHeader>
              <CardContent>
                 {choppItems.length === 0 ? (
                    <div className="py-6 text-center border-2 border-dashed rounded-xl bg-muted/5">
                      <p className="text-sm text-muted-foreground">Adicione produtos de chope para calcular os equipamentos.</p>
                    </div>
                 ) : (
                   <>
                     {equipments.length === 0 && (
                       <div className="mb-6 p-4 border rounded-xl bg-primary/5 border-primary/10">
                         <p className="text-sm font-bold text-primary mb-1">Necessidade do pedido:</p>
                         <p className="text-xs text-muted-foreground">
                           • {getRequiredVias()} {getRequiredVias() === 1 ? 'via' : 'vias'} de chopeira<br/>
                           • {choppItems.reduce((acc, it) => acc + it.quantity, 0)} L em barris
                         </p>
                       </div>
                     )}

                     {suggestionDirty && (
                        <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
                          <p className="text-[10px] text-yellow-800 font-medium">Produtos alterados. Recalcular equipamentos?</p>
                          <Button variant="link" size="sm" className="h-6 text-[10px] text-yellow-800 underline" onClick={suggestEquipments}>Recalcular sugestão</Button>
                        </div>
                     )}
                     
                     <div className="space-y-3">
                        {equipments.length > 0 && (
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Equipamentos Selecionados</p>
                        )}
                        {equipments.map((eq, idx) => (
                          <div key={`${eq.equipmentTypeId}-${eq.assignedProductId || 'unassigned'}-${idx}`} className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                             <div>
                                <p className="text-sm font-bold">{eq.description}</p>
                                <p className="text-xs text-muted-foreground">Qtd: {eq.quantity}</p>
                                {eq.assignedProductId && (
                                  <Badge variant="outline" className="text-[9px] h-3 px-1 mt-1 font-normal">
                                    Para: {items.find(i => i.productId === eq.assignedProductId)?.description || "Produto removido"}
                                  </Badge>
                                )}
                             </div>
                             <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateEquipmentQty(eq.equipmentTypeId, eq.quantity - 1, eq.assignedProductId)}>-</Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateEquipmentQty(eq.equipmentTypeId, eq.quantity + 1, eq.assignedProductId)}>+</Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeEquipment(eq.equipmentTypeId, eq.assignedProductId)}><Trash2 className="h-4 w-4"/></Button>
                             </div>
                          </div>
                        ))}
                     </div>

                     {equipments.length > 0 && (
                       <div className="mt-6 border-t pt-4">
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Cobertura</p>
                         <EquipmentCoverageIndicators />
                       </div>
                     )}
                   </>
                 )}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="md:sticky md:top-6 shadow-sm border-primary/10">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Resumo do Pedido</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="space-y-2 max-h-[30vh] sm:max-h-[40vh] overflow-y-auto pr-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Itens</p>
                  {items.map(it => (
                    <div key={it.productId} className="flex flex-col py-2 border-b border-dashed last:border-0">
                       <div className="flex justify-between items-center text-xs gap-2">
                          <span className="font-bold truncate flex-1">{it.description}</span>
                          <span className="font-mono font-bold shrink-0">{it.quantity}{it.description?.toUpperCase().includes("CHOPP") ? " L" : ""}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5">
                          <span className={it.manualPrice ? "text-blue-600 font-medium" : ""}>
                            R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(it.appliedUnitPrice)}/un
                          </span>
                          <span>Sub: R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(it.total)}</span>
                       </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-[10px] text-muted-foreground italic">Nenhum item adicionado</p>}

                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-4">Equipamentos</p>
                  {equipments.map((eq, idx) => (
                    <div key={`${eq.equipmentTypeId}-${eq.assignedProductId}-${idx}`} className="flex justify-between items-center text-xs py-2 border-b border-dashed last:border-0 gap-2">
                       <span className="truncate flex-1">{eq.description}</span>
                       <span className="font-mono font-bold shrink-0">{eq.quantity}x</span>
                    </div>
                  ))}
                  {equipments.length === 0 && <p className="text-[10px] text-muted-foreground italic">Nenhum equipamento</p>}
                </div>
                
                <Separator className="bg-primary/5" />
                
                <div className="space-y-1">
                   <CoverageSummary />
                </div>

                <div className="pt-2">
                  <Button 
                    className="w-full py-6 text-sm sm:text-base font-bold shadow-md active:scale-[0.98] transition-transform" 
                    disabled={!isCoverageValid()} 
                    onClick={() => setStep("delivery")}
                  >
                    Próximo Passo <ChevronRight className="ml-2 h-4 w-4"/>
                  </Button>
                  {!isCoverageValid() && (
                    <div className="mt-2 p-2 bg-destructive/5 rounded border border-destructive/10 animate-pulse">
                      <p className="text-[10px] text-destructive text-center font-bold">
                        Barris insuficientes para cobertura dos litros.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === "delivery" && clientId && (
        <Card className="shadow-none border-none sm:border">
            <CardHeader><CardTitle className="text-lg">3. Entrega</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo do Pedido</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className={`h-16 flex flex-col gap-1 border-2 transition-all ${deliver ? 'border-orange-500 bg-orange-50/50 ring-1 ring-orange-500' : 'hover:border-primary/50'}`}
                    onClick={() => setDelivery(true, deliveryAt)}
                  >
                    <Truck className={`h-5 w-5 ${deliver ? 'text-orange-600' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-bold ${deliver ? 'text-orange-700' : ''}`}>ENTREGA</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className={`h-16 flex flex-col gap-1 border-2 transition-all ${!deliver ? 'border-orange-500 bg-orange-50/50 ring-1 ring-orange-500' : 'hover:border-primary/50'}`}
                    onClick={() => setDelivery(false, deliveryAt)}
                  >
                    <UserIcon className={`h-5 w-5 ${!deliver ? 'text-orange-600' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-bold ${!deliver ? 'text-orange-700' : ''}`}>RETIRADA</span>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{deliver ? "Data de Entrega" : "Data da Retirada"}</Label>
                  <Input type="date" value={deliveryAt?.split('T')[0] || ""} onChange={(e) => setDelivery(deliver, e.target.value)} />
                </div>
                {deliver && (
                  <div className="space-y-2">
                    <Label>Horário Previsto (Opcional)</Label>
                    <Input type="time" onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (deliveryAt) {
                        const date = deliveryAt.split('T')[0];
                        setDelivery(deliver, `${date}T${e.target.value}:00`);
                      }
                    }} />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="returnEq" checked={returnEquipment} onCheckedChange={(checked: boolean) => setReturn(!!checked, returnAt)} />
                <Label htmlFor="returnEq">Recolher equipamentos?</Label>
              </div>

              {returnEquipment && (
                <div className="space-y-2">
                  <Label>Data de Recolhimento</Label>
                  <Input type="date" value={returnAt?.split('T')[0] || ""} onChange={(e) => setReturn(returnEquipment, e.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <Label>Observações do Pedido</Label>
                <Textarea placeholder="Instruções de entrega, detalhes adicionais..." value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("items")}>Voltar</Button>
                <Button onClick={() => setStep("payment")}>Próximo</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "payment" && clientId && (
          <Card className="shadow-none border-none sm:border">
            <CardHeader><CardTitle className="text-lg">4. Pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <p className="text-sm text-muted-foreground italic">Opções de pagamento sincronizadas com o ERP para este cliente.</p>
               
               {localPaymentOptions.loading ? (
                 <div className="flex flex-col items-center justify-center py-8 space-y-3">
                   <Loader2 className="h-8 w-8 animate-spin text-primary" />
                   <p className="text-sm font-medium animate-pulse">Carregando opções do ERP...</p>
                 </div>
               ) : localPaymentOptions.error ? (
                 <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center border rounded-lg bg-destructive/5 border-destructive/20">
                   <div className="p-3 rounded-full bg-destructive/10 text-destructive">
                     <AlertCircle className="h-6 w-6" />
                   </div>
                   <div className="space-y-1">
                     <p className="text-sm font-bold text-destructive">Não foi possível carregar as opções de pagamento.</p>
                     <p className="text-xs text-muted-foreground max-w-[300px]">{localPaymentOptions.error}</p>
                   </div>
                   <Button 
                     variant="outline" 
                     size="sm" 
                     onClick={() => loadPaymentOptionsDirectly()}
                     className="gap-2"
                   >
                     <RefreshCcw className="h-3 w-3" />
                     Tentar novamente
                   </Button>
                 </div>
               ) : (
                 <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Condição de Pagamento</Label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={paymentTermId || ""}
                        onChange={(e) => setPayment(Number(e.target.value), paymentMethodId)}
                      >
                        <option value="">Selecione...</option>
                        {localPaymentOptions.data?.paymentTerms?.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.description}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Forma de Pagamento</Label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={paymentMethodId || ""}
                        onChange={(e) => setPayment(paymentTermId, Number(e.target.value))}
                      >
                        <option value="">Selecione...</option>
                        {localPaymentOptions.data?.paymentMethods?.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.description}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Venda</Label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={saleTypeId || ""}
                        onChange={(e) => setSaleType(Number(e.target.value))}
                      >
                        <option value="">Selecione...</option>
                        {localPaymentOptions.data?.saleTypes?.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.description}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep("delivery")}>Voltar</Button>
                    <Button 
                      onClick={() => setStep("review")}
                      disabled={!paymentTermId || !paymentMethodId || !saleTypeId}
                    >
                      Revisar Pedido
                    </Button>
                  </div>
                </>
               )}

            </CardContent>
          </Card>
        )}

        {step === "review" && clientId && (
          <Card className="shadow-none border-none sm:border">
            <CardHeader><CardTitle className="text-lg">5. Revisão Final</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {submissionStatus === "unknown" && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
                  <p className="text-sm font-bold text-yellow-800">
                    {isEditing ? "Não foi possível confirmar a atualização." : "Não foi possível confirmar se o pedido foi criado."}
                  </p>
                  <p className="text-xs text-yellow-700">Pode ter ocorrido um timeout ou falha de rede. As alterações podem ter sido salvas no ERP mas a resposta não chegou.</p>
                  <div className="flex gap-2">
                    <Button variant="default" className="bg-yellow-600 hover:bg-yellow-700 h-8" onClick={isEditing ? handleUpdateOrder : handleCreateOrder}>
                      Tentar novamente
                    </Button>
                    <Button variant="outline" className="h-8 border-yellow-300" onClick={() => setSubmissionStatus("editing")}>
                      Voltar
                    </Button>
                  </div>
                </div>
              )}


              {submissionStatus === "created" && submissionMeta?.orderNumber && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                  <div>
                    <p className="text-lg font-bold text-green-800">
                      {isEditing ? "Pedido atualizado com sucesso!" : "Pedido criado no ERP!"}
                    </p>
                    <p className="text-sm text-green-700">Nº {submissionMeta.orderNumber}</p>
                  </div>

                  <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => navigate({ to: "/pedidos-venda", search: {} as any })}>
                    Ir para Pedidos
                  </Button>
                </div>
              )}


              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <div>
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Cliente</Label>
                    <p className="font-bold">{clientName}</p>
                    <p className="text-xs text-muted-foreground">ID ERP: {clientId}</p>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Logística</Label>
                    <div className="text-sm space-y-1">
                      <p className="flex items-center gap-2">
                        <Badge variant="outline" className="h-5 text-[10px] bg-orange-50 border-orange-200 text-orange-700 font-bold">{deliver ? "Entrega" : "Retirada"}</Badge>
                        {deliveryAt && <span>{formatDateOnly(deliveryAt)} {deliver && deliveryAt.includes('T') ? ` às ${deliveryAt.split('T')[1].slice(0, 5)}` : ''}</span>}

                      </p>
                      {returnEquipment && (
                        <p className="flex items-center gap-2">
                          <Badge variant="outline" className="h-5 text-[10px]">Recolhimento</Badge>
                          {returnAt && <span>{formatDateOnly(returnAt)}</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Pagamento</Label>
                    <div className="text-sm space-y-1">
                      <p><strong>Condição:</strong> {localPaymentOptions.data?.paymentTerms?.find((t: any) => t.id === paymentTermId)?.description || "—"}</p>
                      <p><strong>Forma:</strong> {localPaymentOptions.data?.paymentMethods?.find((m: any) => m.id === paymentMethodId)?.description || "—"}</p>
                      <p><strong>Tipo de Venda:</strong> {localPaymentOptions.data?.saleTypes?.find((s: any) => s.id === saleTypeId)?.description || "—"}</p>
                    </div>
                  </div>

                  {notes && (
                    <div>
                      <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">Observações</Label>
                      <p className="text-sm italic p-2 border rounded bg-muted/5">{notes}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <Label className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider mb-2 block">Itens e Equipamentos</Label>
                    <div className="border rounded-lg divide-y bg-card overflow-hidden">
                      {items.map(it => (
                        <div key={it.productId} className="p-3 text-sm">
                          <div className="flex justify-between font-bold">
                            <span>{it.description}</span>
                            <span>{it.quantity}{it.description?.toUpperCase().includes("CHOPP") ? "L" : "x"}</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.appliedUnitPrice)}/un
                              {it.manualPrice && <Badge variant="outline" className="ml-2 text-[9px] h-3 px-1 text-blue-600 border-blue-200">Manual</Badge>}
                            </span>
                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.total)}</span>
                          </div>
                        </div>
                      ))}
                      {equipments.map((eq, idx) => (
                        <div key={`${eq.equipmentTypeId}-${eq.assignedProductId}-${idx}`} className="p-2 px-3 text-xs bg-muted/30 flex justify-between italic text-muted-foreground">
                          <span>{eq.description}</span>
                          <span>{eq.quantity}x</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-2 bg-primary/5 border-primary/10">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(items.reduce((acc: number, it: any) => acc + it.total, 0))}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold border-t pt-2 text-primary">
                      <span>Total Geral:</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(items.reduce((acc: number, it: any) => acc + it.total, 0))}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t">
                <Button variant="outline" onClick={() => setStep("payment")} disabled={submissionStatus === "submitting"}>Voltar</Button>
                {submissionStatus !== "created" && (
                  <Button 
                    size="lg" 
                    className={`px-8 min-w-[160px] font-bold ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`} 
                    onClick={isEditing ? handleUpdateOrder : handleCreateOrder} 
                    disabled={submissionStatus === "submitting"}
                  >
                    {submissionStatus === "submitting" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> {isEditing ? "Salvando..." : "Criando..."}</>
                    ) : (
                      isEditing ? "Salvar Alterações" : "Finalizar Pedido"
                    )}
                  </Button>
                )}
                {submissionStatus === "created" && (
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1 py-1.5 px-3">
                      <CheckCircle2 className="h-4 w-4" />
                      Pedido {submissionMeta?.orderNumber} {isEditing ? 'atualizado' : 'criado'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground animate-pulse">Redirecionando...</span>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        )}

        {/* Sprint 8.9.19: Fallback UI para estado inesperado (prevenir tela branca) */}
        {step === "review" && submissionStatus === "created" && !submissionMeta?.orderNumber && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4 text-center border rounded-xl bg-card">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Pedido Processado</h3>
              <p className="text-sm text-muted-foreground">O pedido foi enviado com sucesso ao ERP.</p>
            </div>
            <Button onClick={() => navigate({ to: "/pedidos-venda", search: { status: "all" } as any })}>
              Voltar para a Lista
            </Button>
          </div>
        )}


      </div>
    </div>
  );
}


function ManualEquipmentSheet({ 
  open, 
  onOpenChange, 
  equipmentTypes, 
  choppItems,
  addEquipment,
  getProductCoverage
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  equipmentTypes: any[];
  choppItems: any[];
  addEquipment: (eq: OrderEquipment) => void;
  getProductCoverage: (productId: number) => { required: number, provided: number };
}) {
  const [selectedType, setSelectedType] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [assignedProductId, setAssignedProductId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedType(null);
      setQuantity(1);
      setAssignedProductId(null);
    }
  }, [open]);

  const isKeg = selectedType?.equipment_role === 'KEG' || selectedType?.description?.toLowerCase().includes("barril");

  // Regra de Cobertura Restante (Item 2)
  const uncoveredChoppItems = choppItems.filter(it => {
    const cov = getProductCoverage(it.productId);
    return (it.quantity - cov.provided) > 0;
  });

  useEffect(() => {
    if (selectedType && isKeg) {
      if (uncoveredChoppItems.length > 0) {
        // Pré-seleção automática (Item 4)
        setAssignedProductId(uncoveredChoppItems[0].productId);
      } else {
        setAssignedProductId(null);
      }
    } else {
      setAssignedProductId(null);
    }
  }, [selectedType, isKeg, uncoveredChoppItems.length]); // Depende do length para evitar loops infinitos se a lista mudar

  const handleAdd = () => {
    if (!selectedType) return;
    
    if (isKeg) {
      if (uncoveredChoppItems.length === 0) {
        toast.error("Todos os produtos de chopp já possuem barris suficientes.");
        return;
      }
      if (!assignedProductId) {
        toast.error("Por favor, selecione para qual chope é este barril.");
        return;
      }
    }

    const role = selectedType.equipment_role === 'dispenser' || selectedType.description?.toLowerCase().includes("chopeira")
      ? "TAP"
      : isKeg ? "KEG" : "OTHER";

    const tapLines = selectedType.tap_count || Number(selectedType.description.match(/(\d+)\s*vias/i)?.[1] || 0);
    const capacityLiters = selectedType.capacity_liters || Number(selectedType.description.match(/(\d+)\s*l/i)?.[1] || 0);

    let finalDescription = selectedType.description;
    if (isKeg && assignedProductId) {
      const product = choppItems.find(p => p.productId === assignedProductId);
      if (product) {
        const style = product.description.split(" ")[0].toUpperCase();
        finalDescription = `${selectedType.description} (${style})`;
      }
    }

    addEquipment({
      equipmentTypeId: selectedType.id,
      description: finalDescription,
      quantity,
      role,
      tapLines: tapLines > 0 ? tapLines : undefined,
      capacityLiters: capacityLiters > 0 ? capacityLiters : undefined,
      assignedProductId: isKeg ? assignedProductId : null
    });

    toast.success("Equipamento adicionado");
    onOpenChange(false);
  };

  const showProductSelection = isKeg; // Sempre mostrar se for barril para transparência, mas com lógica de filtro

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] sm:h-[600px] rounded-t-2xl px-0">
        <SheetHeader className="px-6 pb-2">
          <SheetTitle>Adicionar equipamento</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-full px-6">
          <div className="space-y-6 pb-20">
            {!selectedType ? (
              <div className="space-y-2 py-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Equipamentos Disponíveis</p>
                <div className="grid grid-cols-1 gap-2">
                  {equipmentTypes.map(et => {
                    const isDispenser = et.equipment_role === 'dispenser' || et.description?.toLowerCase().includes("chopeira");
                    const isKegLocal = et.equipment_role === 'KEG' || et.description?.toLowerCase().includes("barril");
                    const tapCount = et.tap_count || et.description.match(/(\d+)\s*vias/i)?.[1];
                    const capacity = et.capacity_liters || et.description.match(/(\d+)\s*l/i)?.[1];
                    
                    return (
                      <Button 
                        key={et.id} 
                        variant="outline" 
                        className="h-auto py-3 px-4 justify-start text-left flex flex-col items-start gap-1"
                        onClick={() => setSelectedType(et)}
                      >
                        <span className="font-bold text-sm">{et.description}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {isDispenser ? `Chopeira · ${tapCount || 1} via(s)` : isKegLocal ? `Barril · ${capacity || 0} L` : 'Outro'}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-4 animate-in slide-in-from-right duration-300">
                <Button variant="ghost" size="sm" className="h-8 px-0 -ml-1 text-muted-foreground" onClick={() => setSelectedType(null)}>
                  <ChevronLeft className="h-4 w-4 mr-1"/> Voltar para lista
                </Button>
                
                <div className="p-4 border rounded-xl bg-muted/5">
                  <h3 className="font-bold">{selectedType.description}</h3>
                  <p className="text-[10px] text-muted-foreground uppercase">
                    {selectedType.equipment_role === 'dispenser' || selectedType.description?.toLowerCase().includes("chopeira") ? 'Chopeira' : isKeg ? 'Barril' : 'Outro'}
                  </p>
                </div>

                {showProductSelection && (
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider">Para qual chopp?</Label>
                    {uncoveredChoppItems.length > 0 ? (
                      <Select onValueChange={(val) => setAssignedProductId(Number(val))} value={assignedProductId?.toString()}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produto..." />
                        </SelectTrigger>
                        <SelectContent>
                          {uncoveredChoppItems.map(p => (
                            <SelectItem key={p.productId} value={p.productId.toString()}>
                              {p.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                        <p className="text-xs text-yellow-800 font-medium">Todos os produtos de chopp já possuem barris suficientes.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider">Quantidade</Label>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
                    <span className="text-lg font-bold w-8 text-center">{quantity}</span>
                    <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setQuantity(quantity + 1)}>+</Button>
                  </div>
                </div>

                <div className="pt-4">
                  <Button className="w-full py-6 text-lg font-bold" onClick={handleAdd}>
                    Adicionar Equipamento
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}