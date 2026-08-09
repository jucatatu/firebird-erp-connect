import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, useMyProfile, useMyCompanies } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Plus, ShoppingCart, Truck, CreditCard, ChevronRight, ChevronLeft, Trash2, CheckCircle2, Send } from "lucide-react";
import { useErpClients, useErpProducts, useErpEquipmentTypes, useErpPrice, useCreateErpOrder } from "@/hooks/use-erp";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/pedidos-venda/novo")({
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
  appliedPrice
}: { 
  productId: number, 
  clientId: number, 
  unit: string,
  onPriceLoaded?: (price: number) => void,
  manualPrice?: boolean,
  appliedPrice?: number
}) {
  const { data, isLoading } = useErpPrice({ productId, clientId });
  
  useEffect(() => {
    if (data?.ok && data.data?.priceFound && onPriceLoaded) {
      onPriceLoaded(data.data.unitPrice);
    }
  }, [data, onPriceLoaded]);

  if (isLoading) return <p className="text-xs text-muted-foreground animate-pulse mt-1">Consultando preço...</p>;
  if (!data?.ok || !data.data?.priceFound) return <p className="text-xs text-destructive font-medium mt-1">Preço não cadastrado</p>;
  
  const erpPrice = data.data.unitPrice;
  const strategyLabel = data.data.strategy === 'client_specific' ? 'Preço do cliente' : 'Preço padrão';
  
  return (
    <div className="mt-1">
      <div className="flex flex-col">
        <span className="text-sm font-bold text-primary">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(appliedPrice ?? erpPrice)} / {unit}
        </span>
        {manualPrice && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-orange-600 font-bold uppercase">Preço alterado manualmente</span>
            <span className="text-[9px] text-muted-foreground">Original ERP: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(erpPrice)}</span>
          </div>
        )}
        {!manualPrice && <p className="text-[10px] font-medium uppercase text-muted-foreground tracking-tight">{strategyLabel}</p>}
      </div>
    </div>
  );
}

function SubtotalDisplay({ productId, clientId, quantity, appliedPrice }: { productId: number, clientId: number, quantity: number, appliedPrice?: number }) {
  const { data } = useErpPrice({ productId, clientId });
  if (!data?.ok || (!data?.data?.priceFound && !appliedPrice)) return null;
  
  const price = appliedPrice ?? data?.data?.unitPrice;
  if (price === undefined) return null;
  const subtotal = price * quantity;
  return (
    <p className="text-xs font-bold text-muted-foreground">
      Subtotal: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}
    </p>
  );
}

