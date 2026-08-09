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

function ProductPriceDisplay({ productId, clientId, unit }: { productId: number, clientId: number, unit: string }) {
  const { data, isLoading } = useErpPrice({ productId, clientId });
  
  if (isLoading) return <p className="text-xs text-muted-foreground animate-pulse mt-1">Consultando preço...</p>;
  if (!data?.ok || !data.data?.priceFound) return <p className="text-xs text-destructive font-medium mt-1">Preço não cadastrado</p>;
  
  const strategyLabel = data.data.strategy === 'client_specific' ? 'Preço do cliente' : 'Preço padrão';
  
  return (
    <div className="mt-1">
      <p className="text-sm font-bold text-primary">
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.data.unitPrice)} / {unit}
      </p>
      <p className="text-[10px] font-medium uppercase text-muted-foreground tracking-tight">{strategyLabel}</p>
    </div>
  );
}

function SubtotalDisplay({ productId, clientId, quantity }: { productId: number, clientId: number, quantity: number }) {
  const { data } = useErpPrice({ productId, clientId });
  if (!data?.ok || !data.data?.priceFound) return null;
  
  const subtotal = data.data.unitPrice * quantity;
  return (
    <p className="text-xs font-bold text-muted-foreground">
      Subtotal: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}
    </p>
  );
}

