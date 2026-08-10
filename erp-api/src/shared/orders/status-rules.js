"use strict";

const EDITABLE_ERP_ORDER_STATUSES = [1, 20, 24, 27];

function canEditErpOrder(statusId) {
  const id = Number(statusId);
  return EDITABLE_ERP_ORDER_STATUSES.includes(id);
}

module.exports = {
  EDITABLE_ERP_ORDER_STATUSES,
  canEditErpOrder
};
