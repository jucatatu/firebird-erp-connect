import { describe, it, expect } from 'vitest';
import { foldToLikePattern, exactLikePattern } from '../../erp-api/src/modules/clients/clients.mapper';

describe('Sprint 8.5.4 - Auditoria de Busca de Clientes', () => {
  it('deve gerar padrões LIKE para Romeu', () => {
    const term = 'Romeu';
    expect(exactLikePattern(term)).toBe('%ROMEU%');
    expect(foldToLikePattern(term)).toBe('%R_M__%');
  });

  it('deve validar o risco de falsos positivos com Regex simplificada', () => {
    const pattern = '%R_M__%';
    // Em SQL, %R_M__% casa com "CLEBER MAURICIO" se contiver "R" seguido de "M" e dois chars?
    // Não, "CLEBER MAURICIO" contém R e M, mas o LIKE %R_M__% exige que existam
    // exatamente dois caracteres APÓS o M no final do match (ou no meio).
    
    const sqlLikeToRegex = (p: string) => new RegExp(p.replace(/%/g, '.*').replace(/_/g, '.'), 'i');
    const regex = sqlLikeToRegex(pattern);
    
    expect(regex.test('ROMEU EFFTING')).toBe(true);
    expect(regex.test('ROMEU')).toBe(true);
    
    // "EDIMAR MIRANDA" -> tem "R", depois "M", depois "IR"... casa!
    // E-D-I-M-A-R M-I-R-A-N-D-A
    //       ^ R
    //         ^ M
    //           ^ I (coringa 1)
    //             ^ R (coringa 2)
    // ISSO É O FALSO POSITIVO!
    console.log('EDIMAR MIRANDA casa com %R_M__%?', regex.test('EDIMAR MIRANDA'));
  });
});
