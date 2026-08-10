
import { test, expect, describe, beforeAll } from 'vitest';
import { toDateCivil, buildCompleteProcParams } from '../../erp-api/src/modules/orders/orders.mapper';

describe('Sprint 8.9.28: Data Civil e Status Inicial 27', () => {
  
  test('toDateCivil deve preservar o dia exato para YYYY-MM-DD', () => {
    const input = '2026-08-10';
    const date = toDateCivil(input);
    
    // O dia deve ser 10, independente do timezone da máquina que roda o teste
    expect(date.getDate()).toBe(10);
    expect(date.getMonth()).toBe(7); // Agosto = 7
    expect(date.getFullYear()).toBe(2026);
  });

  test('buildCompleteProcParams deve usar toDateCivil para deliveryAt', () => {
    const payload = {
      clientId: 1,
      sellerId: 1,
      saleTypeId: 1,
      paymentTermId: 1,
      paymentMethodId: 1,
      deliver: true,
      deliveryAt: '2026-08-10',
      returnEquipment: false,
      returnAt: null,
      freightValue: 0,
      notes: 'Teste'
    };
    
    const params = buildCompleteProcParams({
      payload,
      companyId: 1,
      clientContext: {},
      totals: { total: 100 }
    });
    
    const deliveryDate = params[7];
    expect(deliveryDate instanceof Date).toBe(true);
    expect(deliveryDate.getDate()).toBe(10);
  });
});
