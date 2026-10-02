import { Ingredient, Product } from '../types';
import { formatRupiah } from './formatters';

export const STANDARD_UNITS = [
  'pcs',
  'pack',
  'dus',
  'box',
  'botol',
  'gelas',
  'karton',
  'sachet',
  'kg',
  'gram',
  'liter',
  'ml',
  'meter',
  'roll',
  'ikat',
  'bal',
  'pak',
];

/**
 * Gets the internal stock unit for an item (Ingredient or Product).
 */
export function getItemStockUnit(item: Partial<Ingredient & Product> | undefined | null): string {
  if (!item) return 'pcs';
  return item.stockUnit || item.unit || 'pcs';
}

/**
 * Gets the purchase unit for an item.
 */
export function getItemPurchaseUnit(item: Partial<Ingredient & Product> | undefined | null): string {
  if (!item) return 'pcs';
  return item.purchaseUnit || item.stockUnit || item.unit || 'pcs';
}

/**
 * Gets the conversion factor (how many stock units are in 1 purchase unit).
 */
export function getItemConversionFactor(item: Partial<Ingredient & Product> | undefined | null): number {
  if (!item) return 1;
  const factor = Number(item.conversionFactor);
  return isNaN(factor) || factor <= 0 ? 1 : factor;
}

/**
 * Calculates the cost per stock unit given purchase price per purchase unit and conversion factor.
 */
export function calculateCostPerStockUnit(purchasePrice: number, conversionFactor: number): number {
  const factor = conversionFactor > 0 ? conversionFactor : 1;
  return Math.round((purchasePrice / factor) * 100) / 100;
}

/**
 * Calculates stock quantity added in stock units given purchase quantity and conversion factor.
 */
export function calculateStockQuantityAdded(purchaseQty: number, conversionFactor: number): number {
  const factor = conversionFactor > 0 ? conversionFactor : 1;
  return purchaseQty * factor;
}

/**
 * Gets the cost per stock unit for an existing ingredient/product.
 */
export function getItemCostPerStockUnit(item: Partial<Ingredient & Product> | undefined | null): number {
  if (!item) return 0;
  if (item.costPerUnit !== undefined && item.costPerUnit !== null && item.costPerUnit >= 0) {
    return item.costPerUnit;
  }
  const purchasePrice = item.purchasePrice || 0;
  const factor = getItemConversionFactor(item);
  return calculateCostPerStockUnit(purchasePrice, factor);
}

/**
 * Helper to display approximate stock in purchase units (e.g. "80 pcs (≈ 0.8 pack)")
 */
export function formatStockWithConversion(
  stock: number,
  stockUnit: string,
  purchaseUnit: string,
  conversionFactor: number
): { primary: string; secondary?: string } {
  const primary = `${stock} ${stockUnit}`;
  if (conversionFactor > 1 && purchaseUnit && purchaseUnit.toLowerCase() !== stockUnit.toLowerCase()) {
    const purchaseEquivalent = Math.round((stock / conversionFactor) * 10) / 10;
    return {
      primary,
      secondary: `≈ ${purchaseEquivalent} ${purchaseUnit}`,
    };
  }
  return { primary };
}
