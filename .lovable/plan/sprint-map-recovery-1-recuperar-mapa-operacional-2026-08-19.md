# SPRINT MAP RECOVERY.1 — RECUPERAR MAPA OPERACIONAL

&nbsp;

## OBJETIVO

&nbsp;

Restaurar o Mapa Operacional como home do ERP.

&nbsp;

Contrato:

&nbsp;

/                  → Mapa Operacional

/pedidos-venda     → Pedidos / Comercial

/operations        → redireciona para /

&nbsp;

Referência histórica:

commit 5740ecf4

src/routes/_authenticated.index.tsx

&nbsp;

NÃO fazer revert geral.

Adaptar a home histórica aos hooks/componentes atuais.

&nbsp;

NÃO usar Fast Visual Edit.

&nbsp;

==================================================

1. HOME

==================================================

&nbsp;

Em:

&nbsp;

src/routes/_authenticated.index.tsx

&nbsp;

remover o redirect para /pedidos-venda.

&nbsp;

Restaurar MapHome real em:

&nbsp;

createFileRoute("/_authenticated/")

&nbsp;

A home NÃO pode virar dashboard novamente.

&nbsp;

==================================================

2. FULL BLEED

==================================================

&nbsp;

Em:

&nbsp;

src/routes/_authenticated.tsx

&nbsp;

aplicar:

&nbsp;

variant="fullBleed"

&nbsp;

somente quando pathname === "/".

&nbsp;

Preservar integralmente:

&nbsp;

- autenticação;

- ForcePasswordChange;

- usuário desativado;

- logout;

- roles;

- profile.

&nbsp;

Demais páginas continuam com AppShell normal.

&nbsp;

==================================================

3. COMPONENTES ATUAIS

==================================================

&nbsp;

Usar os componentes/hooks atuais.

&nbsp;

Preservar:

&nbsp;

MapView

useMapOrders

useGeocodeOrders

useOperationStates

OperationalFilters

OperationalCounters

OrderDetailSheet

&nbsp;

NÃO substituir esses arquivos por versões antigas.

&nbsp;

A referência 5740ecf4 serve para recuperar a composição

da home, não para regredir código atual.

&nbsp;

==================================================

4. DADOS

==================================================

&nbsp;

Mapa usa:

&nbsp;

useMapOrders({ date, companyId })

&nbsp;

Data inicial:

hoje.

&nbsp;

Empresas:

&nbsp;

Todas

Graal = 1

Grott = 3

&nbsp;

Não criar API nova.

&nbsp;

==================================================

5. ESTADO OPERACIONAL

==================================================

&nbsp;

Vincular pedidos ERP aos estados operacionais por:

&nbsp;

erp_order_id

&nbsp;

Preservar state machine atual.

&nbsp;

Filtros:

&nbsp;

Todos

Entregas

Recolhas

Cliente irá avisar

Concluídos

&nbsp;

Filtros devem afetar:

&nbsp;

- marcadores;

- lista;

- contadores.

&nbsp;

==================================================

6. MAPA

==================================================

&nbsp;

Usar MapView atual.

&nbsp;

Preservar:

&nbsp;

- número comercial do pedido no marcador;

- horário quando disponível;

- cor por status;

- fitBounds;

- seleção;

- botão centralizar.

&nbsp;

NÃO alterar DATA_PREV_ENTREGA nesta sprint.

&nbsp;

Se horário não existir:

não exibir.

&nbsp;

==================================================

7. PEDIDOS SEM COORDENADAS

==================================================

&nbsp;

Pedido sem latitude/longitude:

&nbsp;

- aparece normalmente na lista;

- não cria marcador;

- não quebra a tela;

- indica localização pendente/não localizada quando aplicável.

&nbsp;

Nunca remover o pedido da operação apenas por não estar geocodificado.

&nbsp;

==================================================

8. GEOCODING

==================================================

&nbsp;

Preservar useGeocodeOrders.

&nbsp;

Manter proteção contra loop automático usando Set/ref

ou mecanismo já existente.

&nbsp;

Falha de geocoding não pode travar o mapa.

&nbsp;

Não alterar Node sem erro concreto comprovado.

&nbsp;

==================================================

9. BUSCA

==================================================

&nbsp;

Busca local por:

&nbsp;

- cliente;

- endereço;

- número do pedido.

&nbsp;

Não consultar ERP a cada caractere.

&nbsp;

==================================================

10. DESKTOP

==================================================

&nbsp;

Layout:

&nbsp;

ESQUERDA ~384px:

- data;

- empresa;

- filtros;

- busca;

- contadores;

- ordenação;

- lista.

&nbsp;

DIREITA:

- mapa ocupando restante da tela.

&nbsp;

Clique na lista ou marcador:

abre OrderDetailSheet.

&nbsp;

==================================================

11. MOBILE

==================================================

&nbsp;

Priorizar mapa.

&nbsp;

Preservar experiência operacional:

&nbsp;

- mapa ocupando praticamente toda área útil;

- controles compactos/flutuantes;

- alternância Mapa / Lista;

- filtros acessíveis;

- detalhe em Sheet inferior.

&nbsp;

