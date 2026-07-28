"use strict";

const { LIMITS } = require("./orders.validator");
const companyRule = require("../../shared/company/company-rule");

/**
 * ID_USER fixado internamente para toda ordem criada pela integração.
 * NUNCA vem do .env nem do frontend — regra de negócio oficial.
 */
const CAD_USER = 2;

/**
 * Trunca string preservando os primeiros N caracteres. WIN1252 é 1B/char,
 * portanto tamanho em caracteres == tamanho em bytes para o intervalo suportado.
 * Caracteres fora do WIN1252 são deixados para o driver decodificar/rejeitar.
 */
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
  // Delega à implementação única em shared/company/company-rule.js.
  return companyRule.resolveCompanyId({
    explicitCompanyId: payloadCompanyId === 1 || payloadCompanyId === 3 ? payloadCompanyId : null,
    clientCompanyId: clientCompanyId === 1 || clientCompanyId === 3 ? clientCompanyId : null,
    groupDescription: groupName,
  });
}

/**
 * Monta o array posicional para SP_CAD_ORDEM_VENDA_COMPLETO.
 * Índices 0..29 exatamente na ordem oficial da procedure. GERA_COBRANCA
 * SEMPRE fixado em 1 aqui — jamais lido do payload. CHAVE fixada em NULL.
 */
function buildCompleteProcParams(input) {
  const { payload, companyId } = input;
  const addr = payload.address;
  return [
    /*  0 ID_EMPRESA               */ companyId,
    /*  1 ID_CLIENTE               */ payload.customerId,
    /*  2 ID_VENDEDOR              */ payload.sellerId,
    /*  3 ID_TIPO_VENDA            */ payload.saleTypeId,
    /*  4 ID_PRAZO                 */ payload.paymentTermId,
    /*  5 ID_FORMA_PAGAMENTO       */ payload.paymentMethodId,
    /*  6 ENTREGAR                 */ payload.delivery ? 1 : 0,
    /*  7 DATA_PREV_ENTREGA        */ toDateOrNull(payload.expectedDeliveryAt),
    /*  8 DATA_ENTREGA             */ toDateOrNull(payload.deliveryAt),
    /*  9 BUSCAR_EQUIP             */ payload.retrieveEquipment ? 1 : 0,
    /* 10 DATA_RETORNO             */ toDateOrNull(payload.returnAt),
    /* 11 DATA_PREV_RETORNO        */ toDateOrNull(payload.expectedReturnAt),
    /* 12 VALOR                    */ payload.total,
    /* 13 VALOR_FRETE              */ payload.freight,
    /* 14 UF                       */ truncate(addr.state, LIMITS.UF),
    /* 15 CIDADE                   */ truncate(addr.city, LIMITS.CIDADE),
    /* 16 BAIRRO                   */ truncate(addr.district, LIMITS.BAIRRO),
    /* 17 RUA                      */ truncate(addr.street, LIMITS.RUA),
    /* 18 NUMERO                   */ truncate(addr.number, LIMITS.NUMERO),
    /* 19 COMP                     */ truncate(orNull(addr.complement), LIMITS.COMP),
    /* 20 CEP                      */ truncate(addr.postalCode, LIMITS.CEP),
    /* 21 OBS                      */ truncate(orNull(payload.notes), LIMITS.OBS),
    /* 22 GERA_COBRANCA (FIXO=1)   */ 1,
    /* 23 SAIDA_ESTOQUE (FIXO=0)   */ 0,
    /* 24 ID_USER (constante CAD_USER) */ CAD_USER,
    /* 25 CHAVE (NULL para criar)  */ null,
    /* 26 ID_TRANSPORTADOR         */ orNull(payload.carrierId),
    /* 27 ID_TRANSPORTADOR_VEICULO */ orNull(payload.carrierVehicleId),
    /* 28 PERCENT_DESC_COMERCIAL   */ payload.commercialDiscountPercent,
    /* 29 ID_PDV_SESSAO            */ orNull(payload.posSessionId),
  ];
}

/** SP_CAD_ITENS_ORDENS_VENDA — 6 IN posicionais; CHAVE='I' para inclusão. */
function buildItemProcParams(orderId, item) {
  return [
    /* 0 ID_ORDENS_VENDA */ orderId,
    /* 1 ID_PRODUTO      */ item.productId,
    /* 2 PRECO_UNIT      */ item.unitPrice,
    /* 3 QTDE_PEDIDA     */ item.quantity,
    /* 4 DESCONTO        */ item.discount || 0,
    /* 5 CHAVE           */ "I",
  ];
}

/** SP_CAD_EQUIP_ORDENS_VENDA — 5 IN posicionais; CHAVE='I' para inclusão. */
function buildEquipmentProcParams(orderId, eq) {
  return [
    /* 0 ID_ORDENS_VENDA     */ orderId,
    /* 1 ID_TIPO_EQUIPAMENTO */ eq.equipmentTypeId,
    /* 2 ID_PRODUTO          */ eq.productId === undefined ? null : eq.productId,
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