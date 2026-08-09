"use strict";

const { LIMITS } = require("./orders.validator");

/**
 * ID_USER fixado internamente para toda ordem criada pela integração.
 * NUNCA vem do .env nem do frontend — regra de negócio oficial.
 */
const CAD_USER = 2;

function truncate(s, max) {
  if (s === undefined || s === null) return null;
  const str = String(s);
  return str.length > max ? str.slice(0, max) : str;
}

function orNull(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

function toDateOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const companyRule = require("../../shared/company/company-rule");

/**
 * Resolve companyId final aplicando a hierarquia oficial.
 *
 * Prioridade:
 *   1. payload.companyId ∈ {1,3}
 *   2. clientCompany  ∈ {1,3}
 *   3. groupName contém "GROTT" → 3
 *   4. fallback → 1
 *
 * Retorna sempre 1 ou 3.
 */
function resolveCompanyId(payloadCompanyId, clientCompanyId, groupName) {
  return companyRule.resolveCompanyId({
    explicitCompanyId: payloadCompanyId === 1 || payloadCompanyId === 3 ? payloadCompanyId : null,
    clientCompanyId: clientCompanyId === 1 || clientCompanyId === 3 ? clientCompanyId : null,
    groupDescription: groupName,
  });
}

/**
 * Monta o array posicional para SP_CAD_ORDEM_VENDA_COMPLETO.
 * Exatamente 30 parâmetros conforme contrato Firebird.
 */
function buildCompleteProcParams({ payload, companyId, clientContext, totals }) {
  // Se o cliente tiver endereço cadastrado, usamos. Se não, tentamos inferir 
  // do payload ou deixamos nulo se o ERP aceitar.
  // Conforme o briefing, a Sprint 7 foca na criação segura.
  // O payload da Sprint 7 NÃO envia endereço (diferente da Fase 2 anterior).
  // Portanto, buscamos os dados de endereço do clientContext (se disponível).
  const addr = clientContext?.address || {};

  return [
    /*  0 ID_EMPRESA               */ companyId,
    /*  1 ID_CLIENTE               */ payload.clientId,
    /*  2 ID_VENDEDOR              */ payload.sellerId,
    /*  3 ID_TIPO_VENDA            */ payload.saleTypeId,
    /*  4 ID_PRAZO                 */ payload.paymentTermId,
    /*  5 ID_FORMA_PAGAMENTO       */ payload.paymentMethodId,
    /*  6 ENTREGAR                 */ payload.deliver ? 1 : 0,
    /*  7 DATA_PREV_ENTREGA        */ toDateOrNull(payload.deliveryAt),
    /*  8 DATA_ENTREGA             */ null, // Criando: data de entrega real é futura
    /*  9 BUSCAR_EQUIP             */ payload.returnEquipment ? 1 : 0,
    /* 10 DATA_RETORNO             */ null,
    /* 11 DATA_PREV_RETORNO        */ toDateOrNull(payload.returnAt),
    /* 12 VALOR                    */ totals.total,
    /* 13 VALOR_FRETE              */ payload.freightValue,
    /* 14 UF                       */ truncate(addr.state, LIMITS.UF),
    /* 15 CIDADE                   */ truncate(addr.city, LIMITS.CIDADE),
    /* 16 BAIRRO                   */ truncate(addr.district, LIMITS.BAIRRO),
    /* 17 RUA                      */ truncate(addr.street, LIMITS.RUA),
    /* 18 NUMERO                   */ truncate(addr.number, LIMITS.NUMERO),
    /* 19 COMP                     */ truncate(orNull(addr.complement), LIMITS.COMP),
    /* 20 CEP                      */ truncate(addr.postalCode || addr.zip, LIMITS.CEP),
    /* 21 OBS                      */ truncate(orNull(payload.notes), LIMITS.OBS),
    /* 22 GERA_COBRANCA (FIXO=1)   */ 1,
    /* 23 SAIDA_ESTOQUE (FIXO=0)   */ 0,
    /* 24 ID_USER (constante)      */ CAD_USER,
    /* 25 CHAVE (NULL = criar)     */ null,
    /* 26 ID_TRANSPORTADOR         */ null,
    /* 27 ID_TRANSPORTADOR_VEICULO */ null,
    /* 28 PERCENT_DESC_COMERCIAL   */ 0,
    /* 29 ID_PDV_SESSAO            */ null,
  ];
}

/** SP_CAD_ITENS_ORDENS_VENDA — 6 IN posicionais; CHAVE='I' para inclusão. */
function buildItemProcParams(orderId, item) {
  return [
    /* 0 ID_ORDENS_VENDA */ orderId,
    /* 1 ID_PRODUTO      */ item.productId,
    /* 2 PRECO_UNIT      */ item.unitPrice,
    /* 3 QTDE_PEDIDA     */ item.quantity,
    /* 4 DESCONTO        */ 0,
    /* 5 CHAVE           */ "I",
  ];
}

/** SP_CAD_EQUIP_ORDENS_VENDA — 5 IN posicionais; CHAVE='I' para inclusão. */
function buildEquipmentProcParams(orderId, eq) {
  return [
    /* 0 ID_ORDENS_VENDA     */ orderId,
    /* 1 ID_TIPO_EQUIPAMENTO */ eq.equipmentTypeId,
    /* 2 ID_PRODUTO          */ null,
    /* 3 QTDE                */ eq.quantity,
    /* 4 CHAVE               */ "I",
  ];
}

module.exports = {
  CAD_USER,
  resolveCompanyId,
  buildCompleteProcParams,
  buildItemProcParams,
  buildEquipmentProcParams,
  truncate,
  toDateOrNull,
};
