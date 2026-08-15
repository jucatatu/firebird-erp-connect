# SPRINT 8.9.42 — CADASTRO DE NOVO CLIENTE DIRETO NO ERP

&nbsp;

## OBJETIVO

&nbsp;

Implementar o cadastro de um cliente novo diretamente no ERP Firebird dentro do

fluxo "Novo Pedido".

&nbsp;

Fluxo final:

&nbsp;

Novo Pedido

→ selecionar empresa

→ pesquisar cliente

→ cliente não encontrado

→ "+ Cadastrar novo cliente"

→ formulário comercial enxuto

→ cadastro direto no ERP

→ retorno do ID_CLIENTE real

→ cliente selecionado

→ "Gerar novo pedido para este cliente"

→ continuar no wizard atual.

&nbsp;

NÃO criar cliente intermediário no Supabase.

NÃO criar pedido automaticamente após o cadastro.

NÃO criar um segundo fluxo de pedido.

&nbsp;

==================================================

1. NÃO ALTERAR O FLUXO DE PEDIDOS EXISTENTE

==================================================

&nbsp;

Preservar integralmente:

&nbsp;

- CREATE pedido;

- EDIT pedido;

- status ERP;

- batch-status;

- ERP EXCLUÍDO;

- ERP INDISPONÍVEL;

- APP-XXXX;

- paginação;

- cards;

- equipamentos;

- cobertura;

- entrega;

- recolha;

- pagamentos;

- Google Maps.

&nbsp;

Esta Sprint adiciona cadastro de cliente sem refatorar essas áreas.

&nbsp;

==================================================

2. PROCEDURES OFICIAIS DO ERP

==================================================

&nbsp;

É PROIBIDO fazer INSERT manual em:

&nbsp;

PESSOAS

CLIENTES

ENDERECO

CONTATO

FONTE_FINANCEIRA

ESTADO

CIDADE

BAIRRO

RUA

&nbsp;

Utilizar obrigatoriamente:

&nbsp;

SP_CAD_CLIENTE_COMPLETO

&nbsp;

e:

&nbsp;

SP_CAD_CONTATOS

&nbsp;

A SP_CAD_CLIENTE_COMPLETO já cria toda a estrutura oficial e retorna:

&nbsp;

ID

→ ID_CLIENTE

&nbsp;

ID_PES

→ ID_PESSOA

&nbsp;

Para criação:

&nbsp;

CHAVE = NULL.

&nbsp;

==================================================

3. IDS

==================================================

&nbsp;

Os IDs são gerados pelo próprio ERP pelas triggers/generators:

&nbsp;

CLIENTES_BI

→ GEN_CLIENTES_ID

&nbsp;

PESSOAS_BI

→ GEN_PESSOAS_ID

&nbsp;

Portanto:

&nbsp;

- não usar MAX(ID)+1;

- não gerar ID no Node;

- não gerar ID no frontend;

- não chamar generators manualmente.

&nbsp;

==================================================

4. TRANSAÇÃO FIREBIRD OBRIGATÓRIA

==================================================

&nbsp;

Utilizar o withTransaction() já existente.

&nbsp;

Dentro da MESMA transação:

&nbsp;

1. validar duplicidade;

2. chamar SP_CAD_CLIENTE_COMPLETO;

3. validar ID e ID_PES retornados;

4. chamar SP_CAD_CONTATOS;

5. COMMIT.

&nbsp;

Se qualquer etapa falhar:

&nbsp;

ROLLBACK integral.

&nbsp;

Nunca deixar cliente criado sem contato ou parcialmente cadastrado.

&nbsp;

==================================================

5. SP_CAD_CONTATOS

==================================================

&nbsp;

Parâmetros confirmados e posicionais:

&nbsp;

0 ID_PESSOA

1 FONE

2 CELULAR

3 EMAIL

4 OUTRO

&nbsp;

Mapear:

&nbsp;

ID_PESSOA = ID_PES retornado

FONE = telefone ou NULL

CELULAR = WhatsApp/celular

EMAIL = e-mail ou NULL

OUTRO = NULL

&nbsp;

==================================================

6. EMPRESA E VENDEDOR

==================================================

&nbsp;

Empresa:

&nbsp;

Graal = 1

Grott = 3

&nbsp;

A empresa já é selecionada na etapa inicial do Novo Pedido.

&nbsp;

A Server Function deve validar novamente no Supabase:

&nbsp;

user_company_access

&nbsp;

Não confiar apenas no frontend.

&nbsp;

Vendedor:

&nbsp;

profiles.erp_seller_id

