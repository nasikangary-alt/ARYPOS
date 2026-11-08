import { Recipe, Ingredient, Product, Assembly } from '../types';

export function formatNumber(value: number | string | undefined | null, maxDecimals = 2): string {
  if (value === undefined || value === null || value === '') return '0';
  const num = Number(value);
  if (isNaN(num)) return '0';

  // Round to maxDecimals to avoid IEEE floating-point precision artifacts (e.g. 599.9058 -> 599.91)
  const rounded = Number(num.toFixed(maxDecimals));
  const parts = rounded.toString().split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (parts.length > 1 && parts[1]) {
    return `${integerPart},${parts[1]}`;
  }
  return integerPart;
}

export function formatRupiah(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return 'Rp 0';
  const num = Math.round(Number(amount));
  if (isNaN(num)) return 'Rp 0';
  const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
}

export function formatDateIndonesian(dateStringOrObject: string | Date): string {
  const d = new Date(dateStringOrObject);
  if (isNaN(d.getTime())) return '-';
  
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export const formatDate = formatDateIndonesian;

export function formatDateTimeIndonesian(dateStringOrObject: string | Date): string {
  const d = new Date(dateStringOrObject);
  if (isNaN(d.getTime())) return '-';

  const dateFormatted = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${dateFormatted} ${hours}:${minutes}`;
}

export function generateTransactionNo(sequenceNumber: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const seqStr = String(sequenceNumber).padStart(3, '0');

  return `TRX-${year}${month}${day}-${seqStr}`;
}

export function getStockStatusInfo(stock: number, minimumStock = 20, criticalStock = 10): {
  status: 'AMAN' | 'MENIPIS' | 'KRITIS' | 'HABIS';
  badgeClass: string;
  colorClass: string;
} {
  if (stock <= 0) {
    return {
      status: 'HABIS',
      badgeClass: 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border-red-200 dark:border-red-800',
      colorClass: 'text-red-600 dark:text-red-400',
    };
  }
  if (stock < criticalStock) {
    return {
      status: 'KRITIS',
      badgeClass: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-200 dark:border-red-900',
      colorClass: 'text-red-500 dark:text-red-400',
    };
  }
  if (stock <= minimumStock) {
    return {
      status: 'MENIPIS',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      colorClass: 'text-amber-600 dark:text-amber-400',
    };
  }
  return {
    status: 'AMAN',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
  };
}

export function calculateHPP(
  recipe: Recipe | undefined,
  ingredientsMap: Map<string, Ingredient>
): number {
  if (!recipe) return 0;

  if (recipe.recipeMode === 'BATCH') {
    const yieldQty = Math.max(1, recipe.yieldQty || 1);
    let batchTotal = 0;
    if (recipe.batchItems && recipe.batchItems.length > 0) {
      for (const item of recipe.batchItems) {
        const ing = ingredientsMap.get(item.ingredientId);
        const cost = ing && typeof ing.costPerUnit === 'number' ? ing.costPerUnit : (item.costPerUnit || 0);
        batchTotal += cost * item.quantity;
      }
    }
    const batchPerPortion = batchTotal / yieldQty;

    let portionTotal = 0;
    if (recipe.portionItems && recipe.portionItems.length > 0) {
      for (const item of recipe.portionItems) {
        const ing = ingredientsMap.get(item.ingredientId);
        const cost = ing && typeof ing.costPerUnit === 'number' ? ing.costPerUnit : (item.costPerUnit || 0);
        portionTotal += cost * item.quantity;
      }
    }

    const overhead = recipe.overheadCostPerUnit || 0;
    return Math.round(batchPerPortion + portionTotal + overhead);
  } else {
    let total = 0;
    const items = recipe.portionItems && recipe.portionItems.length > 0 ? recipe.portionItems : (recipe.items || []);
    if (items.length > 0) {
      for (const item of items) {
        const ing = ingredientsMap.get(item.ingredientId);
        const cost = ing && typeof ing.costPerUnit === 'number' ? ing.costPerUnit : (item.costPerUnit || 0);
        total += cost * item.quantity;
      }
    }
    if (recipe.overheadCostPerUnit) {
      total += recipe.overheadCostPerUnit;
    }
    return Math.round(total || recipe.totalHpp || 0);
  }
}

export function getProductRecipeHpp(
  productId: string,
  productsMap: Map<string, Product>,
  recipesMap: Map<string, Recipe>,
  ingredientsMap: Map<string, Ingredient>
): number {
  const prod = productsMap.get(productId);
  if (!prod) return 0;

  // 1. Look for recipe in recipesMap by prod.id or prod.recipeId
  const recipe = recipesMap.get(prod.id) || (prod.recipeId ? recipesMap.get(prod.recipeId) : undefined);
  if (recipe) {
    const calcHpp = calculateHPP(recipe, ingredientsMap);
    if (calcHpp > 0) return calcHpp;
    if (recipe.totalHpp && recipe.totalHpp > 0) return recipe.totalHpp;
  }

  // 2. Fallback to prod.costPerUnit
  return prod.costPerUnit || 0;
}

// Helper to calculate HPP of a Menu POS based on its components (Komposisi Menu)
export function getMenuHpp(
  product: Product | undefined,
  productsMap: Map<string, Product>,
  ingredientsMap: Map<string, Ingredient>,
  assembliesMap?: Map<string, Assembly>,
  recipesMap?: Map<string, Recipe>,
  visited: Set<string> = new Set()
): number {
  if (!product || visited.has(product.id)) return 0;
  const nextVisited = new Set(visited);
  nextVisited.add(product.id);

  // 1. Menu POS with Komposisi Menu (assembliesMap / compositionItems) checked FIRST
  const asmComp =
    assembliesMap?.get(product.id)?.components ||
    (product.assemblyId ? assembliesMap?.get(product.assemblyId)?.components : undefined) ||
    (product.compositionId ? assembliesMap?.get(product.compositionId)?.components : undefined);

  const compItems =
    asmComp && asmComp.length > 0
      ? asmComp
      : product.compositionItems && product.compositionItems.length > 0
      ? product.compositionItems
      : undefined;

  if (compItems && compItems.length > 0) {
    let total = 0;
    for (const comp of compItems) {
      const qty = comp.quantity || 1;
      if (comp.sourceType === 'PRODUCT') {
        const compProd = productsMap.get(comp.sourceId);
        if (compProd) {
          const nestedComp =
            assembliesMap?.get(compProd.id)?.components || compProd.compositionItems;
          if (nestedComp && nestedComp.length > 0) {
            total +=
              getMenuHpp(compProd, productsMap, ingredientsMap, assembliesMap, recipesMap, nextVisited) *
              qty;
          } else {
            const compHpp = getProductRecipeHpp(
              compProd.id,
              productsMap,
              recipesMap || new Map(),
              ingredientsMap
            );
            total += (compHpp || compProd.costPerUnit || 0) * qty;
          }
        } else {
          total += (comp.costPerUnit || 0) * qty;
        }
      } else {
        const compIng = ingredientsMap.get(comp.sourceId);
        const ingCost =
          compIng && typeof compIng.costPerUnit === 'number'
            ? compIng.costPerUnit
            : comp.costPerUnit || 0;
        total += ingCost * qty;
      }
    }
    return Math.round(total);
  }

  // 2. Menu Paket fallback: sum of component Menu POS items if no compositionItems exist
  if (product.productType === 'PACKAGE' && product.packageItems && product.packageItems.length > 0) {
    let total = 0;
    for (const item of product.packageItems) {
      const compProd = productsMap.get(item.productId);
      if (compProd) {
        total +=
          getMenuHpp(compProd, productsMap, ingredientsMap, assembliesMap, recipesMap, nextVisited) *
          (item.quantity || 1);
      }
    }
    return Math.round(total);
  }

  // 3. Physical / Retail / Production product fallback
  const recHpp = getProductRecipeHpp(product.id, productsMap, recipesMap || new Map(), ingredientsMap);
  return Math.round(recHpp || product.costPerUnit || 0);
}

export function formatNumberInput(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '' || value === 0) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseNumberInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
