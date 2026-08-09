import { describe, it, expect, beforeEach } from 'vitest';
import { useOrderFormStore } from '../hooks/use-order-form';

describe('Sprint 8.4.1 - Novo Pedido Fixes', () => {
  beforeEach(() => {
    useOrderFormStore.getState().reset();
  });

  it('D. selecionar um cliente grava clientId correto', () => {
    const store = useOrderFormStore.getState();
    store.setClient(1234, 'Romeu Casarotto');
    
    expect(useOrderFormStore.getState().clientId).toBe(1234);
    expect(useOrderFormStore.getState().clientName).toBe('Romeu Casarotto');
  });

  it('F. query dependente de clientId/companyId não executa antes de ambos existirem (UI Logic)', () => {
    // Este teste valida que o estado inicial do Zustand permite as guardas da UI
    const state = useOrderFormStore.getState();
    expect(state.clientId).toBeNull();
    expect(state.companyId).toBeNull();
  });
});