Não criar cards grandes acima do mapa.

&nbsp;

==================================================

12. DETALHE

==================================================

&nbsp;

Usar OrderDetailSheet atual.

&nbsp;

Preservar ações existentes:

&nbsp;

- entrega;

- recolha;

- reagendamento;

- cliente irá avisar;

- atribuição;

- equipamentos;

- notas;

- histórico.

&nbsp;

Não recriar state machine.

&nbsp;

==================================================

13. REABRIR MESMO PEDIDO

==================================================

&nbsp;

Preservar a correção histórica:

&nbsp;

clicar pedido → abrir detalhe

fechar detalhe

clicar no MESMO pedido novamente

→ detalhe deve abrir novamente.

&nbsp;

Não deixar selectedId/selectedKey impedir reabertura.

&nbsp;

==================================================

14. ORDENAÇÃO

==================================================

&nbsp;

Preservar quando compatível:

&nbsp;

- ordem manual;

- cliente;

- endereço;

- status;

- nº pedido.

&nbsp;

Não criar nova persistência nesta sprint.

&nbsp;

==================================================

15. OFFLINE

==================================================

&nbsp;

Preservar indicador atual de falta de conexão.

&nbsp;

Não reconstruir toda sincronização offline agora.

&nbsp;

Não remover comportamento offline existente.

&nbsp;

==================================================

16. ROTAS

==================================================

&nbsp;

/operations continua sendo alias:

&nbsp;

/operations → /

&nbsp;

Mapa possui uma única fonte de tela:

&nbsp;

/

&nbsp;

Não criar outra MapHome em /operations.

&nbsp;

==================================================

17. MENU

==================================================

&nbsp;

Preservar:

&nbsp;

Operação:

Mapa → /

Entregas → /entregas

Recolhas → /recolhas

&nbsp;

Comercial:

Pedidos → /pedidos-venda

&nbsp;

Pedidos NÃO voltam para a home.

&nbsp;

==================================================

18. NÃO ALTERAR

==================================================

&nbsp;

ZERO regressão funcional em:

&nbsp;

/pedidos-venda

Novo Pedido

Novo Cliente

Sellers

Catálogo

Aprovações

Admin Users

Permission Profiles

&nbsp;

NÃO alterar:

&nbsp;

DATA_PREV_ENTREGA

Catalog RPCs

Catalog migrations

Firebird SQL

&nbsp;

Preferência:

ZERO migration.

&nbsp;

==================================================

19. ALTURA / VIEWPORT

==================================================

&nbsp;

Topbar atual possui h-14.

&nbsp;

Mapa deve ocupar corretamente o restante do viewport.

&nbsp;

Evitar:

&nbsp;

- scroll vazio;

- mapa cortado;

- altura maior que a tela;

- conflito com BottomNav mobile.

&nbsp;

==================================================

20. TESTES

==================================================

&nbsp;

Validar:

&nbsp;

[ ] / abre mapa

[ ] / não redireciona para pedidos

[ ] /pedidos-venda permanece normal

[ ] /operations → /

[ ] fullBleed somente em /

[ ] ForcePasswordChange preservado

[ ] usuário desativado preservado

&nbsp;

[ ] Todas/Graal/Grott funcionam

[ ] filtros operacionais funcionam

[ ] contadores acompanham filtros

[ ] busca funciona

[ ] pedido sem coordenada aparece na lista

[ ] mapa não quebra sem coordenadas

&nbsp;

[ ] marcador abre detalhe

[ ] item da lista abre detalhe

[ ] mesmo pedido reabre após fechar

[ ] mobile Mapa/Lista funciona

[ ] desktop lista+mapa funciona

&nbsp;

[ ] geocoding não entra em loop

[ ] DATA_PREV_ENTREGA não mudou

[ ] Catálogo não mudou

[ ] nenhuma migration desnecessária

[ ] Node/Firebird sem alteração funcional

[ ] tsgo passa

[ ] build passa

&nbsp;

==================================================

21. ARQUIVOS ESPERADOS

==================================================

&nbsp;

Principal:

&nbsp;

src/routes/_authenticated.index.tsx

&nbsp;

Possível:

&nbsp;

src/routes/_authenticated.tsx

&nbsp;

Somente pequenos ajustes adicionais se estritamente necessários.

&nbsp;

Não substituir componentes atuais por versões históricas inteiras.

&nbsp;

==================================================

22. FINAL

==================================================

&nbsp;

Após implementar:

&nbsp;

PARAR.

&nbsp;

NÃO declarar Map Recovery concluído.

&nbsp;

Aguardar revisão Git.

&nbsp;

Relatório:

&nbsp;

1. arquivos alterados;

2. referência histórica usada;

3. comportamento de /;

4. comportamento de /pedidos-venda;

5. comportamento de /operations;

6. fullBleed;

7. mobile;

8. desktop;

9. filtros;

10. estados operacionais;

11. detalhe/reabertura;

12. geocoding;

13. testes;

14. tsgo/build;

15. migrations;

16. Node/Firebird diff.

&nbsp;

NÃO iniciar Sprint 8.9.43.2.

NÃO voltar para DATA_PREV_ENTREGA.

PARAR.