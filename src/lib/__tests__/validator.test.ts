import { describe, it, expect } from 'vitest';

const validator = (input: any) => {
  const q = typeof input?.q === "string" ? input.q.trim() : "";
  if (q !== "" && (q.length < 3 || q.length > 60)) {
    throw new Error("Busca inválida. Informe de 3 a 60 caracteres.");
  }
  return { q };
};

describe('Validator Logic', () => {
  it('should pass Ipa', () => {
    expect(validator({ q: "Ipa" }).q).toBe("Ipa");
  });
  it('should fail Ip', () => {
    expect(() => validator({ q: "Ip" })).toThrow();
  });
});