→ SP_CAD_CLIENTE_COMPLETO.ID_VENDEDOR

&nbsp;

Se não houver erp_seller_id:

&nbsp;

422 SELLER_NOT_MAPPED

&nbsp;

IMPORTANTE:

&nbsp;

ID_USER da procedure NÃO é erp_seller_id.

&nbsp;

Nesta V1:

&nbsp;

ID_USER = NULL.

&nbsp;

==================================================

7. FORMULÁRIO V1

==================================================

&nbsp;

Criar formulário comercial enxuto.

&nbsp;

DADOS DO CLIENTE

&nbsp;

Tipo *

[ Pessoa Física ] [ Pessoa Jurídica ]

&nbsp;

Nome / Razão Social *

&nbsp;

Nome fantasia

opcional

&nbsp;

CPF / CNPJ *

&nbsp;

CONTATO

&nbsp;

WhatsApp / Celular *

&nbsp;

Telefone

opcional

&nbsp;

E-mail

opcional

&nbsp;

COMERCIAL

&nbsp;

Grupo do cliente *

&nbsp;

Empresa

read-only

&nbsp;

Vendedor

read-only

&nbsp;

FINANCEIRO

&nbsp;

Condição de pagamento padrão *

&nbsp;

Forma de pagamento padrão *

&nbsp;

ENDEREÇO

&nbsp;

UF *

Cidade *

Bairro *

Rua *

Número *

&nbsp;

CEP

opcional

&nbsp;

Complemento

opcional

&nbsp;

==================================================

8. NÃO INCLUIR

==================================================

&nbsp;

Não colocar:

&nbsp;

- nascimento;

- RG;

- IE;

- limite de crédito;

- periodicidade;

- transportadora;

- região;

- código integração;

- percentual desconto;

- operação;

- dia atendimento;

- extra;

- inativo;

- e-mail NF-e;

- observação de pagamento.

&nbsp;

Enviar NULL nos parâmetros correspondentes.

&nbsp;

==================================================

9. PF / PJ

==================================================

&nbsp;

Contrato do frontend:

&nbsp;

personType = "PF" | "PJ"

&nbsp;

Node converte:

&nbsp;

PF

→ JURIDICA = NULL

&nbsp;

PJ

→ JURIDICA = 1

&nbsp;

==================================================

10. CPF / CNPJ

==================================================

&nbsp;

Schema real confirmado:

&nbsp;

PESSOAS.CPF_CNPJ CHAR(14)

&nbsp;

Normalizar somente dígitos.

&nbsp;

PF:

11 dígitos.

&nbsp;

PJ:

14 dígitos.

&nbsp;

Não truncar silenciosamente.

&nbsp;

Documento inválido:

&nbsp;

400 VALIDATION_ERROR.

&nbsp;

Também corrigir o módulo modular de clientes para ler e pesquisar:

&nbsp;

PESSOAS.CPF_CNPJ

&nbsp;

Hoje o código possui lógica antiga baseada em CPF/CNPJ separados.

&nbsp;

Priorizar CPF_CNPJ e manter fallback legado somente se necessário.

&nbsp;

==================================================

11. DUPLICIDADE

==================================================

&nbsp;

Antes de criar:

&nbsp;

buscar documento normalizado já existente no ERP.

&nbsp;

Comparação exata.

&nbsp;

Ignorar registros DELETED.

&nbsp;

Se existir:

&nbsp;

HTTP 409

&nbsp;

CLIENT_ALREADY_EXISTS

&nbsp;

Retornar:

&nbsp;

clientId

name

tradeName

document

companyId

&nbsp;

Frontend mostra:

&nbsp;

"Este CPF/CNPJ já possui cadastro no ERP."

&nbsp;

[ Usar este cliente ]

&nbsp;

Ao tocar:

&nbsp;

selecionar o cliente existente.

&nbsp;

NÃO criar duplicata.

&nbsp;

==================================================

12. CUSTOMER GROUPS

==================================================

&nbsp;

Criar endpoint read-only:

&nbsp;

GET /api/v1/customer-groups

&nbsp;

Fonte:

&nbsp;

GRUPO_CLIENTE

&nbsp;

Retornar:

&nbsp;

{

  groups: [

    {

      id,

      description

    }

  ]

}

&nbsp;

Filtrar excluídos/inativos quando suportado.

&nbsp;

Não hardcodar IDs no frontend.

&nbsp;

Criar Server Function/hook seguindo o padrão ERP existente.

&nbsp;

==================================================

13. FINANCEIRO

==================================================

&nbsp;

Reutilizar:

&nbsp;

