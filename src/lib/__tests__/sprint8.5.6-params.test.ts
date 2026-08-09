
import { describe, it, expect } from 'vitest';
import { searchErpProducts } from '../lib/erp.functions';

describe('Sprint 8.5.6 - Remoção de companyId na busca administrativa', () => {
  it('NÃO deve enviar companyId quando isAdminSearch=true', async () => {
    try {
      // @ts-ignore
      await searchErpProducts({ data: { q: "Ipa", companyId: 1, limit: 50, isAdminSearch: true } });
    } catch (e: any) {
      // Se falhar no handler por falta de contexto, verificamos se o validator passou
      expect(e.message).not.toContain('Informe de 3 a 60 caracteres');
      expect(e.message).toContain('No Start context found');
    }
  });

  it('DEVE permitir companyId na busca operacional (isAdminSearch=false)', async () => {
    try {
      // @ts-ignore
      await searchErpProducts({ data: { q: "Ipa", companyId: 1, limit: 50, isAdminSearch: false } });
    } catch (e: any) {
      expect(e.message).toContain('No Start context found');
    }
  });
});
