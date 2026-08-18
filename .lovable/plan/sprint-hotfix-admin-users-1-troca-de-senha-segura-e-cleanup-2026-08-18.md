# # SPRINT HOTFIX ADMIN USERS.1 — TROCA DE SENHA SEGURA E CLEANUP FINAL

# PLANO COMPLETO CONSOLIDADO

&nbsp;

## OBJETIVO

&nbsp;

Corrigir definitivamente o primeiro acesso de usuários criados com senha temporária.

&nbsp;

Centralizar a troca inicial de senha no server-side e impedir qualquer forma de limpar `must_change_password` sem que a senha tenha sido efetivamente atualizada.

&nbsp;

Preservar integralmente:

&nbsp;

- criação direta com `auth.admin.createUser`;

- `admin_setup_created_user`;

- correção de `profiles_pkey`;

- Seller;

- permissões;

- LAST_ADMIN_PROTECTION;

- compensação Auth;

- Pedidos;

- Clientes.

&nbsp;

NÃO alterar Sellers Firebird.

NÃO alterar Mapa.

NÃO usar Fast Visual Edit.

ZERO escrita Firebird.

&nbsp;

==================================================

1. REMOVER BYPASS DA RPC ANTIGA

==================================================

&nbsp;

Criar NOVA migration corretiva.

&nbsp;

Não editar migration já aplicada.

&nbsp;

A função:

&nbsp;

public.complete_initial_password_change()

&nbsp;

NÃO pode continuar acessível diretamente por usuários autenticados.

&nbsp;

Preferência:

&nbsp;

DROP FUNCTION public.complete_initial_password_change();

&nbsp;

Se houver motivo técnico para mantê-la:

&nbsp;

REVOKE EXECUTE FROM PUBLIC;

REVOKE EXECUTE FROM authenticated;

&nbsp;

Ela não deve permanecer como mecanismo utilizado pelo frontend.

&nbsp;

Confirmar no relatório final que `authenticated` não possui mais EXECUTE.

&nbsp;

==================================================

2. SERVER FUNCTION changeInitialPassword

==================================================

&nbsp;

Atualizar:

&nbsp;

src/lib/permissions/password-change.functions.ts

&nbsp;

Implementar:

&nbsp;

changeInitialPassword()

&nbsp;

Entrada:

&nbsp;

{

  newPassword,

  confirmPassword

}

&nbsp;

Validação server-side:

&nbsp;

- mínimo 8 caracteres;

- não aceitar somente espaços;

- confirmação deve coincidir.

&nbsp;

Usar:

&nbsp;

requireSupabaseAuth

&nbsp;

O ID do usuário deve vir EXCLUSIVAMENTE de:

&nbsp;

context.userId

&nbsp;

NÃO aceitar:

&nbsp;

userId

profileId

targetUserId

&nbsp;

no payload do browser.

&nbsp;

==================================================

3. TROCA DA SENHA SERVER-SIDE

==================================================

&nbsp;

Fluxo obrigatório:

&nbsp;

1. autenticar;

2. obter context.userId;

3. validar nova senha;

4. consultar profile do próprio usuário;

5. confirmar que `must_change_password === true`;

6. atualizar senha:

&nbsp;

supabaseAdmin.auth.admin.updateUserById(

  context.userId,

  { password: data.newPassword }

)

&nbsp;

7. somente após sucesso no Auth:

   atualizar:

&nbsp;

profiles.must_change_password = false

&nbsp;

WHERE id = context.userId;

&nbsp;

8. retornar sucesso.

&nbsp;

A atualização do profile deve utilizar acesso server-side seguro.

&nbsp;

Não depender de RLS do browser.

&nbsp;

==================================================

4. ORDEM DE SEGURANÇA

==================================================

&nbsp;

PROIBIDO:

&nbsp;

limpar `must_change_password` antes de alterar a senha.

&nbsp;

Se:

&nbsp;

updateUserById falhar

&nbsp;

→ flag permanece true.

&nbsp;

Se:

&nbsp;

Auth atualizar senha

mas atualização do profile falhar

