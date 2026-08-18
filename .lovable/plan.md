# Sprint 8.9.43.1 — Consolidação Administrativa e Segurança

Este plano visa corrigir regressões no núcleo de permissões, implementar a proteção real do último administrador, sincronizar papéis administrativos e completar o CRUD de usuários e perfis, além de regularizar a integração de vendedores ERP.

## Segurança e Banco de Dados (Supabase)

- **Nova Migration Corretiva**: Atualizar `has_permission` para validar em cascata `profiles.active`, `permission_profiles.active` e `permission_resources.active`.
- **Refinamento `has_role`**: Utilizar comparação segura `profiles.active IS TRUE`.
- **Proteção Último Admin**: Implementar validação server-side que impede qualquer operação (desativação, troca de perfil ou remoção de role) que resulte em zero administradores ativos.

## Backend ERP (erp-api)

- **Correção Sellers**: Remover SQL inventado e fallbacks cegos. O endpoint retornará `SELLER_SCHEMA_NOT_DISCOVERED` até a homologação.
- **Script de Introspecção**: Corrigir `erp-api/scripts/inspect-sellers-schema.js` para usar metadados reais do Firebird e identificar a origem de `ID_VENDEDOR`.

## Server Functions (Frontend)

- **Sincronização Admin**: Garantir que `Perfil Administrador` e `user_roles.admin` sejam atribuídos/removidos em conjunto, respeitando a proteção de último admin.
- **Administração de Usuários**: Completar `inviteUser`, `updateUser` e `setUserActiveStatus` com validação Zod e verificações de permissão explícitas.
- **CRUD de Perfis**: Implementar `createPermissionProfile`, `updatePermissionProfile`, `saveProfileRules` e `deletePermissionProfile`.

## Interface Administrativa

- **Editor de Usuário**: Diálogo para gerenciar nome, perfil, empresas, vendedor ERP e status ativo, com e-mail read-only.
- **Editor de Regras (Árvore)**: Interface para gerenciar a matriz de permissões (Visualizar/Criar/Editar/Deletar) baseada em dados reais do banco.
- **Novo Usuário**: Fluxo de convite via Supabase Auth configurando todas as tabelas relacionadas em uma transação lógica.

## Detalhes Técnicos

- **has_permission**: Retornar `false` se qualquer elo da cadeia (usuário, perfil ou recurso) estiver inativo.
- **Sellers Status**: Exibir campo desabilitado no cadastro de cliente com mensagem informativa até a conclusão da introspecção.
- **Testes**: Cobertura total para novos cenários de bloqueio e sincronização.
