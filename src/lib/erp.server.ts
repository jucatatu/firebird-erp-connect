// Server-only ERP client. Assina HMAC e chama a API Node.
// Nunca importe este arquivo do bundle do browser — o próprio nome .server
// impede o bundler de client de puxá-lo.
import crypto from "node:crypto";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

function buildSignature(params: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  bodyHash: string;
  secret: string;
}): string {
  const canonical = [
    params.method.toUpperCase(),
    params.path,
    params.timestamp,
    params.nonce,
    params.bodyHash,
  ].join("\n");
  return crypto
    .createHmac("sha256", params.secret)
    .update(canonical)
    .digest("hex");
}

export interface ErpCallOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path relativo à API. Ex.: "/api/v1/operations/orders" */
  path: string;
  /** Objeto de query string opcional. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Corpo JSON opcional (para POST/PUT/PATCH). */
  body?: JsonValue;
  /** Timeout em ms (default 15000). */
  timeoutMs?: number;
}

export interface ErpResponse<T extends JsonValue = JsonValue> {
  ok: boolean;
  status: number;
  data: T | null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: JsonValue;
  } | null;
}

function buildQueryString(
  query?: ErpCallOptions["query"],
): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/**
 * Chama a API ERP Node assinando cada requisição com HMAC-SHA256.
 * Roda apenas no servidor (dentro de createServerFn ou server route).
 */
export async function callErp<T extends JsonValue = JsonValue>(
  opts: ErpCallOptions,
): Promise<ErpResponse<T>> {
  const method = (opts.method ?? "GET").toUpperCase();
  const baseUrl = requiredEnv("ERP_API_URL").replace(/\/+$/, "");
  const apiKey = requiredEnv("ERP_API_KEY");
  const secret = requiredEnv("ERP_HMAC_SECRET");

  const pathWithQuery = `${opts.path}${buildQueryString(opts.query)}`;
  const rawBody =
    method === "GET" || method === "HEAD" || opts.body === undefined
      ? ""
      : JSON.stringify(opts.body);
  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = buildSignature({
    method,
    path: pathWithQuery,
    timestamp,
    nonce,
    bodyHash,
    secret,
  });

  const url = `${baseUrl}${pathWithQuery}`;
  const timeoutMs = opts.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log("[ERP] ANTES DO FETCH");
    console.log("[ERP] URL", url);
    console.log("[ERP] METHOD", method);
    console.log("[ERP] HEADERS", {
      "x-api-key": apiKey ? `${apiKey.slice(0, 6)}…(${apiKey.length})` : "MISSING",
      "x-timestamp": timestamp,
      "x-nonce": nonce,
      "x-signature": signature ? `${signature.slice(0, 12)}…(${signature.length})` : "MISSING",
    });
    console.log("[ERP] CANONICAL", JSON.stringify({
      method, path: pathWithQuery, timestamp, nonce, bodyHash,
    }));
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "x-timestamp": timestamp,
        "x-nonce": nonce,
        "x-signature": signature,
      },
      body: method === "GET" || method === "HEAD" ? undefined : rawBody,
      signal: controller.signal,
    });

    const text = await res.text();
    console.log("[ERP] STATUS", res.status);
    console.log("[ERP] RES-HEADERS", Object.fromEntries(res.headers.entries()));
    console.log("[ERP] BODY-PREVIEW", text.slice(0, 500));
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (res.ok && parsed && parsed.success === true) {
      return { ok: true, status: res.status, data: parsed.data as T, error: null };
    }

    return {
      ok: false,
      status: res.status,
      data: null,
      error: {
        code: parsed?.error?.code ?? `HTTP_${res.status}`,
        message:
          parsed?.error?.message ?? `Falha ao chamar ERP (${res.status})`,
        retryable: Boolean(parsed?.error?.retryable) || res.status >= 500,
        details: parsed?.error?.details,
      },
    };
  } catch (err) {
    console.log("[ERP] EXCEPTION");
    console.log((err as Error)?.message);
    console.log((err as Error)?.stack);
    console.log("[ERP] CAUSE", (err as { cause?: unknown })?.cause);
    const aborted = (err as { name?: string }).name === "AbortError";
    return {
      ok: false,
      status: 0,
      data: null,
      error: {
        code: aborted ? "ERP_TIMEOUT" : "ERP_NETWORK_ERROR",
        message: aborted
          ? "Tempo de resposta do ERP excedido."
          : "Não foi possível contactar o ERP.",
          retryable: true,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}