GET /api/v1/payment-options

&nbsp;

Campos:

&nbsp;

Condição de pagamento padrão

→ ID_PRAZO

&nbsp;

Forma de pagamento padrão

→ ID_FORMA_PAGAMENTO

&nbsp;

Antes da criação validar no backend que:

&nbsp;

groupId existe;

paymentTermId existe;

paymentMethodId existe.

&nbsp;

Erros:

&nbsp;

CUSTOMER_GROUP_INVALID

PAYMENT_TERM_INVALID

PAYMENT_METHOD_INVALID

&nbsp;

Não depender apenas de FK do Firebird.

&nbsp;

Não implementar Tipo de Venda no cadastro.

&nbsp;

Nesta V1:

&nbsp;

ID_TABELA_PRECO = NULL

ID_OPERACAO = NULL

&nbsp;

==================================================

14. ORDEM EXATA DA SP_CAD_CLIENTE_COMPLETO

==================================================

&nbsp;

A procedure é POSICIONAL.

&nbsp;

Respeitar exatamente:

&nbsp;

0  ID_EMPRESA

1  ID_GRUPO_CLIENTE

2  ID_TABELA_PRECO

3  ID_VENDEDOR

4  ID_PRAZO

5  ID_FORMA_PAGAMENTO

6  ID_TRANSPORTADOR

7  NOME

8  APELIDO

9  JURIDICA

10 CNPJ

11 RG

12 IE

13 DATA_NASC

14 UF

15 CIDADE

16 BAIRRO

17 RUA

18 NUMERO

19 CEP

20 COMP

21 LATLONG

22 DIA_ATENDIMENTO

23 PERIODICIDADE

24 CODIGO_INTEGRACAO

25 LIMITE_CREDITO

26 INATIVO

27 EXTRA

28 ID_USER

29 CHAVE

30 PERCENT_DESC_COMERCIAL

31 REGIAO

32 ID_OPERACAO

33 EMAIL_NA_NFE

&nbsp;

Criar uma função dedicada:

&nbsp;

buildCreateClientProcedureParams()

&nbsp;

Ela deve produzir exatamente 34 parâmetros.

&nbsp;

Criar teste:

&nbsp;

params.length === 34

&nbsp;

Não espalhar essa ordem em vários lugares do código.

&nbsp;

==================================================

15. MAPEAMENTO V1

==================================================

&nbsp;

companyId            → ID_EMPRESA

groupId              → ID_GRUPO_CLIENTE

NULL                 → ID_TABELA_PRECO

sellerId             → ID_VENDEDOR

paymentTermId        → ID_PRAZO

paymentMethodId      → ID_FORMA_PAGAMENTO

NULL                 → ID_TRANSPORTADOR

name                 → NOME

tradeName/null       → APELIDO

PF:null / PJ:1       → JURIDICA

document             → CNPJ

NULL                 → RG

NULL                 → IE

NULL                 → DATA_NASC

state                → UF

city                 → CIDADE

district             → BAIRRO

street               → RUA

number               → NUMERO

zip/null             → CEP

complement/null      → COMP

NULL                 → LATLONG

NULL                 → DIA_ATENDIMENTO

NULL                 → PERIODICIDADE

NULL                 → CODIGO_INTEGRACAO

NULL                 → LIMITE_CREDITO

NULL                 → INATIVO

NULL                 → EXTRA

NULL                 → ID_USER

NULL                 → CHAVE

NULL                 → PERCENT_DESC_COMERCIAL

NULL                 → REGIAO

NULL                 → ID_OPERACAO

NULL                 → EMAIL_NA_NFE

&nbsp;

==================================================

16. POST /api/v1/clients

==================================================

&nbsp;

Criar endpoint:

&nbsp;

POST /api/v1/clients

&nbsp;

Mantendo os GETs atuais.

&nbsp;

Contrato Node:

&nbsp;

{

  companyId,

  sellerId,

  personType,

  name,

  tradeName,

  document,

  mobile,

  phone,

  email,

  groupId,

  paymentTermId,

  paymentMethodId,

  address: {

    state,

    city,

    district,

    street,

    number,

    zip,

    complement

  }

}

&nbsp;

O sellerId NÃO vem diretamente do browser.

&nbsp;

Ele é resolvido pela Server Function autenticada.

&nbsp;

==================================================

17. ENDEREÇO DO CLIENTE — IMPORTANTE

==================================================

&nbsp;

A SP_CAD_CLIENTE_COMPLETO grava endereço em:

&nbsp;

ENDERECO

&nbsp;

relacionado por:

&nbsp;