&nbsp;

→ retornar erro;

→ NÃO declarar sucesso;

→ usuário permanece bloqueado;

→ ele poderá entrar novamente usando a nova senha e repetir a conclusão.

&nbsp;

Não existe transação única entre Supabase Auth e PostgreSQL, portanto preservar essa ordem é obrigatório.

&nbsp;

==================================================

5. ForcePasswordChange

==================================================

&nbsp;

Atualizar:

&nbsp;

src/components/admin/ForcePasswordChange.tsx

&nbsp;

REMOVER chamada direta do browser:

&nbsp;

supabase.auth.updateUser({ password })

&nbsp;

A tela deve chamar somente:

&nbsp;

changeInitialPassword()

&nbsp;

com:

&nbsp;

newPassword

confirmPassword

&nbsp;

Após sucesso:

&nbsp;

- toast de sucesso;

- refetch do profile.

&nbsp;

Enquanto não houver sucesso completo:

&nbsp;

must_change_password continua true.

&nbsp;

==================================================

6. GATE AUTENTICADO

==================================================

&nbsp;

Preservar em:

&nbsp;

src/routes/_authenticated.tsx

&nbsp;

Se:

&nbsp;

profile.must_change_password === true

&nbsp;

renderizar SOMENTE:

&nbsp;

ForcePasswordChange.

&nbsp;

Não renderizar:

&nbsp;

AppShell

Mapa

Pedidos

Entregas

Admin

demais módulos.

&nbsp;

Após `profileQ.refetch()` retornar false:

&nbsp;

liberar aplicação normalmente.

&nbsp;

==================================================

7. TIPAGEM SUPABASE

==================================================

&nbsp;

Atualizar:

&nbsp;

src/integrations/supabase/types.ts

&nbsp;

Na tabela profiles adicionar:

&nbsp;

Row:

must_change_password: boolean

&nbsp;

Insert:

must_change_password?: boolean

&nbsp;

Update:

must_change_password?: boolean

&nbsp;

Atualizar também Functions/RPC types relevantes se necessário.

&nbsp;

Não resolver a nova coluna com casts `as any`.

&nbsp;

==================================================

8. REMOVER CASTS FORA DO ESCOPO

==================================================

&nbsp;

Após corrigir a tipagem central:

&nbsp;

restaurar:

&nbsp;

src/components/client/create-client-form.tsx

&nbsp;

para acesso normal tipado:

&nbsp;

profileQ.data?.full_name

&nbsp;

Remover:

&nbsp;

(profileQ.data as any)

&nbsp;

Restaurar:

&nbsp;

src/routes/_authenticated.pedidos-venda.novo.tsx

&nbsp;

para:

&nbsp;

myProfile.data?.erp_seller_id

myProfile.data.erp_seller_id

&nbsp;

Remover casts introduzidos apenas por problema de tipo.

&nbsp;

Nenhuma lógica de Pedido ou Cliente deve mudar.

&nbsp;

==================================================

9. LIMPAR _authenticated.tsx

==================================================

&nbsp;

Depois de atualizar types:

&nbsp;

usar diretamente:

&nbsp;

profileQ.data?.must_change_password

profileQ.data?.active

profileQ.data?.full_name

&nbsp;

Remover casts `as any`.

&nbsp;

==================================================

10. createAdminUser — PERFIL ANTES DO AUTH

==================================================

&nbsp;

Preservar:

&nbsp;

src/lib/permissions/admin-users-create.functions.ts

&nbsp;

Antes de:

&nbsp;

auth.admin.createUser()

&nbsp;

validar server-side:

&nbsp;

permissionProfileId existe

E

permissionProfile.active === true.

&nbsp;

Se perfil inválido:

&nbsp;

createUser NÃO deve ser chamado.

&nbsp;

A RPC `admin_setup_created_user` continua repetindo essa validação como proteção final.

&nbsp;

==================================================

11. CONFIRMAÇÃO DE SENHA NA CRIAÇÃO

==================================================

&nbsp;

Adicionar ao inputValidator de createAdminUser:

&nbsp;

confirmPassword

