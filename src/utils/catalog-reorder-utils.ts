import { CatalogSetting, CatalogItemType } from "../lib/catalog/types";

/**
 * Moves an item within an array from one index to another.
 */
export function moveItem<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

/**
 * Checks if the order of IDs has changed between two lists.
 */
export function hasOrderChanged(original: string[], current: string[]): boolean {
  if (original.length !== current.length) return true;
  return original.some((id, index) => id !== current[index]);
}

/**
 * Flattens grouped products into a single list following the fixed category order:
 * CHOPP > GROWLER > GARRAFAS > OUTROS.
 */
export function flattenProductGroups(groups: {
  chopp: CatalogSetting[];
  growler: CatalogSetting[];
  garrafas: CatalogSetting[];
  outros: CatalogSetting[];
}): CatalogSetting[] {
  return [
    ...groups.chopp,
    ...groups.growler,
    ...groups.garrafas,
    ...groups.outros
  ];
}

/**
 * Calculates the next sort_order for a new item.
 * Rule: MAX(sort_order) + 10.
 */
export function calculateNextSortOrder(settings: CatalogSetting[]): number {
  if (settings.length === 0) return 10;
  const max = Math.max(...settings.map(s => s.sort_order || 0));
  return Math.max(max + 10, 10);
}
