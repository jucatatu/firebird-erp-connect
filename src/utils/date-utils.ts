/**
 * Utilitários para tratamento de datas operacionais (date-only)
 * sem conversão para UTC, evitando bugs de timezone.
 */

/**
 * Formata uma data operacional YYYY-MM-DD para DD/MM/YYYY.
 * @param dateStr String no formato YYYY-MM-DD ou ISO8601
 * @returns String formatada ou "-" se inválida
 */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  
  // Se for uma string ISO com T, pega apenas a parte da data
  const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  
  // Validação básica YYYY-MM-DD
  const parts = cleanDate.split("-");
  if (parts.length !== 3) return cleanDate; // Fallback se não for o formato esperado
  
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Adiciona dias a uma data operacional preservando o formato date-only.
 * @param dateStr Data base YYYY-MM-DD
 * @param days Dias a adicionar
 * @returns Nova data YYYY-MM-DD
 */
export function addDaysToDateOnly(dateStr: string, days: number): string {
  if (!dateStr) return "";
  
  // Forçamos o meio do dia para evitar problemas de arredondamento em trocas de horário de verão
  const date = new Date(dateStr + "T12:00:00");
  date.setDate(date.getDate() + days);
  
  return date.toISOString().split("T")[0];
}
