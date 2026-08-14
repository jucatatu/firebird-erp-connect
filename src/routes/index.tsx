import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: () => {
    throw redirect({ to: "/pedidos-venda" });
  },
  component: () => (
    <div style={{ padding: '20px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
      {`Execute esta instrucao no projeto: # SPRINT 8.9.39.3 — CORRIGIR TELA VAZIA DO EDIT SEM REINTRODUZIR O LOOP DE NAVEGAÇÃO

O source atual foi auditado após a Sprint 8.9.39.2.

A Sprint 8.9.39.1 de equipamentos/cobertura está FUNCIONANDO e deve permanecer
100% intacta.

O novo problema ocorre ao abrir novamente:

/pedidos-venda/novo?edit=8656

A tela mostra:

- Editando Pedido 8656
- cliente ROMEU 2
- Empresa GRAAL
- Stepper

porém nenhum conteúdo de Itens + Equipamentos é renderizado.

A causa exata foi localizada no source atual.

NÃO alterar:

- normalização dos equipamentos;
- cobertura;
- assignedProductId;
- suggestEquipments;
- guards de cobertura;
- CREATE;
- logística;
- Google Maps;
- pagamento;
- Node ERP.

==================================================
1. CAUSA EXATA
==================================================

O Wizard possui:

const [step, setStepState] = useState("client");

Portanto step é estado LOCAL e volta para:

"client"

sempre que a página monta.

Por outro lado, Zustand usa persistência e mantém:

isEditing
erpOrderNumber
identityLocked
clientId
companyId
items
equipments
etc.

No hydration effect existe atualmente:

if (isEditing && erpOrderNumber === orderNumFromUrl) {
  return;
}

Isso está errado como critério de hidratação.

Cenário real:

página monta
↓
step = "client"
↓
Zustand restaura:
isEditing = true
erpOrderNumber = 8656
identityLocked = true
↓
effect encontra o mesmo orderNumber
↓
return
↓
setStepState("items") nunca ocorre
↓
Cliente está escondido porque identityLocked = true
↓
Itens não aparecem porque step continua "client"
↓
tela vazia

Essa é a regressão atual.

==================================================
2. NÃO RECOLOCAR O BUG ANTERIOR
==================================================

NÃO resolver voltando a fazer:

if (step !== "items") {
  setStepState("items");
}

dentro de um effect que acompanha a navegação.

Isso recriaria exatamente o bug da Sprint 8.9.39.2:

Items
→ Delivery
→ effect
→ Items

Precisamos separar:

HIDRATAÇÃO INICIAL
de:
NAVEGAÇÃO DO WIZARD.

==================================================
3. REGRA CORRETA
==================================================

Ao abrir uma URL:

?edit=8656

o pedido deve ser hidratado UMA VEZ PARA AQUELA ABERTURA DA PÁGINA.

Mesmo que Zustand possua:

isEditing = true
erpOrderNumber = 8656

não considerar isso sozinho suficiente para pular a hidratação.

O Zustand persistido é cache de sessão.

O GET ERP é a fonte autoritativa para abrir uma edição.

==================================================
4. CRIAR CONTROLE LOCAL DE HIDRATAÇÃO DA ROTA
==================================================

Criar um controle LOCAL, não persistido, para saber qual editParam
foi hidratado nesta montagem do componente.

Exemplo conceitual:

const [hydratedEditOrderNumber, setHydratedEditOrderNumber] =
  useState<number | null>(null);

ou:

const hydratedEditRef = useRef<number | null>(null);

Também usar proteção contra request concorrente se necessário.

A regra NÃO deve depender apenas de:

isEditing
erpOrderNumber

para decidir que não precisa carregar.

==================================================
5. FLUXO OBRIGATÓRIO AO ABRIR EDIT
==================================================

Para:

?edit=8656

executar:

editParam detectado
↓
verificar se 8656 já foi hidratado NESTA montagem
↓
se NÃO:
   hydrationLoading = true
   GET ERP 8656
   resolver cliente
   editErpOrder(...)
   normalização equipamentos
   setStepState("items")
   marcar 8656 como hidratado localmente
↓
hydrationLoading = false
↓
Wizard liberado

Resultado:

primeira etapa útil:

Itens + Equipamentos

com os dados reais do ERP.

==================================================
6. DEPOIS DA HIDRATAÇÃO, NÃO INTERFERIR MAIS NO STEP
==================================================

Depois que:

hydratedEditOrderNumber === 8656

mudanças:

items
→ delivery
→ payment
→ review

NÃO devem:

- executar novo GET ERP;
- chamar editErpOrder novamente;
- alterar step;
- resetar equipamentos;
- resetar formulário.

O Wizard passa a ser dono da navegação.

==================================================
7. NÃO USAR step COMO DEPENDÊNCIA DA HIDRATAÇÃO
==================================================

Preservar a correção da Sprint 8.9.39.2:

step NÃO deve voltar para as dependências do hydration effect.

Mudança de etapa não é motivo para buscar novamente o pedido.

==================================================
8. NÃO CONFIAR EM STORE PERSISTIDA PARCIAL
==================================================

Este requisito é obrigatório.

Não utilizar:

isEditing && erpOrderNumber === orderNumFromUrl

como equivalente a:

"pedido completamente hidratado".

Exemplo possível de estado persistido:

isEditing = true
erpOrderNumber = 8656
clientId = 123
identityLocked = true

mas:

companyId = null
items = []
equipments = []

O código atual consideraria isso "pedido carregado".

Não pode.

Ao abrir a rota de edição em uma nova montagem:

reler ERP uma vez.

==================================================
9. GATE DE RENDERIZAÇÃO
==================================================

Durante a hidratação inicial do edit:

não renderizar estado persistido parcial.

Mostrar:

"Carregando pedido ERP 8656..."

Depois:

normalização equipamentos

Depois liberar a UI.

Não mostrar:

header + stepper + área vazia

durante estado inconsistente.

==================================================
10. NORMALIZAÇÃO 8.9.39.1 DEVE CONTINUAR INTACTA
==================================================

Depois do GET:

ERP equipments
↓
pipeline único de normalização
↓
role KEG/TAP
↓
capacityLiters
↓
assignedProductId
↓
coverage

Pedido 8656 deve continuar abrindo com:

CHOPP PILSEN
10 / 10 L
Coberto

ou com os dados atualmente salvos naquele pedido.

NÃO mexer nessa implementação.

==================================================
11. CORRIGIR INDICADOR DE EMPRESA ENGANOSO
==================================================

No header atual existe lógica equivalente a:

Empresa: {companyId === 3 ? "GROTT" : "GRAAL"}

Isso mostra:

GRAAL

até quando companyId é:

null
undefined
NaN

Isso mascara estados incompletos.

Alterar para tratamento explícito:

companyId === 1
→ GRAAL

companyId === 3
→ GROTT

caso contrário
→ "Carregando..." ou "Empresa não identificada"

Não usar GRAAL como fallback universal.

==================================================
12. CONDIÇÃO DE RENDER DE ITEMS
==================================================

Atualmente a seção depende de:

step === "items" && clientId && companyId

Manter essa proteção.

NÃO remover companyId apenas para fazer conteúdo aparecer.

A correção correta é garantir que a hidratação traga:

clientId
companyId
items
equipments

antes de liberar a UI.

==================================================
13. EDITPARAM DIFERENTE
==================================================

Se a mesma instância do componente passar de:

?edit=8656

para:

?edit=8657

o controle local deve perceber:

8657 !== hydratedEditOrderNumber

e executar nova hidratação.

Depois:

setStepState("items")

uma única vez para 8657.

==================================================
14. ERRO DE GET
==================================================

Se GET ERP falhar:

não marcar o pedido como hidratado.

Mostrar o erro existente.

Permitir retry/reentrada conforme arquitetura atual.

Não deixar estado persistido antigo aparecer como se fosse o pedido solicitado.

==================================================
15. TESTE REAL — ABERTURA
==================================================

Abrir diretamente:

/pedidos-venda/novo?edit=8656

Esperado:

Carregando ERP 8656
↓
normalizando equipamentos
↓
Itens + Equipamentos

Deve mostrar:

Produtos
Equipamentos
Cobertura
Resumo

Não pode aparecer área vazia.

==================================================
16. TESTE DE REFRESH
==================================================

Com:

/pedidos-venda/novo?edit=8656

pressionar refresh do navegador.

Esse teste é obrigatório porque Zustand é persistido.

Esperado:

GET ERP 8656 executado UMA vez nessa nova montagem
↓
hidratação
↓
step items
↓
conteúdo aparece

Não pode confiar cegamente no Zustand persistido.

==================================================
17. TESTE DA NAVEGAÇÃO APÓS HIDRATAR
==================================================

Depois que abrir corretamente:

Items
→ Delivery

Esperado:

permanece Delivery.

Delivery
→ Payment

Esperado:

permanece Payment.

Payment
→ Review

Esperado:

permanece Review.

Nenhum GET ERP adicional apenas por mudar de etapa.

==================================================
18. TESTE DE VOLTA
==================================================

Review
→ Payment
→ Delivery
→ Items

Depois:

Items
→ Delivery

Tudo deve permanecer estável.

Nenhum hydration effect pode alterar step durante essas transições.

==================================================
19. TESTE DE COBERTURA
==================================================

No ERP 8656:

confirmar que a Sprint 8.9.39.1 continua funcionando.

BARRIL associado:
PASS
Cobertura:
PASS
Alterar quantidade:
PASS

Nenhuma regressão.

==================================================
20. CREATE
==================================================

Novo Pedido não deve ser alterado.

CREATE permanece funcionalmente congelado.

==================================================
21. NODE
==================================================

NODE ERP ALTERADO: NÃO

Nenhuma alteração backend é necessária.

==================================================
RELATÓRIO FINAL OBRIGATÓRIO
==================================================

SPRINT 8.9.39.3

CAUSA

step local iniciava como client:
SIM

Zustand persistia estado de edição:
SIM

early return ocorria antes de setStepState("items"):
SIM

Esse era o motivo da tela vazia:
SIM


CORREÇÃO

Controle local de hidratação implementado:
PASS

Store persistida deixou de ser usada como única prova de hidratação:
PASS

GET ERP executa uma vez por abertura da rota:
PASS

setStepState("items") executa após hidratação inicial:
PASS

step não é dependência da hidratação:
PASS


TESTE ERP 8656

Abrir edição:
PASS

Refresh na edição:
PASS

Produtos aparecem:
PASS

Equipamentos aparecem:
PASS

Cobertura aparece:
PASS

Resumo aparece:
PASS

Tela vazia eliminada:
PASS


NAVEGAÇÃO

Items → Delivery:
PASS

Permanece Delivery:
PASS

Delivery → Payment:
PASS

Payment → Review:
PASS

Voltar entre etapas:
PASS

Nenhum GET ERP extra por mudar de step:
PASS


REGRESSÃO

Normalização 8.9.39.1:
PASS

Cobertura EDIT:
PASS

CREATE:
PASS


HEADER

companyId 1 mostra GRAAL:
PASS

companyId 3 mostra GROTT:
PASS

companyId ausente NÃO mostra GRAAL falsamente:
PASS


NODE ALTERADO:
NÃO`}
    </div>
  ),
});
