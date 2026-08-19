
export interface SupabaseErrorDetails {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
}

export function formatSupabaseError(error: any): string {
  if (!error) return "Erro desconhecido.";

  const code = error.code || (error as any).status || "";
  const message = error.message || "Erro de servidor.";
  const details = error.details || "";
  const hint = error.hint || "";

  // Códigos de roundtrip internos
  if (message === "catalog_reorder_conflict") {
    let msg = "Conflito ao salvar a ordem. O catálogo mudou desde a última leitura.\nCódigo: catalog_reorder_conflict";
    if (details) msg += `\nDetalhe: ${details}`;
    if (hint) msg += `\nHint: ${hint}`;
    return msg;
  }
  if (message === "catalog_reorder_snapshot_conflict") {
    return "O catálogo mudou enquanto você estava ordenando. Atualize a lista e tente novamente.\nCódigo: catalog_reorder_snapshot_conflict";
  }
  if (message === "catalog_reorder_persistence_mismatch") {
    return "Falha na persistência: a ordem salva diverge da solicitada.\nCódigo: catalog_reorder_persistence_mismatch";
  }
  if (message === "catalog_reorder_roundtrip_mismatch") {
    return "Erro de sincronização: a ordem no banco não condiz com a solicitada.\nCódigo: catalog_reorder_roundtrip_mismatch";
  }
  if (message === "catalog_setting_persistence_mismatch") {
    return "Falha na verificação: os dados salvos divergem do solicitado.\nCódigo: catalog_setting_persistence_mismatch";
  }

  let formatted = "";
  if (code) {
    formatted += `[${code}] `;
  }
  formatted += message;

  if (details && details !== message) {
    formatted += `\nDetalhe: ${details}`;
  }
  if (hint) {
    formatted += `\nHint: ${hint}`;
  }

  return formatted;
}
