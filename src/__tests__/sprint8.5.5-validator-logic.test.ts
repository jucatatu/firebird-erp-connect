
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mock simples do validador para testar a lógica pura
const validator = (input: any) => {
  const q = typeof input?.q === "string" ? input.q.trim() : "";
  if (q !== "" && (q.length < 3 || q.length > 60)) {
    throw new Error(`Busca "${q}" inválida. Informe de 3 a 60 caracteres.`);
  }
  return { q };
};

describe('Lógica do Validator de busca de produtos', () => {
  it('deve aceitar "Ipa" (length 3)', () => {
    const res = validator({ q: "Ipa" });
    expect(res.q).toBe("Ipa");
    expect(res.q.length).toBe(3);
  });

  it('deve aceitar "Pil" (length 3)', () => {
    const res = validator({ q: "Pil" });
    expect(res.q).toBe("Pil");
  });

  it('deve rejeitar "Ip" (length 2)', () => {
    expect(() => validator({ q: "Ip" })).toThrow("Informe de 3 a 60 caracteres");
  });

  it('deve aceitar vazio ""', () => {
    const res = validator({ q: "" });
    expect(res.q).toBe("");
  });
});