&nbsp;

Validar server-side:

&nbsp;

temporaryPassword === confirmPassword

&nbsp;

Regras:

&nbsp;

- mínimo 8;

- não somente espaços;

- confirmação igual.

&nbsp;

Depois da validação:

&nbsp;

NÃO enviar confirmPassword ao Auth.

NÃO enviar senha para RPC SQL.

&nbsp;

==================================================

12. PRESERVAR createAdminUser

==================================================

&nbsp;

Manter fluxo:

&nbsp;

permissão

→ input

→ permission profile

→ empresas

→ Seller

→ senha

→ createUser

→ setup RPC

→ compensação se necessário.

&nbsp;

Preservar:

&nbsp;

supabaseAdmin.auth.admin.createUser({

  email,

  password: temporaryPassword,

  email_confirm: true

})

&nbsp;

Preservar:

&nbsp;

deleteUser(newUserId)

&nbsp;

quando setup falhar após criação Auth.

&nbsp;

Não voltar a usar convite.

&nbsp;

==================================================

13. CLEANUP DO FLUXO ANTIGO

==================================================

&nbsp;

Excluir:

&nbsp;

src/lib/permissions/admin-users-invite.functions.ts.deprecated

&nbsp;

se nenhum código ativo depender dele.

&nbsp;

Não manter arquivo `.deprecated`, `.old`, `.temp` ou `.bak`.

&nbsp;

Não manter:

&nbsp;

inviteUserByEmail

&nbsp;

em fluxo ativo.

&nbsp;

==================================================

14. SELLERS

==================================================

&nbsp;

NÃO alterar:

&nbsp;

sellers.repository.js

sellers.controller.js

sellers.routes.js

erp-sellers.functions.ts

&nbsp;

Preservar Seller já homologado:

&nbsp;

COLABORADORES.ID_COLABORADORES

IS_VENDEDOR = 1

empresa 1/3.

&nbsp;

Seller continua validado ANTES da criação Auth.

&nbsp;

Preservar:

&nbsp;

SELLER_NOT_FOUND

SELLER_COMPANY_MISMATCH

ERP_UNAVAILABLE

ERP_NETWORK_ERROR

ERP_TIMEOUT.

&nbsp;

ZERO escrita Firebird.

&nbsp;

==================================================

15. HARDENING ADMINISTRATIVO

==================================================

&nbsp;

Preservar:

&nbsp;

LAST_ADMIN_PROTECTION

INVALID_COMPANY_ACCESS

INVALID_PERMISSION_PROFILE

&nbsp;

Preservar prioridade:

&nbsp;

error.hint || error.code

&nbsp;

Não alterar:

&nbsp;

admin_update_user

árvore de permissões

RLS não relacionado.

&nbsp;

==================================================

16. TESTES changeInitialPassword

==================================================

&nbsp;

Cobrir:

&nbsp;

A)

must_change_password=true

+

senha válida

&nbsp;

→ updateUserById chamado com context.userId.

&nbsp;

B)

payload não contém/aceita userId arbitrário.

&nbsp;

C)

Auth sucesso

+

profile update sucesso

&nbsp;

→ flag false

→ sucesso.

&nbsp;

D)

Auth falha

&nbsp;

→ profile NÃO atualizado.

&nbsp;

E)

Auth sucesso

+

profile update falha

&nbsp;

→ retornar erro.

&nbsp;

F)

senha curta

&nbsp;

→ updateUserById NÃO chamado.

&nbsp;

G)

senha somente espaços

&nbsp;

→ updateUserById NÃO chamado.

&nbsp;

H)

confirmação diferente

&nbsp;

→ updateUserById NÃO chamado.

&nbsp;

I)

must_change_password=false

&nbsp;

→ não executar troca inicial indevidamente.

&nbsp;

==================================================

17. TESTE DE BYPASS

==================================================

&nbsp;

Confirmar na migration final:

&nbsp;

`authenticated`

&nbsp;

NÃO possui EXECUTE na antiga:

&nbsp;

complete_initial_password_change

&nbsp;

OU a função não existe mais.

