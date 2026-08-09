import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: AuditPage,
});

function AuditPage() {
  return (
    <div className="container mx-auto p-8 font-mono text-sm whitespace-pre-wrap">
      Execute esta instrucao no projeto: AUDITORIA FINAL — SPRINT 8.2{"\n"}
      MODO SOMENTE LEITURA{"\n"}{"\n"}
      NÃO ALTERE absolutamente nada.{"\n"}{"\n"}
      Não criar arquivos.{"\n"}
      Não criar migrations.{"\n"}
      Não alterar RLS.{"\n"}
      Não alterar código.{"\n"}
      Não corrigir problemas encontrados.{"\n"}{"\n"}
      Quero apenas auditar a implementação REAL da Sprint 8.2 antes da homologação contra o Firebird.{"\n"}{"\n"}
      =================================================={"\n"}
      1. FONTE REAL DE AUTORIZAÇÃO DE EMPRESA{"\n"}
      =================================================={"\n"}{"\n"}
      A resposta da Sprint 8.2 afirmou que:{"\n"}{"\n"}
      handleCreateErpOrder consulta a tabela `user_company_access`.{"\n"}{"\n"}
      Confirme diretamente no código e no schema se essa tabela realmente existe.{"\n"}{"\n"}
      Audite todas as estruturas relacionadas a autorização por empresa:{"\n"}{"\n"}
      - user_company_access{"\n"}
      - user_companies{"\n"}
      - user_has_empresa(){"\n"}
      - profiles{"\n"}
      - quaisquer RPCs/funções relacionadas{"\n"}{"\n"}
      Informe:{"\n"}{"\n"}
      A. Qual é a fonte de verdade REAL para associação usuário → empresa?{"\n"}{"\n"}
      B. `user_company_access` realmente existe ou o relatório anterior informou um nome incorreto?{"\n"}{"\n"}
      C. A Sprint 8.2 criou alguma nova tabela, migration, função ou policy?{"\n"}{"\n"}
      D. Existe duplicidade de fontes de autorização?{"\n"}{"\n"}
      Não faça alterações.{"\n"}{"\n"}
      =================================================={"\n"}
      2. AUDITAR handleCreateErpOrder{"\n"}
      =================================================={"\n"}{"\n"}
      Abra a implementação real de:{"\n"}{"\n"}
      src/lib/erp-orders.functions.ts{"\n"}{"\n"}
      Mostre exatamente a sequência lógica executada para criação do pedido.{"\n"}{"\n"}
      Quero confirmar a ordem:{"\n"}{"\n"}
      1. autenticação;{"\n"}
      2. auth.uid();{"\n"}
      3. resolução das empresas autorizadas;{"\n"}
      4. validação do companyId;{"\n"}
      5. resolução de profiles.erp_seller_id;{"\n"}
      6. validação do seller;{"\n"}
      7. montagem do payload;{"\n"}
      8. callErp.{"\n"}{"\n"}
      Confirme explicitamente que:{"\n"}{"\n"}
      companyId inválido ou não autorizado{"\n"}
      → encerra a execução{"\n"}
      → callErp NÃO é chamado.{"\n"}{"\n"}
      =================================================={"\n"}
      3. TESTE CONTRA SPOOFING{"\n"}
      =================================================={"\n"}{"\n"}
      Audite os testes implementados.{"\n"}{"\n"}
      Confirme se eles realmente verificam que callErp NÃO é executado nos casos:{"\n"}{"\n"}
      Usuário [1]{"\n"}
      payload companyId=3{"\n"}{"\n"}
      Usuário [3]{"\n"}
      payload companyId=1{"\n"}{"\n"}
      Usuário sem empresa{"\n"}
      payload companyId=1{"\n"}{"\n"}
      companyId=999{"\n"}{"\n"}
      Não basta verificar apenas o status 403.{"\n"}{"\n"}
      Quero comprovação de que o mock/spyon de callErp permanece sem chamadas.{"\n"}{"\n"}
      =================================================={"\n"}
      4. USUÁRIO MULTIMARCA{"\n"}
      =================================================={"\n"}{"\n"}
      Audite o comportamento real do frontend.{"\n"}{"\n"}
      Para usuário autorizado a [1,3]:{"\n"}{"\n"}
      - aparece seleção Graal/Grott?{"\n"}
      - companyId selecionado fica persistido no Zustand/localStorage?{"\n"}
      - reload mantém a empresa?{"\n"}
      - iniciar NOVO pedido redefine corretamente esse estado?{"\n"}{"\n"}
      Verifique também se trocar companyId durante um pedido existente pode causar inconsistência com:{"\n"}{"\n"}
      - cliente selecionado;{"\n"}
      - itens;{"\n"}
      - preços;{"\n"}
      - condições de pagamento;{"\n"}
      - Idempotency-Key.{"\n"}{"\n"}
      Apenas relate eventual risco.{"\n"}{"\n"}
      NÃO corrija nesta auditoria.{"\n"}{"\n"}
      =================================================={"\n"}
      5. CLIENTE × EMPRESA{"\n"}
      =================================================={"\n"}
      Este ponto é especialmente importante.{"\n"}{"\n"}
      Mesmo que o usuário tenha acesso às empresas [1,3], verifique se existe alguma validação garantindo que o clientId enviado seja válido/permitido para o companyId selecionado.{"\n"}{"\n"}
      Exemplo:{"\n"}{"\n"}
      companyId = 3{"\n"}
      clientId pertencente exclusivamente à empresa 1{"\n"}{"\n"}
      Verifique:{"\n"}{"\n"}
      - frontend;{"\n"}
      - Server Function;{"\n"}
      - ERP API;{"\n"}
      - validação do cliente no Node;{"\n"}
      - procedure Firebird, quando puder ser determinado pelo código disponível.{"\n"}{"\n"}
      Classifique como:{"\n"}{"\n"}
      PROTEGIDO{"\n"}
      PARCIALMENTE PROTEGIDO{"\n"}
      NÃO PROTEGIDO{"\n"}
      ou{"\n"}
      NÃO FOI POSSÍVEL DETERMINAR.{"\n"}{"\n"}
      Não faça alterações.{"\n"}{"\n"}
      =================================================={"\n"}
      6. SELLER × EMPRESA{"\n"}
      =================================================={"\n"}{"\n"}
      Verifique também:{"\n"}{"\n"}
      Usuário possui acesso [1,3]{"\n"}
      profiles.erp_seller_id = 4{"\n"}{"\n"}
      Esse mesmo ID_VENDEDOR=4 é necessariamente válido para Graal e Grott?{"\n"}{"\n"}
      Existe validação de:{"\n"}{"\n"}
      sellerId × companyId{"\n"}{"\n"}
      em algum ponto?{"\n"}{"\n"}
      Ou ID_VENDEDOR é global no Firebird?{"\n"}{"\n"}
      Não presuma.{"\n"}{"\n"}
      Investigue o código/queries/procedures disponíveis e informe o que pode ser comprovado.{"\n"}{"\n"}
      =================================================={"\n"}
      7. IDEMPOTÊNCIA × TROCA DE EMPRESA{"\n"}
      =================================================={"\n"}{"\n"}
      Audite um cenário específico:{"\n"}{"\n"}
      Usuário começa pedido Graal:{"\n"}{"\n"}
      companyId=1{"\n"}
      Idempotency-Key=ABC{"\n"}{"\n"}
      Depois altera para Grott antes do envio.{"\n"}{"\n"}
      A chave continua ABC?{"\n"}{"\n"}
      Se sim, determine se isso é correto considerando que o payload mudou antes da primeira submissão.{"\n"}{"\n"}
      Depois analise cenário diferente:{"\n"}{"\n"}
      pedido já foi enviado e ficou `unknown`{"\n"}
      → usuário consegue alterar companyId?{"\n"}
      → poderia tentar novamente com mesma Idempotency-Key e payload diferente?{"\n"}{"\n"}
      Isso poderia gerar:{"\n"}{"\n"}
      409 Conflict{"\n"}{"\n"}
      na ERP API?{"\n"}{"\n"}
      Quero somente diagnóstico.{"\n"}{"\n"}
      =================================================={"\n"}
      8. EXECUTAR TESTES{"\n"}
      =================================================={"\n"}{"\n"}
      Execute os testes existentes relacionados a:{"\n"}{"\n"}
      - erp-orders.functions;{"\n"}
      - company authorization;{"\n"}
      - seller mapping;{"\n"}
      - idempotency/contrato, se houver.{"\n"}{"\n"}
      Não modifique testes para fazê-los passar.{"\n"}{"\n"}
      Informe:{"\n"}{"\n"}
      - comando executado;{"\n"}
      - total;{"\n"}
      - aprovados;{"\n"}
      - falhos.{"\n"}{"\n"}
      =================================================={"\n"}
      9. RESULTADO FINAL{"\n"}
      =================================================={"\n"}{"\n"}
      Entregue uma tabela:{"\n"}{"\n"}
      ITEM | STATUS | EVIDÊNCIA{"\n"}{"\n"}
      Incluindo:{"\n"}{"\n"}
      - Fonte de autorização por empresa{"\n"}
      - Company server-side{"\n"}
      - Bloqueio antes de callErp{"\n"}
      - Multimarca{"\n"}
      - Seller server-side{"\n"}
      - Seller × empresa{"\n"}
      - Cliente × empresa{"\n"}
      - Idempotência{"\n"}
      - HMAC{"\n"}
      - Compatibilidade com ERP API{"\n"}{"\n"}
      E responda objetivamente:{"\n"}{"\n"}
      A. Podemos homologar um pedido Graal real?{"\n"}{"\n"}
      B. Podemos homologar um pedido Grott real?{"\n"}{"\n"}
      C. Existe algum risco CRÍTICO ou ALTO que deveria impedir esses testes?{"\n"}{"\n"}
      D. Existe alguma inconsistência criada pela Sprint 8.2?{"\n"}{"\n"}
      E. Qual deve ser exatamente o próximo passo depois desta auditoria?{"\n"}{"\n"}
      IMPORTANTE:{"\n"}{"\n"}
      Esta é uma AUDITORIA READ-ONLY.{"\n"}{"\n"}
      Não implemente correções mesmo que encontre problemas.{"\n"}
      Não altere nenhum arquivo.
    </div>
  );
}