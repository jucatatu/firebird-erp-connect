import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useMyRoles, useMyProfile } from "@/hooks/use-auth";
import { useCreateDraft } from "@/hooks/use-drafts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Plus, ShoppingCart, Truck, CreditCard, ChevronRight, ChevronLeft, Trash2, CheckCircle2, Send } from "lucide-react";
import { useErpClients, useErpProducts, useErpEquipmentTypes, useErpPrice, useCreateErpOrder } from "@/hooks/use-erp";
import { useOrderFormStore } from "@/hooks/use-order-form";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

function NewOrderPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<"client" | "items" | "delivery" | "payment" | "review">("client");

  const {
    clientId, clientName, items, equipments, deliver, deliveryAt,
    returnEquipment, returnAt, notes, paymentTermId, paymentMethodId, saleTypeId,
    idempotencyKey, submissionStatus,
    setClient, addItem, removeItem, updateItemQuantity, addEquipment, removeEquipment,
    setDelivery, setReturn, setNotes, setPayment, setSaleType, reset,
    setIdempotencyKey, setSubmissionStatus
  } = useOrderFormStore();

  const myRoles = useMyRoles(user);
  const myProfile = useMyProfile(user);

  useEffect(() => {
    if (!idempotencyKey && step === "client") {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [idempotencyKey, step, setIdempotencyKey]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const [clientSearch, setClientSearch] = useState("");
  const clientsQ = useErpClients(clientSearch.length >= 3 ? { q: clientSearch } : null);

  const [productSearch, setProductSearch] = useState("");
  const productsQ = useErpProducts(productSearch.length >= 3 ? { q: productSearch } : null);
  
  const equipmentTypesQ = useErpEquipmentTypes();

  const createOrderM = useCreateErpOrder();

  const handleCreateOrder = async () => {
    if (!clientId || items.length === 0 || submissionStatus === "submitting" || submissionStatus === "created") return;

    if (!myProfile.data?.erp_seller_id) {
      toast.error("Vendedor não mapeado", {
        description: "Seu usuário não possui um ID de vendedor vinculado no ERP."
      });
      return;
    }

    if (!paymentTermId || !paymentMethodId || !saleTypeId) {
      toast.error("Dados incompletos", {
        description: "Por favor, selecione o tipo de venda, prazo e forma de pagamento."
      });
      setStep("payment");
      return;
    }

    setSubmissionStatus("submitting");
    const currentKey = idempotencyKey || crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(currentKey);

    try {
      const payload = {
        companyId: 1 as 1 | 3, // Simplificado: Vendedor no ERP já tem empresa vinculada via procedure.
        clientId: clientId,
        sellerId: myProfile.data.erp_seller_id,
        saleTypeId,
        paymentTermId,
        paymentMethodId,
        deliver,
        deliveryAt: deliveryAt || new Date().toISOString(),
        returnEquipment,
        returnAt: returnEquipment ? returnAt : null,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        equipments: equipments.map(e => ({ equipmentTypeId: e.equipmentTypeId, quantity: e.quantity })),
        notes: notes || null
      };

      const result = await createOrderM.mutateAsync({ 
        data: payload, 
        idempotencyKey: currentKey 
      });
      
      if (result.ok && result.data) {
        setSubmissionStatus("created", { 
          orderId: result.data.orderId, 
          orderNumber: result.data.orderNumber 
        });
        toast.success(`Pedido criado com sucesso! Nº ERP: ${result.data.orderNumber}`);
        
        // Persistência no rascunho Supabase (opcional, mas recomendado)
        // Se houver um draftId na URL, poderíamos atualizar seu status aqui.
        
        reset();
        navigate({ to: "/pedidos-venda" });
      } else {
        const isConflict = result.status === 409;
        const status = isConflict ? "created" : "failed";
        setSubmissionStatus(status);
        
        toast.error(isConflict ? "Pedido já existe" : "Erro ao criar pedido", {
          description: result.error?.message || "Ocorreu um erro inesperado no ERP."
        });
      }
    } catch (err) {
      setSubmissionStatus("unknown");
      toast.error("Falha na comunicação", {
        description: "O status do envio é desconhecido. Não tente novamente sem verificar a lista de pedidos."
      });
    }
  };

  // const totalItems = items.reduce((acc, i) => acc + i.total, 0);

  return (
    <div className="container max-w-5xl py-6">
      <PageHeader 
        title="Novo Pedido" 
        description="Siga os passos para cadastrar um novo pedido no ERP."
        crumbs={[{ label: "Pedidos", to: "/pedidos-venda" }, { label: "Novo" }]}
      />

      <div className="mb-8 flex items-center justify-between">
        <div className="flex gap-2">
          <Badge variant={step === "client" ? "default" : "outline"} className="px-3 py-1">1. Cliente</Badge>
          <Badge variant={step === "items" ? "default" : "outline"} className="px-3 py-1">2. Itens</Badge>
          <Badge variant={step === "delivery" ? "default" : "outline"} className="px-3 py-1">3. Entrega</Badge>
          <Badge variant={step === "payment" ? "default" : "outline"} className="px-3 py-1">4. Pagamento</Badge>
          <Badge variant={step === "review" ? "default" : "outline"} className="px-3 py-1">5. Revisão</Badge>
        </div>
        {clientId && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Cliente selecionado</p>
            <p className="text-sm font-medium">{clientName}</p>
          </div>
        )}
      </div>

      {step === "client" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seleção de Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome, documento ou código (min. 3 letras)..." 
                className="pl-9"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              {clientsQ.isLoading && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
              
              {clientsQ.data?.data?.clients?.map((c) => (
                <div 
                  key={c.id} 
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 ${clientId === c.id ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => setClient(c.id, c.name)}
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.document || 'Sem documento'} · ID: {c.id}</p>
                  </div>
                  {clientId === c.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </div>
              ))}

              {clientSearch.length >= 3 && clientsQ.data?.data?.clients?.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button disabled={!clientId} onClick={() => setStep("items")}>
                Próximo: Itens <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "items" && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Adicionar Itens e Equipamentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Produtos</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar produtos (min. 3 letras)..." 
                    className="pl-9"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                
                <div className="max-h-60 space-y-2 overflow-y-auto">
              {productsQ.data?.data?.products?.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{p.description}</p>
                    <p className="text-xs text-muted-foreground">ID: {p.id}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => addItem({
                    productId: p.id,
                    description: p.description,
                    quantity: 1,
                    unitPrice: 0, // Será resolvido no backend
                    total: 0
                  })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Equipamentos</Label>
            <div className="grid grid-cols-2 gap-2">
              {equipmentTypesQ.data?.data?.map((et) => (
                <Button 
                  key={et.id} 
                  variant="outline" 
                  size="sm" 
                  className="justify-start"
                  onClick={() => addEquipment({
                    equipmentTypeId: et.id,
                    description: et.description,
                    quantity: 1
                  })}
                >
                  <Plus className="mr-2 h-3 w-3" /> {et.description}
                </Button>
              ))}
            </div>
          </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" /> Carrinho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.length === 0 && equipments.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Carrinho vazio.</p>
              )}

              {items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Produtos</p>
                  {items.map((it) => (
                    <div key={it.productId} className="flex flex-col gap-1 rounded-md bg-muted/30 p-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium line-clamp-1">{it.description}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeItem(it.productId)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            value={it.quantity} 
                            onChange={(e) => updateItemQuantity(it.productId, Number(e.target.value))}
                            className="h-7 w-16 px-2 py-0"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {equipments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Equipamentos</p>
                  {equipments.map((eq) => (
                    <div key={eq.equipmentTypeId} className="flex items-center justify-between rounded-md bg-muted/30 p-2 text-sm">
                      <span>{eq.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{eq.quantity} un</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeEquipment(eq.equipmentTypeId)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator />
              
              <div className="flex justify-between font-bold">
                <span>Itens Selecionados</span>
                <span>{items.length} produto(s)</span>
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <Button 
                  className="w-full" 
                  disabled={items.length === 0 || submissionStatus === "submitting"} 
                  onClick={() => setStep("delivery")}
                >
                  {submissionStatus === "submitting" ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                  ) : (
                    <>Continuar <ChevronRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setStep("client")} disabled={submissionStatus === "submitting"}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "delivery" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5" /> Entrega e Observações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label>Tipo de Logística</Label>
                <div className="flex gap-4">
                  <div 
                    className={`flex-1 cursor-pointer rounded-lg border p-4 text-center transition-all ${deliver ? 'border-primary bg-primary/5' : 'bg-muted/20'}`}
                    onClick={() => setDelivery(true, deliveryAt)}
                  >
                    <Truck className={`mx-auto mb-2 h-6 w-6 ${deliver ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="text-sm font-medium">Entregar</p>
                  </div>
                  <div 
                    className={`flex-1 cursor-pointer rounded-lg border p-4 text-center transition-all ${!deliver ? 'border-primary bg-primary/5' : 'bg-muted/20'}`}
                    onClick={() => setDelivery(false, deliveryAt)}
                  >
                    <Plus className={`mx-auto mb-2 h-6 w-6 ${!deliver ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="text-sm font-medium">Retirada</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Data Prevista de Entrega</Label>
                <Input 
                  type="date" 
                  value={deliveryAt ? deliveryAt.split('T')[0] : ''} 
                  onChange={(e) => setDelivery(deliver, new Date(e.target.value).toISOString())}
                />
              </div>

              <div className="space-y-3">
                <Label>Recolher Equipamento?</Label>
                <div className="flex gap-4">
                   <Button 
                    variant={returnEquipment ? "default" : "outline"} 
                    className="flex-1"
                    onClick={() => setReturn(true, returnAt)}
                   >Sim</Button>
                   <Button 
                    variant={!returnEquipment ? "default" : "outline"} 
                    className="flex-1"
                    onClick={() => setReturn(false, null)}
                   >Não</Button>
                </div>
              </div>

              {returnEquipment && (
                <div className="space-y-3">
                  <Label>Data Prevista de Retorno</Label>
                  <Input 
                    type="date" 
                    value={returnAt ? returnAt.split('T')[0] : ''} 
                    onChange={(e) => setReturn(true, new Date(e.target.value).toISOString())}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Observações do Pedido</Label>
              <Textarea 
                placeholder="Ex: Entregar após as 14h, campainha estragada..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep("items")}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep("payment")}>
                Pagamento <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "payment" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5" /> Pagamento e Venda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-3">
                <Label>Tipo de Venda</Label>
                <Select value={String(saleTypeId || "1")} onValueChange={(v) => setSaleType(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Venda Normal</SelectItem>
                    <SelectItem value="2">Bonificação</SelectItem>
                    <SelectItem value="3">Consumo Próprio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Prazo de Pagamento</Label>
                <Select value={String(paymentTermId || "1")} onValueChange={(v) => setPayment(Number(v), paymentMethodId)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">A Vista</SelectItem>
                    <SelectItem value="2">7 Dias</SelectItem>
                    <SelectItem value="3">14 Dias</SelectItem>
                    <SelectItem value="4">21 Dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Forma de Pagamento</Label>
                <Select value={String(paymentMethodId || "1")} onValueChange={(v) => setPayment(paymentTermId, Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Dinheiro</SelectItem>
                    <SelectItem value="2">Boleto Bancário</SelectItem>
                    <SelectItem value="3">Cartão de Crédito</SelectItem>
                    <SelectItem value="4">PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep("delivery")}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button onClick={() => setStep("review")}>
                Revisar Pedido <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5" /> Revisão Final
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Resumo do Cliente</h3>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-lg font-bold">{clientName}</p>
                  <p className="text-sm text-muted-foreground">Código ERP: {clientId}</p>
                </div>

                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Logística</h3>
                <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-1">
                  <p><strong>Operação:</strong> {deliver ? 'Entrega pela Grott' : 'Retirada no Local'}</p>
                  <p><strong>Data Prevista:</strong> {deliveryAt ? new Date(deliveryAt).toLocaleDateString() : 'Não informada'}</p>
                  {returnEquipment && (
                    <p><strong>Retorno Equipamento:</strong> Sim ({returnAt ? new Date(returnAt).toLocaleDateString() : 'Data não informada'})</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Pagamento</h3>
                <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-1">
                  <p><strong>Tipo de Venda:</strong> {saleTypeId === 2 ? 'Bonificação' : saleTypeId === 3 ? 'Consumo' : 'Normal'}</p>
                  <p><strong>Prazo:</strong> {paymentTermId === 1 ? 'A Vista' : paymentTermId === 2 ? '7 Dias' : 'Outros'}</p>
                  <p><strong>Forma:</strong> {paymentMethodId === 2 ? 'Boleto' : paymentMethodId === 4 ? 'PIX' : 'Dinheiro'}</p>
                </div>

                <h3 className="text-sm font-semibold uppercase text-muted-foreground">Itens ({items.length})</h3>
                <div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/20 p-2 text-sm space-y-1">
                  {items.map(i => (
                    <div key={i.productId} className="flex justify-between border-b border-muted py-1 last:border-0">
                      <span>{i.quantity}x {i.description}</span>
                    </div>
                  ))}
                  {equipments.map(e => (
                    <div key={e.equipmentTypeId} className="flex justify-between border-b border-muted py-1 last:border-0 italic text-muted-foreground">
                      <span>Equip: {e.quantity}x {e.description}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Preços</span>
                  <span className="text-primary text-sm font-normal">Calculados no ERP</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-4">
               <div className="rounded-md bg-yellow-500/10 p-3 text-xs text-yellow-600 dark:text-yellow-500">
                Atenção: Ao clicar em "Confirmar e Enviar", o pedido será enviado diretamente ao Firebird e uma cobrança poderá ser gerada. Esta operação não pode ser desfeita pelo aplicativo.
              </div>
              
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep("payment")}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button 
                  size="lg" 
                  className="px-8" 
                  onClick={handleCreateOrder} 
                  disabled={createOrderM.isPending}
                >
                  {createOrderM.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Confirmar e Enviar ao ERP
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
