"use strict";

const { z } = require("zod");

const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : v.toLowerCase() === "true"));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3052),

    FIREBIRD_HOST: z.string().min(1, "FIREBIRD_HOST é obrigatório"),
    FIREBIRD_PORT: z.coerce.number().int().positive().default(3050),
    FIREBIRD_DATABASE: z.string().min(1, "FIREBIRD_DATABASE é obrigatório"),
    FIREBIRD_USER: z.string().min(1, "FIREBIRD_USER é obrigatório"),
    FIREBIRD_PASSWORD: z.string().min(1, "FIREBIRD_PASSWORD é obrigatório"),
    FIREBIRD_ROLE: z.string().optional().default(""),
    FIREBIRD_PAGE_SIZE: z.coerce.number().int().positive().default(4096),
    FIREBIRD_CHARSET: z.string().min(1).default("WIN1252"),

    API_KEY: z.string().default(""),
    HMAC_SECRET: z.string().default(""),

    CORS_ORIGINS: z.string().default(""),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    DEV_BYPASS_AUTH: boolFromString.default(false),
  })
  .superRefine((val, ctx) => {
    // Bloqueia credenciais padrão inseguras
    const forbiddenUsers = ["sysdba"];
    const forbiddenPasswords = ["masterkey", "masterke"];
    if (forbiddenUsers.includes(val.FIREBIRD_USER.toLowerCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FIREBIRD_USER não pode ser SYSDBA (credencial padrão insegura).",
        path: ["FIREBIRD_USER"],
      });
    }
    if (forbiddenPasswords.includes(val.FIREBIRD_PASSWORD.toLowerCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FIREBIRD_PASSWORD não pode ser 'masterkey' (credencial padrão insegura).",
        path: ["FIREBIRD_PASSWORD"],
      });
    }

    if (val.NODE_ENV === "production") {
      if (!val.API_KEY || val.API_KEY.length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "API_KEY é obrigatória em produção (mínimo 16 caracteres).",
          path: ["API_KEY"],
        });
      }
      if (!val.HMAC_SECRET || val.HMAC_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "HMAC_SECRET é obrigatório em produção (mínimo 32 caracteres).",
          path: ["HMAC_SECRET"],
        });
      }
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Configuração de ambiente inválida:");
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = Object.freeze({
  ...parsed.data,
  // Em produção o bypass é sempre desabilitado, independente do .env
  DEV_BYPASS_AUTH: parsed.data.NODE_ENV === "production" ? false : parsed.data.DEV_BYPASS_AUTH,
  CORS_ORIGINS_LIST: parsed.data.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
});

module.exports = { env };