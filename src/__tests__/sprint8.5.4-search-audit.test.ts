import { describe, it, expect } from 'vitest';
import { foldToLikePattern, exactLikePattern } from '../../erp-api/src/modules/clients/clients.mapper';

describe('Sprint 8.5.4 - Auditoria de Busca de Clientes', () => {
  it('deve gerar padrões LIKE razoáveis para Romeu', () => {
    const term = 'Romeu';
    const exact = exactLikePattern(term);
    const folded = foldToLikePattern(term);
    
    expect(exact).toBe('%ROMEU%');
    // R O M E U -> _ O M _ _ (se E e U estiverem em ACCENT_CLASSES)
    // O sistema usa ACCENT_CLASSES = "AEIOUCN"
    // R -> R
    // O -> _
    // M -> M
    // E -> _
    // U -> _
    expect(folded).toBe('%R_M__%');
  });

  it('deve rejeitar registros que não batem com o padrão folded', () => {
    const pattern = foldToLikePattern('Romeu'); // %R_M__%
    const regex = new RegExp('^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
    
    expect(regex.test('ROMEU EFFTING')).toBe(true);
    expect(regex.test('ROMEU')).toBe(true);
    
    // "CLEBER MAURICIO" -> Não começa com R ou não tem M na posição certa
    expect(regex.test('CLEBER MAURICIO')).toBe(false);
    expect(regex.test('EDIMAR MIRANDA')).toBe(false);
  });

  it('deve ser mais rigoroso com termos curtos para evitar falsos positivos', () => {
    // Se mudamos a regra para termos < 3, testamos aqui
    const term = 'Jo';
    const folded = foldToLikePattern(term);
    expect(folded).toBe('%JO%'); // Sem folding para termos curtos
  });
});
