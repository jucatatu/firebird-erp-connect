/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useOrderFormStore } from '../hooks/use-order-form';

describe('Sprint 8.4 - Novo Pedido Fixes', () => {
  beforeEach(() => {
    useOrderFormStore.getState().reset();
  });

  it('D. selecionar um cliente grava clientId correto', () => {
    const store = useOrderFormStore.getState();
    store.setClient(1234, 'Romeu Casarotto');
    
    expect(useOrderFormStore.getState().clientId).toBe(1234);
    expect(useOrderFormStore.getState().clientName).toBe('Romeu Casarotto');
  });

  it('Selecionar empresa grava companyId correto', () => {
    const store = useOrderFormStore.getState();
    store.setCompany(3);
    expect(useOrderFormStore.getState().companyId).toBe(3);
  });
});