function ProductCard({ product, clientId, addItem, removeItem, cartItem }: { product: any, clientId: number, addItem: any, removeItem: any, cartItem: any }) {
  const punit = product.unit?.code || "UN";
  const isChopp = product.requires_equipment || punit === "L";
  const pstep = Number(product.quantity_step || 1);
  const pinitial = Number(product.default_quantity || 1);
  const [localQty, setLocalQty] = useState(cartItem?.quantity || pinitial);

  useEffect(() => {
    if (cartItem) setLocalQty(cartItem.quantity);
  }, [cartItem]);

  const handleQtyChange = (val: number) => {
    const newQty = Math.max(0, val);
    setLocalQty(newQty);
    if (cartItem) {
      addItem({ productId: product.id, description: product.description, quantity: newQty, unitPrice: 0, total: 0 });
    }
  };

  const shortcuts = isChopp ? [10, 20, 30, 50] : [];

  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 shadow-sm transition-colors ${cartItem ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-bold text-sm leading-tight">{product.description}</h4>
          <ProductPriceDisplay productId={product.id} clientId={clientId} unit={punit} />
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
           <SubtotalDisplay productId={product.id} clientId={clientId} quantity={localQty} />
           {!cartItem ? (
             <Button size="sm" className="h-8 px-3 text-xs mt-1" onClick={() => {
               if (localQty > 0) addItem({ productId: product.id, description: product.description, quantity: localQty, unitPrice: 0, total: 0 });
             }}>Adicionar</Button>
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
    setClient, setCompany, addItem, removeItem, updateItemQuantity, addEquipment, removeEquipment,
    setDelivery, setReturn, setNotes, setPayment, setSaleType, reset,
    setIdempotencyKey, setSubmissionStatus, resetItemsAndClient
  } = useOrderFormStore();

  const myProfile = useMyProfile(user);
  const myCompanies = useMyCompanies(user);

  useEffect(() => {
    if (myCompanies.data && myCompanies.data.length === 1 && !companyId) {
      setCompany(myCompanies.data[0]);
    }
  }, [myCompanies.data, companyId, setCompany]);

  useEffect(() => {
    if (!idempotencyKey && step === "client") {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [idempotencyKey, step, setIdempotencyKey]);

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
    return p?.requires_equipment;
  });

  const getRequiredVias = () => choppItems.length;

  const getAvailableVias = () => {
    let total = 0;
    equipments.forEach(eq => {
      const et = (equipmentTypesQ.data as any)?.data?.equipmentTypes?.find((type: any) => type.id === eq.equipmentTypeId);
      if (et?.description?.toLowerCase().includes("vias")) {
        const viasMatch = et.description.match(/(\d+)\s*vias/i);
        if (viasMatch) total += Number(viasMatch[1]) * eq.quantity;
      } else if (et?.description?.toLowerCase().includes("via")) {
        total += 1 * eq.quantity;
      }
    });
    return total;
  };

  const getProductCoverage = (productId: number) => {
    const it = items.find(i => i.productId === productId);
    if (!it) return { required: 0, provided: 0 };
    
    let provided = 0;
    const p = (productsQ.data as any)?.data?.products?.find((prod: any) => prod.id === productId);
    const pName = p?.description?.toLowerCase() || "";
    
    equipments.forEach(eq => {
      const desc = eq.description.toLowerCase();
      if (desc.includes("barril")) {
        // Regra: se houver apenas um estilo, qualquer barril conta.
        // Se houver múltiplos, o barril deve conter o nome do estilo (descrito no suggestEquipments)
        if (choppItems.length === 1 || desc.includes(pName.split(" ")[0])) {
           const litersMatch = desc.match(/(\d+)\s*l/i);
           if (litersMatch) provided += Number(litersMatch[1]) * eq.quantity;
        }
      }
    });

    return { required: it.quantity, provided };
  };

  const [suggestionDirty, setSuggestionDirty] = useState(false);
  useEffect(() => {
    if (equipments.length > 0 && choppItems.length > 0) {
      // Verificação simplificada se a sugestão atende os itens atuais
      const viasValid = getAvailableVias() >= getRequiredVias();
      const litersValid = choppItems.every(it => {
        const cov = getProductCoverage(it.productId);
        return cov.provided === cov.required;
      });
      if (!viasValid || !litersValid) setSuggestionDirty(true);
      else setSuggestionDirty(false);
    }
  }, [items, equipments]);

  const suggestEquipments = () => {
    const newEquips: any[] = [];
    const allEquipTypes = (equipmentTypesQ.data as any)?.data?.equipmentTypes || [];
    
    const requiredVias = getRequiredVias();
    if (requiredVias > 0) {
      const chopeiras = allEquipTypes.filter((et: any) => et.description?.toLowerCase().includes("chopeira"));
      let remainingVias = requiredVias;
      const sortedChopeiras = [...chopeiras].sort((a, b) => {
         const vA = Number(a.description.match(/(\d+)\s*vias/i)?.[1] || 1);
         const vB = Number(b.description.match(/(\d+)\s*vias/i)?.[1] || 1);
         return vB - vA;
      });

      for (const ch of sortedChopeiras) {
        const vias = Number(ch.description.match(/(\d+)\s*vias/i)?.[1] || 1);
        const qty = Math.floor(remainingVias / vias);
        if (qty > 0) {
          newEquips.push({ equipmentTypeId: ch.id, description: ch.description, quantity: qty });
          remainingVias -= qty * vias;
        }
      }
      if (remainingVias > 0 && sortedChopeiras.length > 0) {
        const smallestToCover = [...sortedChopeiras].reverse().find(ch => Number(ch.description.match(/(\d+)\s*vias/i)?.[1] || 1) >= remainingVias);
        if (smallestToCover) {
          const existing = newEquips.find(e => e.equipmentTypeId === smallestToCover.id);
          if (existing) existing.quantity += 1;
          else newEquips.push({ equipmentTypeId: smallestToCover.id, description: smallestToCover.description, quantity: 1 });
        }
      }
    }

    choppItems.forEach(it => {
      let remainingLiters = it.quantity;
      const p = (productsQ.data as any)?.data?.products?.find((prod: any) => prod.id === it.productId);
      const style = p?.description?.split(" ")[0]?.toUpperCase() || "";
      
      const barris = allEquipTypes.filter((et: any) => et.description?.toLowerCase().includes("barril"));
      const sortedBarris = [...barris].sort((a, b) => {
         const lA = Number(a.description.match(/(\d+)\s*l/i)?.[1] || 0);
         const lB = Number(b.description.match(/(\d+)\s*l/i)?.[1] || 0);
         return lB - lA;
      });

      for (const b of sortedBarris) {
        const capacity = Number(b.description.match(/(\d+)\s*l/i)?.[1] || 0);
        if (capacity === 0) continue;
        const qty = Math.floor(remainingLiters / capacity);
        if (qty > 0) {
          newEquips.push({ equipmentTypeId: b.id, description: `${b.description} (${style})`, quantity: qty });
          remainingLiters -= qty * capacity;
        }
      }
      if (remainingLiters > 0 && sortedBarris.length > 0) {
        const smallestToCover = [...sortedBarris].reverse().find(b => Number(b.description.match(/(\d+)\s*l/i)?.[1] || 0) >= remainingLiters);
        if (smallestToCover) {
           newEquips.push({ equipmentTypeId: smallestToCover.id, description: `${smallestToCover.description} (${style})`, quantity: 1 });
        }
      }
    });

    useOrderFormStore.setState({ equipments: newEquips });
    setSuggestionDirty(false);
    toast.success("Sugestão de equipamentos aplicada");
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

  const EquipmentCoverageIndicators = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {choppItems.length === 0 ? (
        <div className="col-span-full py-4 text-center border rounded-lg bg-muted/5">
          <p className="text-xs text-muted-foreground">Adicione um produto de chope para calcular os equipamentos.</p>
        </div>
      ) : (
        <>
          <div className="p-3 border rounded-lg bg-muted/10">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Vias (Chopeiras)</p>
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
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1 truncate">{it.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-mono">{cov.provided} / {cov.required} L</span>
                  {diff > 0 ? (
                    <Badge variant="destructive" className="text-[10px]">Faltam {diff}L</Badge>
                  ) : diff < 0 ? (
                    <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">+{Math.abs(diff)}L excesso</Badge>
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );

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
                <div key={c.id} className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-muted" onClick={() => setClient(c.id, c.name)}>
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
                   <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => suggestEquipments()}>
                     ✨ Sugerir
                   </Button>
                   <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowAddEquip(true)}>
                     <Plus className="h-3 w-3 mr-1"/> Manual
                   </Button>
                </div>
              </CardHeader>
              <CardContent>
                 <EquipmentCoverageIndicators />
                 
                 <div className="space-y-2 mt-4">
                    {equipments.map(eq => (
                      <div key={eq.equipmentTypeId} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
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
                    <div key={it.productId} className="flex justify-between items-center text-xs py-1 border-b border-dashed">
                       <span className="truncate max-w-[120px]">{it.description}</span>
                       <span className="font-mono">{it.quantity}x</span>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-[10px] text-muted-foreground italic">Nenhum item adicionado</p>}

                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-4">Equipamentos</p>
                  {equipments.map(eq => (
                    <div key={eq.equipmentTypeId} className="flex justify-between items-center text-xs py-1 border-b border-dashed">
                       <span className="truncate max-w-[120px]">{eq.description}</span>
                       <span className="font-mono">{eq.quantity}x</span>
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
    </div>
  );
}