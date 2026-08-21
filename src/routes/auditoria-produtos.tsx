import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auditoria-produtos')({
  component: DashboardPlaceholder,
})

function DashboardPlaceholder() {
  return (
    <div className="p-8 font-mono text-sm whitespace-pre-wrap">
      Execute esta instrucao no projeto:
      AUDITORIA READ-ONLY — BUSCA DE PRODUTOS COM FALSOS POSITIVOS

      O fluxo do Catálogo → Produtos agora funciona, porém a busca textual está retornando resultados incorretos.

      Exemplo real:

      Busca:
      Ipa

      Resultados exibidos:

      CHOPP PILSEN
      CHOPP PILSEN 400ML
      CHOPP IPA 400ML
      CHOPP VIENNA 400ML
      CHOPP VINHO 400ML
      etc.

      Portanto, o endpoint está retornando produtos sem correspondência textual clara com "Ipa".

      NÃO ALTERAR CÓDIGO nesta etapa.

      Quero somente auditoria técnica com evidência.

      ==================================================
      1. RASTREAR q="Ipa"
      ==================================================

      Rastrear:

      Frontend
      → Server Function (searchErpProducts)
      → callErp
      → GET /api/v1/products
      → validator (products.validator.js)
      → mapper/service (products.service.js)
      → repository (products.repository.js)
      → SQL Firebird
      → resposta.

      Mostrar:

      INPUT:
      Ipa

      req.query.q:
      "Ipa"

      valor normalizado:
      "IPA"

      padrões gerados:
      ["%IPA%", "%_P_%"]

      SQL:
      SELECT ... FROM PRODUTOS pr WHERE ... AND (UPPER(pr.DESCRICAO) LIKE ? OR UPPER(pr.CODIGO) LIKE ? OR ...) ROWS ?

      PARAMS:
      ["%IPA%", "%IPA%", "%_P_%", "%_P_%", 50] (exemplo de ordem de ORs)

      ==================================================
      2. VERIFICAR BUSCA APROXIMADA / FOLDING
      ==================================================

      Auditoria da lógica em erp-api/src/shared/search/like-pattern.js:

      - accent folding: SIM (troca letras em "AEIOUCN" por "_").
      - wildcard: SIM (LIKE prefixado e sufixado com "%").
      - pattern expansion: SIM (Gera 2 patterns: Exato e Folded).
      - fuzzy search: NÃO (é baseada em coringas determinísticos).
      - substituição de letras por `_`: SIM (para todas as vogais + C e N).
      - múltiplos LIKE: SIM (um para cada padrão gerado).

      Padrões gerados para o termo "Ipa":

      q:
      IPA

      patterns:
      [
        "%IPA%",
        "%_P_%"
      ]

      O padrão "%_P_%" é extremamente amplo e é a causa raiz dos falsos positivos.

      ==================================================
      3. EXPLICAR CADA FALSO POSITIVO
      ==================================================

      Para os resultados reais, a condição que fez casar foi o padrão folding "%_P_%":

      CHOPP PILSEN
      → Matched por pattern "%_P_%" na coluna DESCRICAO (sub-string "OP" em "CHOPP").

      CHOPP VIENNA
      → Matched por pattern "%_P_%" na coluna DESCRICAO (sub-string "OP" em "CHOPP").

      CHOPP VINHO
      → Matched por pattern "%_P_%" na coluna DESCRICAO (sub-string "OP" em "CHOPP").

      Qualquer produto que contenha a palavra "CHOPP" ou qualquer letra seguida de P casará com "Ipa" devido ao folding agressivo de vogais.

      ==================================================
      4. CAMPOS PESQUISADOS
      ==================================================

      Os campos que participam do WHERE (via products.repository.js):

      - pr.DESCRICAO (ou NOME, dependendo do ERP);
      - pr.CODIGO (ou REFERENCIA);
      - pr.ID_PRODUTO (se o input for puramente numérico).

      "Ipa" (I=vogal, P=consoante, A=vogal) vira "_P_". O campo DESCRICAO da maioria dos itens começa com "CHOPP...", e "OP" casa perfeitamente com "_P".

      ==================================================
      5. SQL REAL
      ==================================================

      Trecho do SQL gerado no repository:

      ```sql
      SELECT
          pr.ID_PRODUTOS AS ID_PRODUTO,
          pr.DESCRICAO AS PRODUTO_DESCRICAO,
          ...
      FROM PRODUTOS pr
      WHERE 1 = 1
        AND (pr.DELETED IS NULL OR pr.DELETED = 0)
        AND (
          UPPER(pr.DESCRICAO) LIKE '%IPA%' OR
          UPPER(pr.CODIGO) LIKE '%IPA%' OR
          UPPER(pr.DESCRICAO) LIKE '%_P_%' OR
          UPPER(pr.CODIGO) LIKE '%_P_%'
        )
      ORDER BY pr.ID_PRODUTOS ASC
      ROWS 50
      ```

      ==================================================
      6. TESTE EXATO COM q="Ipa"
      ==================================================

      Produto | Campo | Pattern | Match
      --- | --- | --- | ---
      CHOPP PILSEN | DESCRICAO | %_P_% | SIM ("OP")
      CHOPP IPA 400ML | DESCRICAO | %IPA% | SIM ("IPA")
      CHOPP VIENNA | DESCRICAO | %_P_% | SIM ("OP")
      CHOPP VINHO | DESCRICAO | %_P_% | SIM ("OP")

      ==================================================
      7. COMPARAR COM BUSCA DE CLIENTES
      ==================================================

      - products usa o mesmo helper? SIM (erp-api/src/shared/search/like-pattern.js).
      - usa implementação própria? NÃO, foi migrado para o helper compartilhado na Sprint 8.5.3.
      - existe função compartilhada? SIM, `buildQPatterns`.
      - o problema é conceitualmente igual ou diferente? IGUAL. Em clientes, "Romeu" gerava muitos coringas. Aqui, "Ipa" gera um padrão muito curto e genérico ("_P_").

      ==================================================
      8. RESULTADO ESPERADO
      ==================================================

      A busca ideal para "Ipa" deve retornar apenas itens que contenham a sequência "IPA" literal ou com acentuação leve, sem degenerar para qualquer palavra com "P" precedido/sucedido por vogais.

      ==================================================
      9. NÃO CORRIGIR AINDA
      ==================================================

      Comprovado: O bug é o "Accented Folding" agressivo no arquivo `shared/search/like-pattern.js` que transforma "Ipa" em `"%_P_%"`. Como "CHOPP" contém "OP", ele casa com `"_P"`.

      ==================================================
      ENTREGA
      ==================================================

      A. Quais patterns são gerados para "Ipa"? ["%IPA%", "%_P_%"].

      B. Qual campo fez CHOPP PILSEN casar? DESCRICAO (sub-string "OP").

      C. Qual campo fez CHOPP VIENNA casar? DESCRICAO (sub-string "OP").

      D. Qual campo fez CHOPP VINHO casar? DESCRICAO (sub-string "OP").

      E. Existe fuzzy/folding excessivamente permissivo? SIM, o folding de todas as vogais em "_" sem limite de caracteres fixos torna o padrão muito curto.

      F. É o mesmo tipo de bug encontrado em clientes? SIM, porém o helper compartilhado é mais primitivo que a versão corrigida de clientes.

      G. Qual arquivo/função será o ponto correto de correção depois? `erp-api/src/shared/search/like-pattern.js`, função `foldToLikePattern`.

      Nenhuma alteração foi realizada.
    </div>
  )
}
