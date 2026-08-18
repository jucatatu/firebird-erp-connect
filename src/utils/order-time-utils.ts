/**
 * Helpers for civil time management in the order wizard.
 * All formats are strictly YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD.
 */

/**
 * Extracts HH:MM from a civil ISO string.
 * @param deliveryAt YYYY-MM-DDTHH:mm:ss
 */
export function getCivilTime(deliveryAt: string | null | undefined): string {
  if (!deliveryAt || !deliveryAt.includes("T")) return "";
  const timePart = deliveryAt.split("T")[1];
  return timePart.slice(0, 5); // HH:MM
}

/**
 * Normalizes user input into HH:MM format.
 * Supports: "1630" -> "16:30", "830" -> "08:30", "1:30" -> "01:30"
 */
export function normalizeTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  
  let hour = "";
  let minute = "";

  if (digits.length <= 2) {
    hour = digits.padStart(2, "0");
    minute = "00";
  } else if (digits.length === 3) {
    hour = digits.slice(0, 1).padStart(2, "0");
    minute = digits.slice(1);
  } else {
    // Take only first 4 digits
    const fourDigits = digits.slice(0, 4);
    hour = fourDigits.slice(0, 2);
    minute = fourDigits.slice(2);
  }

  return `${hour}:${minute}`;
}

/**
 * Validates if a string is a valid HH:MM time (00:00-23:59).
 */
export function isValidCivilTime(time: string): boolean {
  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) return false;
  return true;
}

/**
 * Merges a date (YYYY-MM-DD) and a time (HH:MM) into a civil ISO string.
 * If time is empty, returns only the date.
 */
export function mergeCivilDateTime(date: string, time: string): string {
  if (!date) return "";
  const cleanDate = date.includes("T") ? date.split("T")[0] : date;
  if (!time) return cleanDate;
  
  // Normalizes time if needed (should already be valid)
  if (!isValidCivilTime(time)) return cleanDate;
  
  return `${cleanDate}T${time}:00`;
}