&nbsp;

Adicionar teste/verificação técnica dessa regra.

&nbsp;

==================================================

18. TESTES createAdminUser

==================================================

&nbsp;

Preservar testes existentes e adicionar:

&nbsp;

permission profile inexistente

→ createUser NÃO chamado.

&nbsp;

permission profile inativo

→ createUser NÃO chamado.

&nbsp;

temporaryPassword != confirmPassword

→ createUser NÃO chamado.

&nbsp;

Preservar:

&nbsp;

Seller null;

Seller válido;

Seller mismatch;

Seller inexistente;

ERP offline;

e-mail duplicado;

compensação;

profiles_pkey.

&nbsp;

==================================================

19. SEGURANÇA

==================================================

&nbsp;

Nunca registrar:

&nbsp;

temporaryPassword

confirmPassword

newPassword

&nbsp;

em:

&nbsp;

console

logs

RPC args

profiles

metadata

audit

responses.

&nbsp;

Service Role somente server-side.

&nbsp;

==================================================

20. REGRESSÃO

==================================================

&nbsp;

Executar:

&nbsp;

- admin-create-user;

- password-change;

- admin-sync;

- permissions.server;

- use-permissions;

- Sellers;

- Orders;

- Clients.

&nbsp;

NÃO alterar código de Pedidos ou Clientes para fazer teste passar.

&nbsp;

Ao final:

&nbsp;

create-client-form.tsx

→ zero mudança funcional.

&nbsp;

pedidos-venda.novo.tsx

→ zero mudança funcional.

&nbsp;

==================================================

21. CRITÉRIOS DE ACEITE

==================================================

&nbsp;

[ ] antiga RPC removida ou sem EXECUTE para authenticated

[ ] changeInitialPassword server-side

[ ] context.userId é única fonte de identidade

[ ] updateUserById usado server-side

[ ] Auth atualizado antes da flag

[ ] Auth failure mantém flag true

[ ] profile failure não retorna sucesso

[ ] ForcePasswordChange não chama updateUser diretamente

[ ] must_change_password tipado em types.ts

[ ] casts as any removidos

[ ] Novo Pedido sem mudança funcional

[ ] Novo Cliente sem mudança funcional

[ ] perfil validado antes de createUser

[ ] confirmação de senha validada server-side

[ ] Seller validado antes de createUser

[ ] convite antigo removido

[ ] LAST_ADMIN_PROTECTION preservada

[ ] tests passam

[ ] typecheck passa

[ ] build passa

[ ] ZERO escrita Firebird

[ ] NÃO usar Fast Visual Edit

&nbsp;

==================================================

22. STATUS FINAL

==================================================

&nbsp;

Após implementação:

&nbsp;

NOVO FLUXO DE USUÁRIOS CORRIGIDO — AGUARDANDO HOMOLOGAÇÃO

&nbsp;

Sellers Backend permanece:

&nbsp;

HOMOLOGADO NODE ↔ FIREBIRD

&nbsp;

Ainda NÃO declarar:

&nbsp;

SELLERS HOMOLOGADO E INTEGRADO

&nbsp;

==================================================

23. RELATÓRIO FINAL

==================================================

&nbsp;

Informar:

&nbsp;

1. migration corretiva;

2. status final da RPC antiga;

3. grants finais;

4. implementação changeInitialPassword;

5. uso de updateUserById;

6. garantia de context.userId;

7. comportamento quando Auth falha;

8. comportamento quando profile falha;

9. types.ts atualizado;

10. casts removidos;

11. perfil validado antes do Auth;

12. confirmação de senha server-side;

13. arquivo deprecated removido;

14. testes passed/failed/skipped;

15. typecheck;

16. build;

17. Pedidos sem mudança funcional;

18. Clientes sem mudança funcional;

19. Sellers Firebird sem alteração;

20. ZERO escrita Firebird.

&nbsp;

Depois:

&nbsp;

PARAR.

&nbsp;

NÃO iniciar Mapa.

NÃO iniciar Sprint 8.9.43.2.

Aguardar publicação e revisão Git.