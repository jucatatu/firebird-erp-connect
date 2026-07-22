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

    // ── Idempotência (Fase 2G) ───────────────────────────────────────────
    // "memory"  → armazenamento em memória do processo (NÃO usar em produção)
    // "file"    → arquivo JSON local com escrita atômica (PM2/single-node)
    IDEMPOTENCY_STORE: z.enum(["memory", "file"]).default("memory"),
    IDEMPOTENCY_FILE_PATH: z.string().default("./data/idempotency.json"),
    IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().positive().default(24),

    // ── Geocoding (Fase 3C) ──────────────────────────────────────────────
    // Provider real de geocodificação. "fake" é usado nos testes e no boot
    // padrão — nenhuma chamada externa é feita sem trocar explicitamente
    // para "google".
    GEOCODING_PROVIDER: z.enum(["fake", "google"]).default("fake"),
    // Chave da Google Geocoding API. Só é usada quando o provider é "google";
    // fora disso pode ficar vazia. Nunca é logada.
    GOOGLE_GEOCODING_API_KEY: z.string().default(""),
    // Limite absoluto de endereços resolvidos por chamada ao POST /map/geocode
    // (defesa em profundidade contra custo externo descontrolado).
    GEOCODING_MAX_PER_REQUEST: z.coerce.number().int().positive().max(200).default(25),
    // Timeout global da rodada de resolução (ms). Endereços que não completarem
    // dentro dessa janela permanecem "pending" e podem ser reprocessados.
    GEOCODING_GLOBAL_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
    // Timeout por chamada individual ao provider.
    GEOCODING_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
    // Persistência de coordenadas (latitude/longitude). A política oficial da
    // Geocoding API restringe armazenamento; apenas place_id é explicitamente
    // permitido de forma indefinida. Enquanto essa validação contratual não
    // for concluída, coordenadas ficam APENAS em memória do processo. Este
    // flag existe para habilitar persistência quando/se autorizado; hoje o
    // cache é in-memory e o valor é informativo.
    GEOCODING_PERSIST_COORDS: boolFromString.default(false),
    // TTL do claim de in-flight (evita locks órfãos se um processo cair).
    GEOCODING_INFLIGHT_TTL_MS: z.coerce.number().int().positive().default(60000),
  })
  .superRefine((val, ctx) => {
    // Nota: SYSDBA/masterkey NÃO são bloqueados aqui — o administrador pode
    // legitimamente precisar usar SYSDBA em ambientes internos. Um aviso de
    // segurança é emitido no boot (ver server.js) quando SYSDBA é usado.
    // Nunca comparamos a senha com valores específicos, e a senha nunca é logada.
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