function ProductCard({ product, clientId, addItem, removeItem, updateItemPrice, cartItem }: { product: any, clientId: number, addItem: any, removeItem: any, updateItemPrice: any, cartItem: any }) {
  const punit = product.unit?.code || "UN";
  const isChopp = product.equipment_mode === 'CHOPE' || product.requires_equipment || punit === "L";
  const pstep = Number(product.quantity_step || 1);
  const pinitial = Number(product.default_quantity || 1);
  const [localQty, setLocalQty] = useState(pinitial);
  const [erpPrice, setErpPrice] = useState<number | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  useEffect(() => {
    if (cartItem) {
      setLocalQty(cartItem.quantity);
    } else {
      setLocalQty(pinitial);
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
    if (cartItem) setIsEditingPrice(true);
  };

  const shortcuts = isChopp ? [10, 20, 30, 50] : [];

  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 shadow-sm transition-colors ${cartItem ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1" onClick={handlePriceClick}>
          <h4 className="font-bold text-sm leading-tight">{product.description}</h4>
          {isEditingPrice ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                step="0.01"
                className="h-8 w-24 text-sm font-bold"
                defaultValue={cartItem?.appliedUnitPrice ?? (erpPrice || 0)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = Number((e.target as HTMLInputElement).value);
                    if (val > 0) updateItemPrice(product.id, val);
                    setIsEditingPrice(false);
                  }
                  if (e.key === 'Escape') setIsEditingPrice(false);
                }}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val > 0 && val !== (cartItem?.appliedUnitPrice)) {
                    updateItemPrice(product.id, val);
                  }
                  setIsEditingPrice(false);
                }}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={(e) => {
                e.stopPropagation();
                updateItemPrice(product.id, null);
                setIsEditingPrice(false);
              }} title="Resetar para preço ERP">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <ProductPriceDisplay 
              productId={product.id} 
              clientId={clientId} 
              unit={punit} 
              onPriceLoaded={setErpPrice}
              manualPrice={cartItem?.manualPrice}
              appliedPrice={cartItem?.appliedUnitPrice}
            />
          )}
        </div>
        {cartItem && <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] h-5 shrink-0"><CheckCircle2 className="h-3 w-3 mr-1"/> Adicionado</Badge>}
      </div>

      {isChopp && (
        <div className="flex flex-wrap gap-1 mt-1">
          {shortcuts.map(val => (
            <Button 
              key={val} 
              variant="outline" 
              size="sm" 
              className="h-6 px-2 text-[10px] font-bold"
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
           <SubtotalDisplay productId={product.id} clientId={clientId} quantity={localQty} appliedPrice={cartItem?.appliedUnitPrice} />
           {!cartItem ? (
             <Button size="sm" className="h-8 px-3 text-xs mt-1" onClick={() => {
               if (localQty > 0 && erpPrice !== null) {
                 addItem({ 
                   productId: product.id, 
                   description: product.description, 
                   quantity: localQty, 
                   unitPrice: erpPrice 
                 });
               }
             }} disabled={erpPrice === null}>Adicionar</Button>
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
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<"client" | "items" | "delivery" | "payment" | "review">("client");

  const {
    clientId, clientName, companyId, items, equipments, deliver, deliveryAt,
    returnEquipment, returnAt, notes, paymentTermId, paymentMethodId, saleTypeId,
    idempotencyKey, submissionStatus,
    setClient, setCompany, addItem, removeItem, updateItemQuantity, updateItemPrice, addEquipment, removeEquipment,
    setDelivery, setReturn, setNotes, setPayment, setSaleType, reset,
    setIdempotencyKey, setSubmissionStatus, resetItemsAndClient
  } = useOrderFormStore();

  const myProfile = useMyProfile(user);
  const myCompanies = useMyCompanies(user);

  useEffect(() => {
    // Ao montar a página de Novo Pedido, SEMPRE limpamos o estado para garantir um fluxo limpo,
    // a menos que o usuário esteja em um rascunho ativo que não foi finalizado.
    // Se o status for "created" ou "failed", o reset é obrigatório.
    if (submissionStatus === "created" || submissionStatus === "failed") {
      resetItemsAndClient();
    }
    
    // Se não houver clientId, forçamos um reset para garantir que nenhum lixo de itens permaneça
    if (!clientId && items.length > 0) {
      resetItemsAndClient();
    }
    
    if (myCompanies.data && myCompanies.data.length === 1 && !companyId) {
      setCompany(myCompanies.data[0]);
    }
  }, [myCompanies.data, companyId, setCompany, submissionStatus, reset]);

  useEffect(() => {
    if (!idempotencyKey) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [idempotencyKey, setIdempotencyKey]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const [clientSearch, setClientSearch] = useState("");
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
    return p?.equipment_mode === 'CHOPE' || p?.requires_equipment;
  });

  const getRequiredVias = () => choppItems.length;

  const getAvailableVias = () => {
    let total = 0;
    equipments.forEach(eq => {
      // Usar metadados se disponíveis, senão fallback para parsing de nome
      if (eq.tapLines) {
        total += eq.tapLines * eq.quantity;
      } else {
        const et = (equipmentTypesQ.data as any)?.data?.equipmentTypes?.find((type: any) => type.id === eq.equipmentTypeId);
        const desc = (eq.description || et?.description || "").toLowerCase();
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
    const p = (productsQ.data as any)?.data?.products?.find((prod: any) => prod.id === productId);
    const pDesc = (p?.description || "").toLowerCase();
    const style = pDesc.split(" ")[0] || "";
    
    equipments.forEach(eq => {
      const desc = eq.description.toLowerCase();
      // Regra: se o equipamento for um barril (KEG)
      if (eq.role === 'KEG' || desc.includes("barril")) {
        // Se houver apenas um estilo de chope, qualquer barril conta.
        // Se houver múltiplos, o barril deve conter o estilo no nome (injetado pelo suggest) ou ser genérico
        const isGeneric = !desc.includes("(") || desc.includes("genérico");
        const matchesStyle = style && desc.includes(style);

        if (choppItems.length === 1 || isGeneric || matchesStyle) {
           if (eq.capacityLiters) {
             provided += eq.capacityLiters * eq.quantity;
           } else {
             const litersMatch = desc.match(/(\d+)\s*l/i);
             if (litersMatch) provided += Number(litersMatch[1]) * eq.quantity;
           }
        }
      }
    });

    return { required: it.quantity, provided };
  };

  const [suggestionDirty, setSuggestionDirty] = useState(false);
  useEffect(() => {
    if (equipments.length > 0 && choppItems.length > 0) {
      const viasValid = getAvailableVias() >= getRequiredVias();
      const litersValid = choppItems.every(it => {
        const cov = getProductCoverage(it.productId);
        return cov.provided >= cov.required; // Mudamos para >= para ser mais flexível se manual for maior
      });
      if (!viasValid || !litersValid) setSuggestionDirty(true);
      else setSuggestionDirty(false);
    }
  }, [items, equipments]);

  const suggestEquipments = () => {
    const newEquips: any[] = [];
    const allEquipTypes = (equipmentTypesQ.data as any)?.data?.equipmentTypes || [];
    
    // 1. Otimizar Vias (CHOPEIRAS)
    const requiredVias = getRequiredVias();
    if (requiredVias > 0) {
      const chopeiras = allEquipTypes.filter((et: any) => 
        et.equipment_mode === 'CHOPE' || et.equipment_role === 'TAP' || et.description?.toLowerCase().includes("chopeira")
      );

      let remainingVias = requiredVias;
      // Ordenar por maior número de vias para usar menos equipamentos
      const sortedChopeiras = [...chopeiras].sort((a, b) => {
         const vA = a.tap_lines || Number(a.description.match(/(\d+)\s*vias/i)?.[1] || 1);
         const vB = b.tap_lines || Number(b.description.match(/(\d+)\s*vias/i)?.[1] || 1);
         return vB - vA;
      });

      for (const ch of sortedChopeiras) {
        const vias = ch.tap_lines || Number(ch.description.match(/(\d+)\s*vias/i)?.[1] || 1);
        if (remainingVias <= 0) break;
        const qty = Math.floor(remainingVias / vias);
        if (qty > 0) {
          newEquips.push({ 
            equipmentTypeId: ch.id, 
            description: ch.description, 
            quantity: qty,
            role: "TAP",
            tapLines: vias
          });
          remainingVias -= qty * vias;
        }
      }

      // Se sobrar, pegar a menor chopeira que cubra o resto
      if (remainingVias > 0 && sortedChopeiras.length > 0) {
        const smallestToCover = [...sortedChopeiras].reverse().find(ch => {
          const vias = ch.tap_lines || Number(ch.description.match(/(\d+)\s*vias/i)?.[1] || 1);
          return vias >= remainingVias;
        });
        if (smallestToCover) {
          const vias = smallestToCover.tap_lines || Number(smallestToCover.description.match(/(\d+)\s*vias/i)?.[1] || 1);
          const existing = newEquips.find(e => e.equipmentTypeId === smallestToCover.id);
          if (existing) existing.quantity += 1;
          else newEquips.push({ 
            equipmentTypeId: smallestToCover.id, 
            description: smallestToCover.description, 
            quantity: 1,
            role: "TAP",
            tapLines: vias
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
            capacityLiters: capacity
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
             capacityLiters: capacity
           });
        }
      }
    });

    useOrderFormStore.setState({ equipments: newEquips });
    setSuggestionDirty(false);
    toast.success("Sugestão otimizada de equipamentos aplicada");
  };

  const updateEquipmentQty = (id: number, qty: number) => {
    if (qty <= 0) removeEquipment(id);
    else {
      const eqs = [...equipments];
      const idx = eqs.findIndex(e => e.equipmentTypeId === id);
      if (idx >= 0) {
        eqs[idx].quantity = qty;
        useOrderFormStore.setState({ equipments: eqs });
      }
    }
  };

  const isCoverageValid = () => {
    if (choppItems.length === 0) return true;
    if (getAvailableVias() < getRequiredVias()) return false;
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
            Vias (Chopeiras) 
            {getAvailableVias() >= getRequiredVias() ? <CheckCircle2 className="h-3 w-3 text-green-600"/> : <Loader2 className="h-3 w-3 text-destructive animate-spin"/>}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-sm">Requeridas: {getRequiredVias()}</span>
            <Badge variant={getAvailableVias() >= getRequiredVias() ? "outline" : "destructive"} className={getAvailableVias() >= getRequiredVias() ? "text-green-600 border-green-200 bg-green-50" : ""}>
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
                {diff === 0 ? <CheckCircle2 className="h-3 w-3 text-green-600"/> : null}
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
            </div>
          );
        })}
      </div>
    );
  };

  const CoverageSummary = () => {
    const viasValid = getAvailableVias() >= getRequiredVias();
    const allLitersValid = choppItems.every(it => {
      const cov = getProductCoverage(it.productId);
      return cov.provided >= cov.required;
    });
    
    if (choppItems.length === 0) return null;

    return (
      <div className="space-y-1 mt-2">
         <div className="flex items-center gap-2 text-[10px]">
            {viasValid ? <CheckCircle2 className="h-3 w-3 text-green-600"/> : <Loader2 className="h-3 w-3 text-destructive animate-spin"/>}
            <span className={viasValid ? "text-green-600 font-medium" : "text-destructive font-medium"}>Vias {getAvailableVias()}/{getRequiredVias()}</span>
         </div>
         <div className="flex items-center gap-2 text-[10px]">
            {allLitersValid ? <CheckCircle2 className="h-3 w-3 text-green-600"/> : <Loader2 className="h-3 w-3 text-destructive animate-spin"/>}
            <span className={allLitersValid ? "text-green-600 font-medium" : "text-destructive font-medium"}>Litros Cobertos</span>
         </div>
      </div>
    );
  };

  const handleCreateOrder = async () => {
    if (!clientId || items.length === 0 || submissionStatus === "submitting" || submissionStatus === "created") return;
    if (!myProfile.data?.erp_seller_id) {
      toast.error("Vendedor não mapeado");
      return;
    }
    if (!companyId) {
      toast.error("Empresa não selecionada");
      setStep("client");
      return;
    }
    setSubmissionStatus("submitting");
    const currentKey = idempotencyKey || crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(currentKey);

    try {
      const payload = {
        companyId: companyId as number,
        clientId: clientId,
        sellerId: myProfile.data.erp_seller_id,
        saleTypeId: saleTypeId || 1,
        paymentTermId: paymentTermId || 1,
        paymentMethodId: paymentMethodId || 1,
        deliver,
        deliveryAt: deliveryAt || new Date().toISOString(),
        returnEquipment,
        returnAt: returnEquipment ? returnAt : null,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        equipments: equipments.map(e => ({ equipmentTypeId: e.equipmentTypeId, quantity: e.quantity })),
        notes: notes || null
      };

      const result = await createOrderM.mutateAsync({ data: payload, idempotencyKey: currentKey });
      if (result.ok && result.data) {
        setSubmissionStatus("created", { orderId: result.data.orderId, orderNumber: result.data.orderNumber });
        toast.success(`Pedido criado! Nº ERP: ${result.data.orderNumber}`);
        reset();
        navigate({ to: "/pedidos-venda", search: {} as any });
      } else {
        setSubmissionStatus(result.status === 409 ? "created" : "failed");
        toast.error("Erro ao criar pedido");
      }
    } catch (err) {
      setSubmissionStatus("unknown");
      toast.error("Falha na comunicação");
    }
  };

  return (
    <div className="container max-w-5xl py-6">
      <PageHeader 
        title="Novo Pedido" 
        description="Siga os passos para cadastrar um novo pedido no ERP."
        crumbs={[{ label: "Pedidos", to: "/pedidos-venda" }, { label: "Novo" }]}
      />

      <div className="mb-8 flex items-center justify-between">
        <div className="flex gap-2">
          {[
            { id: "client", label: "Cliente" },
            { id: "items", label: "Itens + Equipamentos" },
            { id: "delivery", label: "Entrega" },
            { id: "payment", label: "Pagamento" },
            { id: "review", label: "Revisão" }
          ].map((s, i) => (
            <Badge key={s.id} variant={step === s.id ? "default" : "outline"} className="px-3 py-1">
              {i + 1}. {s.label}
            </Badge>
          ))}
        </div>
        {clientId && <p className="text-sm font-medium">{clientName}</p>}
      </div>

      {step === "client" && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Empresa e Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label>Seleção de Cliente</Label>
              <Input placeholder="Buscar cliente..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
            </div>
            <div className="space-y-2">
              {clientsQ.data?.data?.clients?.map((c) => (
                <div key={c.id} className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-muted" onClick={() => {
                  // Ao trocar de cliente, limpamos itens e equipamentos para evitar vazamento de preços/logística
                  if (clientId && clientId !== c.id && items.length > 0) {
                    if (confirm("Trocar de cliente limpará os itens atuais do carrinho. Deseja continuar?")) {
                      resetItemsAndClient();
                      setClient(c.id, c.name);
                    }
                  } else {
                    setClient(c.id, c.name);
                  }
                }}>
                  {c.name}
                  {clientId === c.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </div>
              ))}
            </div>
            <Button disabled={!clientId} onClick={() => setStep("items")}>Próximo</Button>
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
                        {equipments.map(eq => (
                          <div key={eq.equipmentTypeId} className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm">
                             <div>
                                <p className="text-sm font-bold">{eq.description}</p>
                                <p className="text-xs text-muted-foreground">Qtd: {eq.quantity}</p>
                             </div>
                             <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateEquipmentQty(eq.equipmentTypeId, eq.quantity - 1)}>-</Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateEquipmentQty(eq.equipmentTypeId, eq.quantity + 1)}>+</Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeEquipment(eq.equipmentTypeId)}><Trash2 className="h-4 w-4"/></Button>
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
            <Card className="sticky top-6">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo do Carrinho</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Itens</p>
                  {items.map(it => (
                    <div key={it.productId} className="flex flex-col py-2 border-b border-dashed last:border-0">
                       <div className="flex justify-between items-center text-xs">
                          <span className="font-bold truncate max-w-[150px]">{it.description}</span>
                          <span className="font-mono font-bold">{it.quantity}{it.description?.toUpperCase().includes("CHOPP") ? " L" : ""}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-0.5">
                          <span>R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(it.unitPrice)}/un</span>
                          <span>Subtotal: R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(it.total)}</span>
                       </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-[10px] text-muted-foreground italic">Nenhum item adicionado</p>}

                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-4">Equipamentos</p>
                  {equipments.map(eq => (
                    <div key={eq.equipmentTypeId} className="flex justify-between items-center text-xs py-2 border-b border-dashed last:border-0">
                       <span className="truncate max-w-[150px]">{eq.description}</span>
                       <span className="font-mono font-bold">{eq.quantity}x</span>
                    </div>
                  ))}
                  {equipments.length === 0 && <p className="text-[10px] text-muted-foreground italic">Nenhum equipamento</p>}
                </div>
                
                <Separator />
                
                <div className="space-y-1">
                   <CoverageSummary />
                </div>

                <Button className="w-full" disabled={!isCoverageValid()} onClick={() => setStep("delivery")}>
                  Continuar <ChevronRight className="ml-2 h-4 w-4"/>
                </Button>
                {!isCoverageValid() && (
                  <p className="text-[10px] text-destructive text-center font-medium mt-1">
                    Equipamentos insuficientes para os produtos de chope.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === "delivery" && clientId && (
        <Card>
            <CardHeader><CardTitle className="text-lg">3. Entrega</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2">
                <Checkbox id="deliver" checked={deliver} onCheckedChange={(checked) => setDelivery(!!checked, deliveryAt)} />
                <Label htmlFor="deliver">Deseja entrega?</Label>
              </div>

              {deliver && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data de Entrega</Label>
                    <Input type="date" value={deliveryAt?.split('T')[0] || ""} onChange={(e) => setDelivery(deliver, e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário Previsto (Opcional)</Label>
                    <Input type="time" onChange={(e) => {
                      if (deliveryAt) {
                        const date = deliveryAt.split('T')[0];
                        setDelivery(deliver, `${date}T${e.target.value}:00`);
                      }
                    }} />
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox id="returnEq" checked={returnEquipment} onCheckedChange={(checked) => setReturn(!!checked, returnAt)} />
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
                <Textarea placeholder="Instruções de entrega, detalhes adicionais..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("items")}>Voltar</Button>
                <Button onClick={() => setStep("payment")}>Próximo</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "payment" && clientId && (
          <Card>
            <CardHeader><CardTitle className="text-lg">4. Pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <p className="text-sm text-muted-foreground italic">Opções de pagamento sincronizadas com o ERP para este cliente.</p>
               {/* Futuramente: Carregar termos de pagamento do ERP aqui */}
               <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Condição de Pagamento</Label>
                    <Badge variant="outline">Padrão ERP (ID 1)</Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Venda</Label>
                    <Badge variant="outline">Venda Normal (ID 1)</Badge>
                  </div>
               </div>
               
               <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep("delivery")}>Voltar</Button>
                <Button onClick={() => setStep("review")}>Revisar Pedido</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "review" && clientId && (
          <Card>
            <CardHeader><CardTitle className="text-lg">5. Revisão Final</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Cliente</Label>
                    <p className="font-bold">{clientName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Logística</Label>
                    <p className="text-sm">• {deliver ? `Entrega em ${new Date(deliveryAt!).toLocaleDateString('pt-BR')}` : 'Retirada no local'}</p>
                    <p className="text-sm">• {returnEquipment ? `Recolhimento em ${new Date(returnAt!).toLocaleDateString('pt-BR')}` : 'Sem recolhimento'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Observações</Label>
                    <p className="text-sm italic">{notes || "Nenhuma"}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-muted-foreground">Resumo Financeiro</Label>
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/5">
                    <div className="flex justify-between text-sm">
                      <span>Total de Itens:</span>
                      <span className="font-bold">{items.length}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total Geral:</span>
                      <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(items.reduce((acc, it) => acc + it.total, 0))}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t">
                <Button variant="outline" onClick={() => setStep("payment")} disabled={submissionStatus === "submitting"}>Voltar</Button>
                <Button size="lg" className="px-8" onClick={handleCreateOrder} disabled={submissionStatus === "submitting"}>
                  {submissionStatus === "submitting" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Enviando...</> : "Finalizar Pedido"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}