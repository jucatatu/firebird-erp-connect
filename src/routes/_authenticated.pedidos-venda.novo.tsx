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
        navigate({ to: "/pedidos-venda" });
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
          {["client", "items", "delivery", "payment", "review"].map((s, i) => (
            <Badge key={s} variant={step === s ? "default" : "outline"} className="px-3 py-1">
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
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
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 shadow-none border-none sm:border">
            <CardHeader><CardTitle className="text-xl">Produtos</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <Input placeholder="Filtrar produtos..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
              <div className="grid grid-cols-1 gap-4">
                {((productsQ.data as any)?.data?.products || []).filter((p: any) => 
                  !productSearch || p.description?.toLowerCase().includes(productSearch.toLowerCase())
                ).map((p: any) => {
                  const punit = p.unit?.code || "UN";
                  const pstep = Number(p.quantity_step || 1);
                  const pinitial = Number(p.default_quantity || 1);
                  
                  return (
                    <div key={p.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
                      <h4 className="font-semibold">{p.description}</h4>
                      <ProductPriceDisplay productId={p.id} clientId={clientId} unit={punit} />
                      <div className="flex items-center justify-between pt-2">
                         <div className="flex bg-muted/30 rounded-lg p-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {}}>-</Button>
                            <Input className="h-8 w-14 text-center font-bold" defaultValue={pinitial} />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {}}>+</Button>
                         </div>
                         <Button onClick={() => addItem({ productId: p.id, description: p.description, quantity: pinitial, unitPrice: 0, total: 0 })}>Adicionar</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Carrinho</CardTitle></CardHeader>
            <CardContent>
              {items.map(it => (
                <div key={it.productId} className="flex justify-between py-2 border-b">
                   <span>{it.quantity}x {it.description}</span>
                   <Button variant="ghost" size="icon" onClick={() => removeItem(it.productId)}><Trash2 className="h-4 w-4"/></Button>
                </div>
              ))}
              <Button className="w-full mt-4" onClick={() => setStep("delivery")}>Continuar</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}