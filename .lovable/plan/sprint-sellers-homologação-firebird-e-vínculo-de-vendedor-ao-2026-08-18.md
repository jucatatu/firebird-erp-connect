# # SPRINT SELLERS — HOMOLOGAÇÃO FIREBIRD E VÍNCULO DE VENDEDOR AO USUÁRIO

# PLANO COMPLETO CONSOLIDADO

&nbsp;

## OBJETIVO

&nbsp;

Concluir o módulo Sellers usando exclusivamente o schema comprovado no Firebird real e integrar o vendedor ERP ao cadastro/edição administrativa de usuários.

&nbsp;

A sprint deve:

&nbsp;

1. implementar consulta real de vendedores no Firebird;

2. manter ZERO escrita no Firebird;

3. disponibilizar listagem e consulta por ID;

4. permitir busca por nome e apelido;

5. limitar Sellers às empresas 1 e 3;

6. integrar o Seller ao cadastro/edição de usuário;

7. validar o Seller server-side antes de persistir;

8. permitir alterar, atribuir e remover erpSellerId;

9. preservar profiles.erp_seller_id como único vínculo local;

10. homologar o funcionamento contra o Firebird real antes de declarar Sellers concluído.

&nbsp;

NÃO usar Fast Visual Edit.

&nbsp;

NÃO alterar:

&nbsp;

- Mapa;

- Novo Cliente;

- Novo Pedido;

- Entregas;

- Recolhas;

- Aprovações;

- Catálogo;

- Produtos;

- Equipamentos;

- geocodificação;

- sistema de permissões.

&nbsp;

==================================================

1. SCHEMA FIREBIRD HOMOLOGADO

==================================================

&nbsp;

O schema abaixo foi comprovado diretamente no Firebird real.

&nbsp;

Tabela:

&nbsp;

COLABORADORES

&nbsp;

Campos relevantes comprovados:

&nbsp;

- ID_COLABORADORES

- ID_PESSOA

- ID_EMPRESA

- IS_VENDEDOR

- INATIVO

- DELETED

- DEMISSAO

&nbsp;

Tabela:

&nbsp;

PESSOAS

&nbsp;

Campos relevantes comprovados:

&nbsp;

- ID_PESSOA

- NOME

- APELIDO

- DELETED

&nbsp;

Relacionamento:

&nbsp;

COLABORADORES.ID_PESSOA

→ PESSOAS.ID_PESSOA.

&nbsp;

O ID utilizado pelo ERP como ID_VENDEDOR é:

&nbsp;

COLABORADORES.ID_COLABORADORES.

&nbsp;

NÃO utilizar ID_PESSOA como erpSellerId.

&nbsp;

Foi comprovado também que:

&nbsp;

ORDENS_VENDA.ID_VENDEDOR

FATURAMENTO.ID_VENDEDOR

DUPLICATAS.ID_VENDEDOR

CLIENTES.ID_VENDEDOR

&nbsp;

referenciam PK_COLABORADORES.

&nbsp;

==================================================

2. REGRA HOMOLOGADA DE VENDEDOR

==================================================

&nbsp;

A condição comprovada no Firebird é:

&nbsp;

COLABORADORES.IS_VENDEDOR = 1

&nbsp;

e empresa:

&nbsp;

COLABORADORES.ID_EMPRESA IN (1,3).

&nbsp;

Empresas:

&nbsp;

1 = GRAAL

3 = GROTT.

&nbsp;

IMPORTANTE:

&nbsp;

NÃO criar nesta sprint regras adicionais como:

&nbsp;

INATIVO = 0

DELETED = 0

DEMISSAO IS NULL

PESSOAS.DELETED = 0

&nbsp;

porque essas regras NÃO foram homologadas.

&nbsp;

Nos vendedores reais inspecionados esses campos estavam NULL.

&nbsp;

Portanto, nesta sprint:

&nbsp;

"status de vendedor"

&nbsp;

significa exclusivamente:

&nbsp;

IS_VENDEDOR = 1.

&nbsp;

Qualquer regra futura de ativo/inativo será homologada separadamente.

&nbsp;

==================================================

3. SQL BASE

==================================================

&nbsp;

Implementar em:

&nbsp;

erp-api/src/modules/sellers/sellers.repository.js

&nbsp;

consulta baseada em:

&nbsp;

SELECT

    c.ID_COLABORADORES AS ID_VENDEDOR,

    c.ID_EMPRESA AS ID_EMPRESA,

    p.NOME AS NOME,

    p.APELIDO AS APELIDO