CLIENTES.ID_PESSOA

→ ENDERECO.ID_PESSOA

&nbsp;

O read model atual de clientes precisa reconhecer esse endereço.

&nbsp;

Prioridade:

&nbsp;

1. ENDERECO cadastrado da pessoa;

2. endereço legado, se existir;

3. endereço do último pedido;

4. null.

&nbsp;

Manter fallback do último pedido para clientes antigos.

&nbsp;

Cliente recém-criado e ainda sem pedido deve retornar:

&nbsp;

address.origin = "registered"

&nbsp;

através de:

&nbsp;

GET /api/v1/clients/:id

&nbsp;

Não aceitar como solução depender de last_order.

&nbsp;

==================================================

18. SERVER FUNCTION

==================================================

&nbsp;

Criar Server Function autenticada equivalente à criação de pedidos.

&nbsp;

Usar:

&nbsp;

requireSupabaseAuth

&nbsp;

Receber do frontend:

&nbsp;

companyId

personType

name

tradeName

document

mobile

phone

email

groupId

paymentTermId

paymentMethodId

address

&nbsp;

Server Function:

&nbsp;

1. resolve usuário;

2. valida user_company_access;

3. lê profiles.erp_seller_id;

4. monta payload Node;

5. chama POST /api/v1/clients via callErp().

&nbsp;

Nunca chamar o Node ERP diretamente do browser.

&nbsp;

==================================================

19. FRONTEND — NOVO PEDIDO

==================================================

&nbsp;

Em:

&nbsp;

src/routes/_authenticated.pedidos-venda.novo.tsx

&nbsp;

manter busca atual.

&nbsp;

Adicionar próximo da busca:

&nbsp;

[ + Cadastrar novo cliente ]

&nbsp;

Quando não houver resultados:

&nbsp;

Nenhum cliente encontrado

&nbsp;

[ + Cadastrar novo cliente ]

&nbsp;

Usar Sheet/Dialog/Drawer responsivo ou componente dedicado.

&nbsp;

Não criar rota separada que perca o estado do wizard.

&nbsp;

==================================================

20. PROTEÇÃO DE SUBMISSÃO

==================================================

&nbsp;

POST de criação de cliente NÃO deve possuir retry automático.

&nbsp;

Enquanto estiver criando:

&nbsp;

desabilitar:

&nbsp;

Cadastrar cliente

&nbsp;

Mostrar loading.

&nbsp;

Evitar duplo clique e duas criações simultâneas.

&nbsp;

==================================================

21. SUCESSO

==================================================

&nbsp;

Após sucesso:

&nbsp;

CLIENTE CADASTRADO NO ERP

&nbsp;

João da Silva

CPF/CNPJ ...

Cliente ERP 4587

&nbsp;

[ Gerar novo pedido para este cliente ]

&nbsp;

Não criar pedido automaticamente.

&nbsp;

Após criação:

&nbsp;

invalidar/atualizar cache das queries de clientes.

&nbsp;

O novo cliente deve aparecer imediatamente na busca/detalhe.

&nbsp;

==================================================

22. GERAR NOVO PEDIDO

==================================================

&nbsp;

Somente quando o usuário tocar em:

&nbsp;

Gerar novo pedido para este cliente

&nbsp;

usar o store atual.

&nbsp;

Selecionar:

&nbsp;

createdClient.id

createdClient.name

companyId

&nbsp;

Depois seguir o MESMO comportamento atual de seleção de cliente:

&nbsp;

identityLocked = true

novo idempotencyKey

estado de itens limpo

step = items

&nbsp;

O cadastro do cliente NÃO deve apagar ou modificar estado do pedido antes deste botão.

&nbsp;

==================================================

23. DEFAULTS DO CLIENTE

==================================================

&nbsp;

Ao iniciar o novo pedido:

&nbsp;

endereço cadastrado

→ endereço padrão

&nbsp;

ID_PRAZO

→ condição de pagamento padrão

&nbsp;

ID_FORMA_PAGAMENTO

→ forma de pagamento padrão

&nbsp;

O Tipo de Venda continua pertencendo ao pedido.

&nbsp;

EDIT de pedido continua utilizando os valores históricos e não deve ser alterado.

&nbsp;

==================================================

24. SEGURANÇA E ERROS

==================================================

&nbsp;

Não logar payload completo de cliente nem CPF/CNPJ/telefone/e-mail completos.

&nbsp;

Erros padronizados:

&nbsp;

400 VALIDATION_ERROR

&nbsp;

409 CLIENT_ALREADY_EXISTS

&nbsp;

422 SELLER_NOT_MAPPED

