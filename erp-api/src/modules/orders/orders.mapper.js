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

/**
 * Converte data operacional YYYY-MM-DD para objeto Date (meio-dia local)
 * para evitar que o fuso horário mude o dia durante a inserção no Firebird.
 */
/**
 * Converte data operacional YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss para objeto Date local.
 * Isso evita que o fuso horário do servidor altere o horário escolhido pelo usuário.
 */
function toDateCivil(v) {
  if (!v || typeof v !== "string") return toDateOrNull(v);
  
  // Se for formato YYYY-MM-DDTHH:mm:ss ou YYYY-MM-DDTHH:mm
  const isoDateTimeRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?.*$/;
  const match = v.match(isoDateTimeRegex);
  
  if (match) {
    const [_, year, month, day, hour, minute, second = "00"] = match;
    // Criamos usando componentes locais: new Date(year, monthIndex, day, hours, minutes, seconds)
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
  }

  // Se for formato YYYY-MM-DD somente
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [year, month, day] = v.split("-");
    // Regra mantida: sem horário explícito, assume 12:00 local
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      12, 0, 0
    );
  }
  
  return toDateOrNull(v);
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
function buildCompleteProcParams({ payload, companyId, clientContext, deliveryAddress, totals }) {
  // Regra de Endereço Sprint 8.9.43.2:
  // Agora o endereço vem resolvido pelo Service.
  // Fallback interno para compatibilidade controlada caso o parâmetro não venha.
  const addr = deliveryAddress || clientContext?.address || {};


  return [
    /*  0 ID_EMPRESA               */ companyId,
    /*  1 ID_CLIENTE               */ payload.clientId,
    /*  2 ID_VENDEDOR              */ payload.sellerId,
    /*  3 ID_TIPO_VENDA            */ payload.saleTypeId,
    /*  4 ID_PRAZO                 */ payload.paymentTermId,
    /*  5 ID_FORMA_PAGAMENTO       */ payload.paymentMethodId,
    /*  6 ENTREGAR                 */ payload.deliver ? 1 : null,
    /*  7 DATA_PREV_ENTREGA        */ toDateCivil(payload.deliveryAt),
    /*  8 DATA_ENTREGA             */ null,
    /*  9 BUSCAR_EQUIP             */ payload.returnEquipment ? 1 : 0,
    /* 10 DATA_RETORNO             */ null,
    /* 11 DATA_PREV_RETORNO        */ toDateCivil(payload.returnAt),

    /* 12 VALOR                    */ totals.total,
    /* 13 VALOR_FRETE              */ payload.freightValue,
    /* 14 UF                       */ truncate(addr.state, LIMITS.UF),
    /* 15 CIDADE                   */ truncate(addr.city, LIMITS.CIDADE),
    /* 16 BAIRRO                   */ truncate(addr.district, LIMITS.BAIRRO),
    /* 17 RUA                      */ truncate(addr.street, LIMITS.RUA),
    /* 18 NUMERO                   */ truncate(addr.number, LIMITS.NUMERO),
    /* 19 COMP                     */ truncate(orNull(addr.complement), LIMITS.COMP),
    /* 20 CEP                      */ truncate(addr.zip || addr.postalCode, LIMITS.CEP),
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
  toDateCivil,
  truncate,

  toDateOrNull,
};