FROM COLABORADORES c

JOIN PESSOAS p

    ON p.ID_PESSOA = c.ID_PESSOA

WHERE c.IS_VENDEDOR = 1

  AND c.ID_EMPRESA IN (1,3)

&nbsp;

Adicionar de forma segura:

&nbsp;

- busca;

- filtro opcional de empresa;

- ordenação;

- limite.

&nbsp;

NÃO inventar tabela:

&nbsp;

VENDEDORES

FUNCIONARIOS

ERP_SELLERS

USUARIOS.

&nbsp;

==================================================

4. REPOSITORY — searchSellers

==================================================

&nbsp;

Substituir o bloqueio temporário:

&nbsp;

SELLER_SCHEMA_NOT_DISCOVERED.

&nbsp;

Implementar searchSellers com:

&nbsp;

- query;

- limit;

- companyId opcional.

&nbsp;

Retorno normalizado:

&nbsp;

{

  id: number,

  name: string,

  nickname: string | null,

  companyId: 1 | 3

}

&nbsp;

Exemplo:

&nbsp;

{

  id: 3,

  name: "EMANUEL",

  nickname: "EMANUEL",

  companyId: 1

}

&nbsp;

Não expor nomes de colunas Firebird ao frontend.

&nbsp;

==================================================

5. BUSCA

==================================================

&nbsp;

O parâmetro:

&nbsp;

q

&nbsp;

deve pesquisar:

&nbsp;

PESSOAS.NOME

&nbsp;

OU:

&nbsp;

PESSOAS.APELIDO.

&nbsp;

Requisitos:

&nbsp;

- q opcional;

- trim;

- substring;

- parâmetros SQL;

- nenhuma concatenação direta de texto recebido do usuário.

&nbsp;

q vazio:

&nbsp;

retorna normalmente a lista.

&nbsp;

==================================================

6. LIMIT

==================================================

&nbsp;

Preservar:

&nbsp;

default = 50

mínimo = 1

máximo = 100.

&nbsp;

Não aceitar limite arbitrário.

&nbsp;

Usar o mecanismo seguro compatível com Firebird para limitar resultados.

&nbsp;

==================================================

7. COMPANY ID

==================================================

&nbsp;

Adicionar parâmetro opcional:

&nbsp;

companyId.

&nbsp;

Permitidos:

&nbsp;

1

3.

&nbsp;

Comportamento:

&nbsp;

GET /api/v1/sellers

&nbsp;

→ Graal + Grott.

&nbsp;

GET /api/v1/sellers?companyId=1

&nbsp;

→ somente Graal.

&nbsp;

GET /api/v1/sellers?companyId=3

&nbsp;

→ somente Grott.

&nbsp;

Outros valores:

&nbsp;

400.

&nbsp;

==================================================

8. ENDPOINT DE LISTAGEM

==================================================

&nbsp;

Preservar:

&nbsp;

GET /api/v1/sellers

&nbsp;

Preservar:

&nbsp;

authMiddleware.

&nbsp;

Resposta:

&nbsp;

{

  "success": true,

  "sellers": [...]

}

&nbsp;

Após homologação:

&nbsp;

SELLER_SCHEMA_NOT_DISCOVERED

&nbsp;

não deve mais ser fluxo normal.

&nbsp;

Firebird indisponível:

&nbsp;

usar ERP_UNAVAILABLE existente.

&nbsp;

Nunca expor:

&nbsp;

- SQL;

- host;

- database;

- usuário;

- senha;

- path;

- stack do driver.

&nbsp;

==================================================

9. CONSULTA POR ID

==================================================

&nbsp;

Implementar:

&nbsp;

getSellerById(id).

&nbsp;

Consulta deve procurar:

&nbsp;

COLABORADORES.ID_COLABORADORES = ?

&nbsp;

com:

&nbsp;

IS_VENDEDOR = 1

ID_EMPRESA IN (1,3).

&nbsp;

Adicionar:

&nbsp;

GET /api/v1/sellers/:id

&nbsp;

Seller encontrado:

&nbsp;

200.

&nbsp;

Não encontrado:

&nbsp;

404

&nbsp;

code:

&nbsp;

SELLER_NOT_FOUND.

&nbsp;

ID inválido:

&nbsp;

400.

&nbsp;

==================================================

10. ZERO ESCRITA FIREBIRD

==================================================

&nbsp;

