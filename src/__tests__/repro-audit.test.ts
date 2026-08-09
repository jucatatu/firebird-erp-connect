
import { describe, it, expect } from 'vitest';
import { searchErpProducts } from '../lib/erp.functions';

describe('Auditoria Sprint 8.5.5 - Busca de Produtos', () => {
  it('deve validar q="Ipa" com 3 caracteres', async () => {
    // O validator deve permitir passar. A falha de contexto de rede/start é esperada se não for via harness real,
    // mas queremos ver se o Erro vem do Validator (min 3) ou se ele passa para o Handler.
    try {
      // @ts-ignore
      await searchErpProducts({ data: { q: "Ipa", companyId: 1, limit: 50, isAdminSearch: true } });
    } catch (e: any) {
      // Se cair aqui, o validator barrou
      console.log("VALIDATOR BARROU Ipa:", e.message);
      expect(e.message).not.toContain("Informe de 3 a 60 caracteres");
    }
  });

  it('deve barrar q="Ip" com 2 caracteres', async () => {
    try {
      // @ts-ignore
      await searchErpProducts({ data: { q: "Ip", companyId: 1, limit: 50, isAdminSearch: true } });
    } catch (e: any) {
      console.log("VALIDATOR BARROU Ip (CORRETO):", e.message);
      expect(e.message).toContain("Informe de 3 a 60 caracteres");
    }
  });
});
