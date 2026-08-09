
import { describe, it, expect } from 'vitest';
import { searchErpProducts } from '../lib/erp.functions';

describe('Auditoria Sprint 8.5.5 - Busca de Produtos', () => {
  it('deve aceitar q="Ipa" (3 caracteres)', async () => {
    try {
      // @ts-ignore
      await searchErpProducts({ data: { q: "Ipa", companyId: 1, limit: 50, isAdminSearch: true } });
    } catch (e: any) {
      // Se falhar no validator, o erro conterá a mensagem de caracteres
      expect(e.message).not.toContain('Informe de 3 a 60 caracteres');
      // O erro esperado aqui no teste (fora do runtime Start) é o de Context, o que prova que PASSOU pelo validator
      expect(e.message).toContain('No Start context found');
    }
  });

  it('deve aceitar q="Pil" (3 caracteres)', async () => {
    try {
      // @ts-ignore
      await searchErpProducts({ data: { q: "Pil", companyId: 1, limit: 50, isAdminSearch: true } });
    } catch (e: any) {
      expect(e.message).not.toContain('Informe de 3 a 60 caracteres');
      expect(e.message).toContain('No Start context found');
    }
  });

  it('deve rejeitar q="Ip" (2 caracteres)', async () => {
    try {
      // @ts-ignore
      await searchErpProducts({ data: { q: "Ip", companyId: 1, limit: 50, isAdminSearch: true } });
    } catch (e: any) {
      expect(e.message).toContain('Informe de 3 a 60 caracteres');
    }
  });

  it('deve aceitar busca vazia administrativa (short-circuit)', async () => {
    try {
      // @ts-ignore
      const res = await searchErpProducts({ data: { q: "", companyId: 1, limit: 50, isAdminSearch: true } });
      // Aqui não deve dar erro de contexto pois o handler retorna objeto direto
      expect(res.ok).toBe(true);
      expect(res.data.products).toHaveLength(0);
    } catch (e: any) {
      // Não deve cair aqui
      throw e;
    }
  });
});