Toda esta sprint é READ ONLY no Firebird.

&nbsp;

PROIBIDO:

&nbsp;

INSERT

UPDATE

DELETE

DDL

ALTER

DROP

EXECUTE PROCEDURE de escrita.

&nbsp;

O vínculo de usuário é persistido somente no Supabase.

&nbsp;

==================================================

11. TESTES ERP API

==================================================

&nbsp;

Adicionar testes para:

&nbsp;

- listagem;

- q vazio;

- busca por NOME;

- busca por APELIDO;

- companyId 1;

- companyId 3;

- companyId inválido;

- limit válido;

- limit inválido;

- normalização JSON;

- getSellerById existente;

- getSellerById inexistente;

- ID inválido;

- ERP_UNAVAILABLE;

- endpoint autenticado;

- parâmetros SQL.

&nbsp;

Preservar testes existentes.

&nbsp;

==================================================

12. SCRIPT DE INSPEÇÃO

==================================================

&nbsp;

Preservar:

&nbsp;

erp-api/scripts/inspect-sellers-schema.js.

&nbsp;

Adicionar no início:

&nbsp;

require("dotenv").config();

&nbsp;

para permitir:

&nbsp;

node scripts/inspect-sellers-schema.js

&nbsp;

diretamente.

&nbsp;

Corrigir exit code:

&nbsp;

sucesso → 0

erro → 1.

&nbsp;

Continuar exclusivamente READ ONLY.

&nbsp;

==================================================

13. FRONTEND — ADMINISTRAÇÃO DE USUÁRIOS

==================================================

&nbsp;

Usar a tela administrativa existente.

&nbsp;

NÃO criar novo cadastro.

&nbsp;

No formulário de:

&nbsp;

- convite;

- edição;

&nbsp;

tornar funcional o campo:

&nbsp;

Vendedor ERP.

&nbsp;

Hoje o Seller estava temporariamente bloqueado enquanto aguardava homologação.

&nbsp;

Essa proteção temporária deve ser removida.

&nbsp;

==================================================

14. SELECT / COMBOBOX DE SELLER

==================================================

&nbsp;

Carregar Sellers reais pela ERP API.

&nbsp;

Exibir:

&nbsp;

NOME — EMPRESA

&nbsp;

Exemplos:

&nbsp;

EMANUEL — GRAAL

&nbsp;

MARCOS — GROTT.

&nbsp;

Se houver utilidade visual, APELIDO também pode aparecer como informação secundária.

&nbsp;

Persistir:

&nbsp;

seller.id

&nbsp;

que corresponde a:

&nbsp;

COLABORADORES.ID_COLABORADORES.

&nbsp;

==================================================

15. SELLER NULLABLE

==================================================

&nbsp;

erpSellerId continua nullable.

&nbsp;

Não tornar Seller obrigatório para todo usuário.

&nbsp;

Não criar nesta sprint regra:

&nbsp;

role vendedor → seller obrigatório.

&nbsp;

Se necessário futuramente, criar requisito separado.

&nbsp;

==================================================

16. FILTRO DO SELECT POR EMPRESA

==================================================

&nbsp;

Se usuário possui:

&nbsp;

[1]

&nbsp;

mostrar Sellers GRAAL.

&nbsp;

Se possui:

&nbsp;

[3]

&nbsp;

mostrar Sellers GROTT.

&nbsp;

Se possui:

&nbsp;

[1,3]

&nbsp;

mostrar Sellers de ambas.

&nbsp;

Se o usuário alterar as empresas e o Seller selecionado deixar de ser compatível:

&nbsp;

NÃO mudar silenciosamente.

&nbsp;

Bloquear salvamento com:

&nbsp;

"O vendedor ERP selecionado pertence a uma empresa que não está habilitada para este usuário."

&nbsp;

==================================================

17. SERVER-SIDE VALIDATION

==================================================

&nbsp;

Não confiar apenas no frontend.

&nbsp;

Antes de persistir erpSellerId:

&nbsp;

Se:

&nbsp;

erpSellerId = null

&nbsp;

permitir.

&nbsp;

Caso contrário:

&nbsp;

consultar Seller pela ERP API server-side.

&nbsp;

Validar:

&nbsp;

1. Seller existe;

2. endpoint retornou vendedor real;

3. companyId é 1 ou 3;

4. companyId pertence ao array companies do usuário.

&nbsp;

Se Seller não existir:

&nbsp;

SELLER_NOT_FOUND.

&nbsp;