&nbsp;

422 CUSTOMER_GROUP_INVALID

&nbsp;

422 PAYMENT_TERM_INVALID

&nbsp;

422 PAYMENT_METHOD_INVALID

&nbsp;

500 CLIENT_CREATE_FAILED

&nbsp;

503 ERP_UNAVAILABLE

&nbsp;

Não devolver SQL, stack ou mensagem bruta do Firebird ao frontend.

&nbsp;

==================================================

25. TESTES OBRIGATÓRIOS

==================================================

&nbsp;

Automatizados/mocks:

&nbsp;

PF → JURIDICA NULL

PJ → JURIDICA 1

CPF normalizado

CNPJ normalizado

34 parâmetros na ordem correta

CHAVE NULL

ID_USER NULL

duplicidade

rollback se SP_CAD_CONTATOS falhar

ID/ID_PES inválido

&nbsp;

Não criar automaticamente clientes no Firebird real nos testes.

&nbsp;

Teste real será manual.

&nbsp;

==================================================

26. TESTE MANUAL

==================================================

&nbsp;

Após atualizar o Node REAL:

&nbsp;

Cadastrar 1 PF teste.

&nbsp;

Validar:

&nbsp;

ID_CLIENTE

ID_PESSOA

nome

CPF

empresa

vendedor

grupo

prazo

forma de pagamento

WhatsApp

endereço

&nbsp;

Depois:

&nbsp;

Gerar novo pedido.

&nbsp;

Validar:

&nbsp;

cliente selecionado

endereço carregado

financeiro carregado

itens

equipamentos

entrega

pagamento

criação ERP

&nbsp;

Depois testar PJ.

&nbsp;

Testar também duplicidade do mesmo documento.

&nbsp;

==================================================

27. REGRESSÃO

==================================================

&nbsp;

Confirmar:

&nbsp;

cliente existente: PASS/FAIL

pesquisa cliente: PASS/FAIL

CREATE pedido: PASS/FAIL

EDIT pedido: PASS/FAIL

equipamentos: PASS/FAIL

cobertura: PASS/FAIL

entrega: PASS/FAIL

pagamento: PASS/FAIL

ERP EXCLUÍDO: PASS/FAIL

ERP INDISPONÍVEL: PASS/FAIL

APP-XXXX: PASS/FAIL

paginação: PASS/FAIL

cards: PASS/FAIL

&nbsp;

==================================================

28. NODE

==================================================

&nbsp;

NODE ALTERADO: SIM

&nbsp;

Depois da implementação será obrigatório:

&nbsp;

- sincronizar os arquivos de erp-api/ com o Node REAL ao lado do Firebird;

- reiniciar o Node real.

&nbsp;

Lovable reiniciar o ambiente próprio NÃO atualiza o servidor real.

&nbsp;

NPM INSTALL somente se package.json mudar.

&nbsp;

==================================================

29. RELATÓRIO FINAL

==================================================

&nbsp;

Informar:

&nbsp;

ARQUIVOS FRONTEND ALTERADOS:

&nbsp;

ARQUIVOS NODE ALTERADOS:

&nbsp;

NOVOS ARQUIVOS:

&nbsp;

POST /api/v1/clients:

SIM/NÃO

&nbsp;

GET /api/v1/customer-groups:

SIM/NÃO

&nbsp;

SP_CAD_CLIENTE_COMPLETO:

SIM/NÃO

&nbsp;

SP_CAD_CONTATOS:

SIM/NÃO

&nbsp;

INSERT MANUAL ERP:

NÃO

&nbsp;

TRANSAÇÃO FIREBIRD:

SIM/NÃO

&nbsp;

34 PARÂMETROS:

SIM/NÃO

&nbsp;

CHAVE:

NULL

&nbsp;

ID_USER:

NULL

&nbsp;

DUPLICIDADE:

SIM/NÃO

&nbsp;

CPF_CNPJ READ MODEL:

SIM/NÃO

&nbsp;

ENDERECO READ MODEL:

SIM/NÃO

&nbsp;

SELLER VIA profiles.erp_seller_id:

SIM/NÃO

&nbsp;

DEFAULT FINANCEIRO:

SIM/NÃO

&nbsp;

SUPABASE MIGRATION:

NÃO

&nbsp;

NODE ALTERADO:

SIM

&nbsp;

PACKAGE.JSON ALTERADO:

SIM/NÃO

&nbsp;

NPM INSTALL:

SIM/NÃO

&nbsp;

REGRESSÕES:

&nbsp;

PENDÊNCIAS:

&nbsp;

&nbsp;