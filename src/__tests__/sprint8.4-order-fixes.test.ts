import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOrderFormStore } from '../hooks/use-order-form';

// Mock do localStorage para o persist do Zustand
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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