Se empresa não estiver autorizada:

&nbsp;

SELLER_COMPANY_MISMATCH.

&nbsp;

==================================================

18. INVITE USER

==================================================

&nbsp;

Remover comportamento temporário que força:

&nbsp;

_erp_seller_id = null.

&nbsp;

Após validação:

&nbsp;

permitir salvar Seller escolhido.

&nbsp;

Se null:

&nbsp;

salvar null.

&nbsp;

Preservar:

&nbsp;

- admin.users/create;

- company allowlist;

- roles;

- permissionProfile;

- compensação do Auth;

- regras administrativas existentes.

&nbsp;

==================================================

19. UPDATE USER

==================================================

&nbsp;

Remover comportamento temporário que sempre preserva:

&nbsp;

currentProfile.erp_seller_id.

&nbsp;

Agora permitir:

&nbsp;

- manter Seller;

- alterar Seller;

- remover Seller.

&nbsp;

Sempre validar Seller server-side antes de chamar a RPC administrativa.

&nbsp;

Preservar:

&nbsp;

- LAST_ADMIN_PROTECTION;

- admin.users/edit/delete;

- Perfil Administrador ⇔ admin;

- empresas;

- permission profile.

&nbsp;

==================================================

20. PERSISTÊNCIA

==================================================

&nbsp;

Persistir exclusivamente em:

&nbsp;

profiles.erp_seller_id.

&nbsp;

Não criar no Supabase:

&nbsp;

sellers

erp_sellers

seller_name

seller_company

seller_snapshot.

&nbsp;

Firebird permanece fonte de verdade.

&nbsp;

==================================================

21. ERROS

==================================================

&nbsp;

SELLER_NOT_FOUND:

&nbsp;

"O vendedor selecionado não existe mais no ERP."

&nbsp;

SELLER_COMPANY_MISMATCH:

&nbsp;

"O vendedor ERP selecionado pertence a uma empresa que não está habilitada para este usuário."

&nbsp;

ERP_UNAVAILABLE:

&nbsp;

"Não foi possível consultar os vendedores no ERP neste momento. Tente novamente."

&nbsp;

Não expor detalhes Firebird.

&nbsp;

==================================================

22. TESTES SERVER FUNCTIONS

==================================================

&nbsp;

Adicionar testes para:

&nbsp;

- seller null;

- invite com Seller válido;

- update com Seller válido;

- alterar Seller;

- remover Seller;

- Seller inexistente;

- Seller empresa incompatível;

- Seller empresa 1 + companies [1];

- Seller empresa 3 + companies [3];

- Seller empresa 1 + companies [1,3];

- Seller empresa 3 + companies [1,3];

- ERP indisponível;

- permissions preservadas.

&nbsp;

==================================================

23. DOCUMENTAÇÃO

==================================================

&nbsp;

Documentar:

&nbsp;

Schema Sellers homologado em 18/08/2026.

&nbsp;

ID:

&nbsp;

COLABORADORES.ID_COLABORADORES.

&nbsp;

Pessoa:

&nbsp;

COLABORADORES.ID_PESSOA

→ PESSOAS.ID_PESSOA.

&nbsp;

Nome:

&nbsp;

PESSOAS.NOME.

&nbsp;

Apelido:

&nbsp;

PESSOAS.APELIDO.

&nbsp;

Empresa:

&nbsp;

COLABORADORES.ID_EMPRESA.

&nbsp;

Condição de vendedor:

&nbsp;

COLABORADORES.IS_VENDEDOR = 1.

&nbsp;

Empresas:

&nbsp;

1 = GRAAL

3 = GROTT.

&nbsp;

Não documentar credenciais.

&nbsp;

==================================================

24. HOMOLOGAÇÃO REAL

==================================================

&nbsp;

Após implementar, rodar contra o Firebird real.

&nbsp;

Em:

&nbsp;

C:\ERP-API-V2

&nbsp;

executar:

&nbsp;

npm run check

&nbsp;

npm test

&nbsp;

Iniciar a API normalmente.

&nbsp;

Testar de verdade:

&nbsp;

GET /api/v1/sellers

&nbsp;

GET /api/v1/sellers?companyId=1

&nbsp;

GET /api/v1/sellers?companyId=3

&nbsp;

GET /api/v1/sellers?q=<NOME REAL>

&nbsp;

GET /api/v1/sellers?q=<APELIDO REAL>

&nbsp;

GET /api/v1/sellers/<ID REAL>

&nbsp;

