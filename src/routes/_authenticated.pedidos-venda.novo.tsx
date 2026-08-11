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
      if (isEditing && erpOrderNumber === editOrderNumber) return;

      setIsHydrating(true);
      setHydrationError(null);
      console.log(`[WIZARD] SPRINT 8.9.36 - Iniciando hidratação ERP ${editOrderNumber}`);

      try {
        const result = await fetchErpOrderDetail({ data: editOrderNumber });
        
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
                      isEditing ? "Salvar Alterações — disponível na próxima etapa" : "Finalizar Pedido"
                    )}
                  </Button>
                )}