Confirmar:

&nbsp;

- Sellers reais retornados;

- empresas corretas;

- nomes corretos;

- IDs corretos.

&nbsp;

==================================================

25. HOMOLOGAÇÃO ADMINISTRATIVA

==================================================

&nbsp;

Testar:

&nbsp;

1. usuário GRAAL → Seller GRAAL;

2. usuário GROTT → Seller GROTT;

3. usuário GRAAL + GROTT → Seller de ambas;

4. editar usuário com Seller existente;

5. trocar Seller;

6. remover Seller;

7. Seller incompatível → bloqueado;

8. ERP indisponível → mensagem adequada.

&nbsp;

Salvar usuário e reabrir.

&nbsp;

Confirmar que:

&nbsp;

profiles.erp_seller_id

&nbsp;

foi persistido e relido corretamente.

&nbsp;

==================================================

26. CRITÉRIOS DE ACEITE

==================================================

&nbsp;

[ ] COLABORADORES usado

[ ] PESSOAS usado

[ ] ID_COLABORADORES = erpSellerId

[ ] IS_VENDEDOR = 1

[ ] nenhuma regra inventada de INATIVO/DELETED/DEMISSAO

[ ] empresas somente 1 e 3

[ ] GET /api/v1/sellers funcionando

[ ] busca NOME funcionando

[ ] busca APELIDO funcionando

[ ] companyId funcionando

[ ] GET /api/v1/sellers/:id funcionando

[ ] SELLER_NOT_FOUND funcionando

[ ] authMiddleware preservado

[ ] ZERO escrita Firebird

[ ] Seller dropdown real

[ ] Seller nullable

[ ] filtro por empresa

[ ] validação server-side

[ ] SELLER_COMPANY_MISMATCH funcionando

[ ] invite salva Seller

[ ] update altera Seller

[ ] update remove Seller

[ ] profiles.erp_seller_id é única persistência local

[ ] nenhuma tabela local de Sellers

[ ] testes ERP API passam

[ ] testes frontend/server passam

[ ] typecheck passa

[ ] build passa

[ ] módulos operacionais não alterados

&nbsp;

==================================================

27. STATUS

==================================================

&nbsp;

NÃO declarar:

&nbsp;

SELLERS HOMOLOGADO NO FIREBIRD

&nbsp;

apenas porque o código foi implementado.

&nbsp;

Só declarar após:

&nbsp;

- execução contra o Firebird real;

- endpoint retornando Sellers reais;

- testes empresa 1 e 3;

- busca real;

- Seller por ID real;

- vínculo em usuário salvo e relido.

&nbsp;

Antes disso:

&nbsp;

SELLERS EM HOMOLOGAÇÃO FIREBIRD.

&nbsp;

Após todos os critérios:

&nbsp;

SELLERS HOMOLOGADO NO FIREBIRD.

&nbsp;

==================================================

28. RELATÓRIO FINAL

==================================================

&nbsp;

Informar:

&nbsp;

1. arquivos alterados;

2. SQL final;

3. JSON Seller final;

4. endpoint listagem;

5. endpoint por ID;

6. resultado q;

7. resultado companyId;

8. quantidade total de Sellers reais;

9. quantidade GRAAL;

10. quantidade GROTT;

11. teste por NOME;

12. teste por APELIDO;

13. teste por ID;

14. integração UserDialog;

15. validação server-side;

16. Seller null;

17. alteração Seller;

18. remoção Seller;

19. SELLER_NOT_FOUND;

20. SELLER_COMPANY_MISMATCH;

21. profiles.erp_seller_id;

22. confirmação de nenhuma tabela Seller local;

23. testes ERP passed/failed/skipped;

24. testes frontend passed/failed/skipped;

25. typecheck;

26. build;

27. lint se houver;

28. confirmação de ZERO escrita Firebird;

29. status final real da homologação.

&nbsp;

==================================================

29. REGRA DE PARADA

==================================================

&nbsp;

PARAR SOMENTE APÓS:

&nbsp;

- cumprir todos os itens desta sprint;

- executar os testes;

- realizar a homologação contra o Firebird real;

- testar o vínculo administrativo;

- produzir o relatório final.

&nbsp;

Depois disso:

&nbsp;

PARAR.

&nbsp;

NÃO iniciar recuperação do Mapa.

NÃO iniciar Sprint 8.9.43.2.

NÃO alterar outros módulos.

&nbsp;

Aguardar publicação e revisão do Git.