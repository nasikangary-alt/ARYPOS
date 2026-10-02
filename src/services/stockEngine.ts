import { writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { sanitizeFirestore } from '../utils/sanitizeFirestore';
import {
  Ingredient,
  Product,
  Recipe,
  Sale,
  StockMovement,
  StockProduction,
  Production,
  ProductionItem,
  OverheadItem,
  Assembly,
  AssemblyItem,
} from '../types';

/**
 * Determines whether a product is a kitchen production output ("Produk Hasil Produksi", e.g., Ayam Crispy, Sambal, Nasi, Teh Manis Mentah).
 * Production outputs have physical stock from Produksi Dapur and are NOT target Menu POS items unless explicitly sold as ready-to-sell without production.
 */
export function isProductionOutputProduct(
  product: Product | undefined,
  recipes?: Recipe[]
): boolean {
  if (!product) return false;
  const cat = (product.category || '').trim().toUpperCase();
  if (cat === 'PRODUK STOK') return true;
  if (product.stockSource === 'PRODUCTION') return true;
  if (product.isProduction === true) return true;
  if (Boolean(product.recipeId && product.recipeId.trim() !== '')) return true;
  if (recipes && recipes.some((r) => r.productId === product.id)) return true;
  return false;
}

/**
 * Determines whether a product is a raw material / packaging item stored in products.
 */
export function isRawOrPackagingProduct(product: Product | undefined): boolean {
  if (!product) return false;
  const cat = (product.category || '').trim().toUpperCase();
  return (
    cat === 'BAHAN BAKU' ||
    cat === 'KEMASAN' ||
    cat === 'PACKAGING' ||
    cat === 'RAW_MATERIAL'
  );
}

/**
 * Determines whether a product is a target Menu POS item (sold at POS & configured in Komposisi Menu POS).
 * Excludes Produk Hasil Produksi (Ayam Crispy, Sambal, Nasi, Teh Manis Mentah, etc.) and Bahan/Kemasan.
 */
export function isPosMenuProduct(
  product: Product | undefined,
  recipes?: Recipe[],
  assemblies?: Assembly[]
): boolean {
  if (!product) return false;
  if (isProductionOutputProduct(product, recipes)) return false;
  if (isRawOrPackagingProduct(product)) return false;

  if (product.stockSource === 'COMPOSITION' || product.stockSource === 'ASSEMBLY') {
    return true;
  }
  if (product.productType === 'PACKAGE') {
    return true;
  }
  if (
    Boolean(
      product.compositionId ||
        product.assemblyId ||
        (product.compositionItems && product.compositionItems.length > 0) ||
        (product.packageItems && product.packageItems.length > 0)
    )
  ) {
    return true;
  }
  if (
    assemblies &&
    assemblies.some((a) => a.productId === product.id || a.targetProductId === product.id)
  ) {
    return true;
  }
  if (product.stockTracked === false) {
    return true;
  }
  if (product.stockSource === 'READY_TO_SELL') {
    return true;
  }
  return false;
}

const LEGACY_PRODUCT_ID_ALIASES: Record<string, string[]> = {
  p1: ['prod_ayam_crispy', 'ayam crispy', 'ayam goreng crispy'],
  p2: ['prod_sambal', 'sambal', 'sambal bawang'],
  p3: ['prod_nasi', 'nasi', 'nasi putih'],
  p4: ['prod_teh_manis', 'prod_menu_teh_manis', 'teh manis', 'teh manis mentah', 'es teh manis'],
  p5: ['prod_tahu', 'tahu crispy'],
  p6: ['prod_tempe', 'tempe crispy'],
};

/**
 * Resolves a product reference from productsMap by exact ID, legacy alias, SKU, or normalized name.
 */
export function resolveProductReference(
  sourceId: string | undefined,
  sourceName: string | undefined,
  productsMap?: Map<string, Product>
): Product | undefined {
  if (!productsMap) return undefined;
  if (sourceId && productsMap.has(sourceId)) {
    return productsMap.get(sourceId);
  }

  const allProducts = Array.from(productsMap.values());
  const normId = (sourceId || '').trim().toLowerCase();
  const normName = (sourceName || '').trim().toLowerCase();

  // Check legacy alias mapping first
  const aliasCandidates = LEGACY_PRODUCT_ID_ALIASES[normId] || [];
  for (const candidate of aliasCandidates) {
    if (productsMap.has(candidate)) {
      return productsMap.get(candidate);
    }
    const byName = allProducts.find((p) => p.name.trim().toLowerCase() === candidate.toLowerCase());
    if (byName) return byName;
  }

  // Match by exact case-insensitive ID or SKU
  if (normId) {
    const byIdOrSku = allProducts.find(
      (p) =>
        p.id.trim().toLowerCase() === normId ||
        (p.sku && p.sku.trim().toLowerCase() === normId)
    );
    if (byIdOrSku) return byIdOrSku;
  }

  // Match by exact case-insensitive name
  if (normName) {
    const byExactName = allProducts.find((p) => p.name.trim().toLowerCase() === normName);
    if (byExactName) return byExactName;

    // Common legacy name normalization
    if (normName.includes('ayam') && normName.includes('crispy')) {
      const found = productsMap.get('prod_ayam_crispy') || allProducts.find((p) => p.name.toLowerCase().includes('ayam crispy'));
      if (found) return found;
    }
    if (normName.includes('ayam') && normName.includes('geprek')) {
      const found = productsMap.get('prod_ayam_geprek') || allProducts.find((p) => p.name.toLowerCase().includes('ayam geprek'));
      if (found) return found;
    }
    if (normName.includes('sambal')) {
      const found = productsMap.get('prod_sambal') || allProducts.find((p) => p.name.toLowerCase().includes('sambal'));
      if (found) return found;
    }
    if (normName === 'nasi putih' || normName === 'nasi') {
      const found = productsMap.get('prod_nasi') || allProducts.find((p) => p.name.toLowerCase() === 'nasi');
      if (found) return found;
    }
    if (normName.includes('teh manis')) {
      const found =
        productsMap.get('prod_teh_manis') ||
        productsMap.get('prod_menu_teh_manis') ||
        allProducts.find((p) => p.name.toLowerCase().includes('teh manis'));
      if (found) return found;
    }
  }

  return undefined;
}

/**
 * Resolves an ingredient reference from ingredientsMap by exact ID, code, or normalized name.
 */
export function resolveIngredientReference(
  sourceId: string | undefined,
  sourceName: string | undefined,
  ingredientsMap?: Map<string, Ingredient>
): Ingredient | undefined {
  if (!ingredientsMap) return undefined;
  if (sourceId && ingredientsMap.has(sourceId)) {
    return ingredientsMap.get(sourceId);
  }
  const allIngredients = Array.from(ingredientsMap.values());
  const normId = (sourceId || '').trim().toLowerCase();
  const normName = (sourceName || '').trim().toLowerCase();

  if (normId) {
    const byIdOrCode = allIngredients.find(
      (ing) =>
        ing.id.trim().toLowerCase() === normId ||
        (ing.code && ing.code.trim().toLowerCase() === normId)
    );
    if (byIdOrCode) return byIdOrCode;
  }

  if (normName) {
    const byName = allIngredients.find((ing) => ing.name.trim().toLowerCase() === normName);
    if (byName) return byName;
  }

  return undefined;
}

/**
 * Helper to find composition items for a product (Komposisi Menu POS).
 * Checks assembliesMap first (live source of truth), then product.compositionItems.
 */
export function getProductComposition(
  product: Product | undefined,
  assembliesMap?: Map<string, Assembly>
): AssemblyItem[] | undefined {
  if (!product) return undefined;

  if (assembliesMap) {
    let asm =
      assembliesMap.get(product.id) ||
      (product.assemblyId ? assembliesMap.get(product.assemblyId) : undefined) ||
      (product.compositionId ? assembliesMap.get(product.compositionId) : undefined);

    if (!asm) {
      for (const candidate of assembliesMap.values()) {
        if (candidate.productId === product.id || candidate.targetProductId === product.id) {
          asm = candidate;
          break;
        }
      }
    }

    if (asm && asm.components && asm.components.length > 0) {
      return asm.components;
    }
  }

  if (product.compositionItems && product.compositionItems.length > 0) {
    return product.compositionItems;
  }

  return undefined;
}

/**
 * Calculates dynamic availability of a Menu POS or Product based on underlying stocks.
 * 1. If product has compositionItems / assembly: calculate availability from components (recursively if component is also a composition menu).
 * 2. Else if product has valid packageItems: calculate availability from component products.
 * 3. Else if product is a PRODUCTION product: return physical stock (product.stock).
 * 4. Else if product is a raw material / packaging: return physical stock.
 * 5. Only if product has NO composition and is NOT a stock-tracked product: return 0.
 */
export function calculateProductAvailability(
  product: Product | undefined,
  recipe?: Recipe,
  ingredientsMap?: Map<string, Ingredient>,
  productsMap?: Map<string, Product>,
  assembliesMap?: Map<string, Assembly>,
  visited: Set<string> = new Set()
): number {
  if (!product) return 0;
  if (visited.has(product.id)) return 0;

  const nextVisited = new Set(visited);
  nextVisited.add(product.id);

  // 1. Check Komposisi Menu (compositionItems / assembly) FIRST
  const composition = getProductComposition(product, assembliesMap);
  if (composition && composition.length > 0) {
    let minYield = Infinity;
    for (const comp of composition) {
      const required = comp.quantity || 1;
      if (required <= 0) continue;

      let compStock = 0;
      if (comp.sourceType === 'PRODUCT') {
        const compProd = resolveProductReference(comp.sourceId, comp.sourceName, productsMap);
        if (compProd) {
          compStock = calculateProductAvailability(
            compProd,
            undefined,
            ingredientsMap,
            productsMap,
            assembliesMap,
            nextVisited
          );
        }
      } else {
        const compIng = resolveIngredientReference(comp.sourceId, comp.sourceName, ingredientsMap);
        compStock = compIng && typeof compIng.stock === 'number' ? Math.max(0, compIng.stock) : 0;
      }

      const yieldForComp = Math.floor(compStock / required);
      if (yieldForComp < minYield) {
        minYield = yieldForComp;
      }
    }
    return minYield === Infinity ? 0 : Math.max(0, minYield);
  }

  // 2. Fallback to packageItems if PACKAGE has no assembly/compositionItems
  if (
    product.productType === 'PACKAGE' &&
    product.packageItems &&
    product.packageItems.length > 0
  ) {
    if (!productsMap) return 0;

    let minPackages = Infinity;
    for (const pkgItem of product.packageItems) {
      const componentProd = resolveProductReference(
        pkgItem.productId,
        pkgItem.productName,
        productsMap
      );
      if (!componentProd) {
        minPackages = 0;
        break;
      }
      const compAvail = calculateProductAvailability(
        componentProd,
        undefined,
        ingredientsMap,
        productsMap,
        assembliesMap,
        nextVisited
      );
      const compYield = Math.floor(compAvail / (pkgItem.quantity || 1));
      if (compYield < minPackages) {
        minPackages = compYield;
      }
    }
    return minPackages === Infinity ? 0 : Math.max(0, minPackages);
  }

  // 3. Produk Hasil Produksi (PRODUCTION) -> always use physical stock
  const isProdOutput = Boolean(
    isProductionOutputProduct(product) ||
      (recipe &&
        ((recipe.items && recipe.items.length > 0) ||
          (recipe.batchItems && recipe.batchItems.length > 0)))
  );
  if (isProdOutput) {
    return typeof product.stock === 'number' ? Math.max(0, product.stock) : 0;
  }

  // 4. Only if product has NO composition and is NOT stock-tracked (or is COMPOSITION/PACKAGE without components) -> return 0
  if (
    product.stockSource === 'COMPOSITION' ||
    product.stockSource === 'ASSEMBLY' ||
    product.productType === 'PACKAGE' ||
    product.stockTracked === false
  ) {
    return 0;
  }

  // 5. Physical product / Bahan / Kemasan / Ready-to-sell
  let stock = typeof product.stock === 'number' ? Math.max(0, product.stock) : 0;

  if (ingredientsMap && product.stockSource !== 'READY_TO_SELL') {
    const directIng = resolveIngredientReference(product.id, product.name, ingredientsMap);
    if (directIng && typeof directIng.stock === 'number') {
      stock = Math.max(stock, Math.max(0, directIng.stock));
    }
  }

  return stock;
}

/**
 * Returns package or menu composition availability details including limiting component if out of stock.
 */
export function getPackageOutOfStockReason(
  product: Product,
  productsMap: Map<string, Product>,
  ingredientsMap?: Map<string, Ingredient>,
  assembliesMap?: Map<string, Assembly>
): { isAvailable: boolean; minYield: number; limitingComponent?: { name: string; stock: number; required: number } } {
  // 1. Check Komposisi Menu first
  const composition = getProductComposition(product, assembliesMap);
  if (composition && composition.length > 0) {
    let minYield = Infinity;
    let limitingComp: { name: string; stock: number; required: number } | undefined = undefined;

    for (const comp of composition) {
      const required = comp.quantity || 1;
      if (required <= 0) continue;
      let compStock = 0;
      let name = comp.sourceName;

      if (comp.sourceType === 'PRODUCT') {
        const compProd = resolveProductReference(comp.sourceId, comp.sourceName, productsMap);
        compStock = compProd
          ? calculateProductAvailability(compProd, undefined, ingredientsMap, productsMap, assembliesMap)
          : 0;
        if (compProd) name = compProd.name;
      } else {
        const compIng = resolveIngredientReference(comp.sourceId, comp.sourceName, ingredientsMap);
        compStock = compIng && typeof compIng.stock === 'number' ? Math.max(0, compIng.stock) : 0;
        if (compIng) name = compIng.name;
      }

      const yieldForComp = Math.floor(compStock / required);
      if (yieldForComp < minYield) {
        minYield = yieldForComp;
        limitingComp = {
          name,
          stock: compStock,
          required,
        };
      }
    }

    const finalYield = minYield === Infinity ? 0 : Math.max(0, minYield);
    return {
      isAvailable: finalYield > 0,
      minYield: finalYield,
      limitingComponent: limitingComp,
    };
  }

  // 2. Fallback to packageItems if no composition
  if (product.productType === 'PACKAGE' && product.packageItems && product.packageItems.length > 0) {
    let minYield = Infinity;
    let limitingComp: { name: string; stock: number; required: number } | undefined = undefined;

    for (const pkgItem of product.packageItems) {
      const compProd = resolveProductReference(pkgItem.productId, pkgItem.productName, productsMap);
      const compAvail = compProd
        ? calculateProductAvailability(compProd, undefined, ingredientsMap, productsMap, assembliesMap)
        : 0;
      const required = pkgItem.quantity || 1;
      const yieldForComp = Math.floor(compAvail / required);

      if (yieldForComp < minYield) {
        minYield = yieldForComp;
        limitingComp = {
          name: compProd ? compProd.name : pkgItem.productName || 'Komponen',
          stock: compAvail,
          required,
        };
      }
    }

    const finalYield = minYield === Infinity ? 0 : Math.max(0, minYield);
    return {
      isAvailable: finalYield > 0,
      minYield: finalYield,
      limitingComponent: limitingComp,
    };
  }

  // 3. Produk Hasil Produksi -> physical stock
  if (isProductionOutputProduct(product)) {
    const stock = typeof product.stock === 'number' ? Math.max(0, product.stock) : 0;
    return {
      isAvailable: stock > 0,
      minYield: stock,
    };
  }

  // 4. If a Menu POS (untracked / composition based) has no composition, consider it OUT OF STOCK
  if (
    product.stockSource === 'COMPOSITION' ||
    product.stockSource === 'ASSEMBLY' ||
    product.productType === 'PACKAGE' ||
    product.stockTracked === false
  ) {
    return {
      isAvailable: false,
      minYield: 0,
      limitingComponent: { name: 'Komposisi Belum Diatur', stock: 0, required: 1 },
    };
  }

  const stock = typeof product.stock === 'number' ? Math.max(0, product.stock) : 0;
  return {
    isAvailable: stock > 0,
    minYield: stock,
  };
}

/**
 * Validates whether all items in a cart have sufficient physical product & ingredient stock.
 * Deconstructs MENU PAKET and MENU POS (Komposisi Menu) down to physical stocks.
 */
export function validateCartStock(
  cartItems: { product: Product; quantity: number }[],
  recipesMap?: Map<string, Recipe>,
  ingredientsMap?: Map<string, Ingredient>,
  productsMap?: Map<string, Product>,
  assembliesMap?: Map<string, Assembly>
): { valid: boolean; errorMessage?: string } {
  const reqProducts = new Map<string, number>();
  const reqIngredients = new Map<string, number>();

  const processItem = (prod: Product, qty: number, visited: Set<string> = new Set()) => {
    if (!prod || visited.has(prod.id)) return;
    const nextVisited = new Set(visited);
    nextVisited.add(prod.id);

    // 1. Check Komposisi Menu first (even if stockTracked === false!)
    const composition = getProductComposition(prod, assembliesMap);
    if (composition && composition.length > 0) {
      for (const comp of composition) {
        const reqQty = qty * (comp.quantity || 1);
        if (comp.sourceType === 'PRODUCT') {
          const compProd = resolveProductReference(comp.sourceId, comp.sourceName, productsMap);
          if (compProd) {
            processItem(compProd, reqQty, nextVisited);
          } else {
            reqProducts.set(comp.sourceId, (reqProducts.get(comp.sourceId) || 0) + reqQty);
          }
        } else {
          const compIng = resolveIngredientReference(comp.sourceId, comp.sourceName, ingredientsMap);
          const ingId = compIng ? compIng.id : comp.sourceId;
          reqIngredients.set(ingId, (reqIngredients.get(ingId) || 0) + reqQty);
        }
      }
      return;
    }

    // 2. Fallback to packageItems if no composition
    if (prod.productType === 'PACKAGE' && prod.packageItems && prod.packageItems.length > 0) {
      for (const pkgItem of prod.packageItems) {
        const compProd = resolveProductReference(pkgItem.productId, pkgItem.productName, productsMap);
        if (compProd) {
          processItem(compProd, qty * (pkgItem.quantity || 1), nextVisited);
        }
      }
      return;
    }

    // 3. If untracked and not a production product, do not check physical stock directly
    if (prod.stockTracked === false && !isProductionOutputProduct(prod)) {
      return;
    }

    // 4. Direct physical product (Produk Hasil Produksi / Ready-to-sell)
    reqProducts.set(prod.id, (reqProducts.get(prod.id) || 0) + qty);
  };

  for (const item of cartItems) {
    // First ensure the item itself is available (catches unconfigured COMPOSITION menus)
    const avail = calculateProductAvailability(
      item.product,
      recipesMap?.get(item.product.recipeId || ''),
      ingredientsMap,
      productsMap,
      assembliesMap
    );
    if (item.quantity > avail) {
      return {
        valid: false,
        errorMessage: `Stok ${item.product.name} tidak mencukupi. Butuh ${item.quantity}, tersedia ${avail}.`,
      };
    }
    processItem(item.product, item.quantity);
  }

  // Check physical product stocks
  for (const [prodId, reqQty] of reqProducts.entries()) {
    const prod = productsMap?.get(prodId);
    const avail = prod && typeof prod.stock === 'number' ? Math.max(0, prod.stock) : 0;
    if (reqQty > avail) {
      return {
        valid: false,
        errorMessage: `Stok ${prod?.name || 'Komponen Produk'} tidak mencukupi. Butuh ${reqQty}, sisa ${avail}.`,
      };
    }
  }

  // Check physical ingredient stocks
  for (const [ingId, reqQty] of reqIngredients.entries()) {
    const ing = ingredientsMap?.get(ingId);
    const avail = ing && typeof ing.stock === 'number' ? Math.max(0, ing.stock) : 0;
    if (reqQty > avail) {
      return {
        valid: false,
        errorMessage: `Stok ${ing?.name || 'Bahan/Kemasan'} tidak mencukupi. Butuh ${reqQty}, sisa ${avail}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Atomically deducts finished product & ingredient stock for a completed sale using a Firestore Batch operation.
 * - Single Menu POS items deduct components via Komposisi Menu (Produk Stok / Ingredients).
 * - Package Menu items deduct component Menu POS / products via Komposisi Menu without double deduction.
 */
export async function processSaleStockDeduction(
  sale: Sale,
  productsMap: Map<string, Product>,
  userUid: string,
  ingredientsMap?: Map<string, Ingredient>,
  assembliesMap?: Map<string, Assembly>
): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // Track updated stock levels in memory during batch setup
  const updatedProdStocks = new Map<string, number>();
  const updatedIngStocks = new Map<string, number>();

  const getProdStock = (p: Product) => {
    if (updatedProdStocks.has(p.id)) return updatedProdStocks.get(p.id)!;
    return typeof p.stock === 'number' ? p.stock : 0;
  };

  const getIngStock = (ing: Ingredient) => {
    if (updatedIngStocks.has(ing.id)) return updatedIngStocks.get(ing.id)!;
    return typeof ing.stock === 'number' ? ing.stock : 0;
  };

  const deductProductOrComposition = (
    prod: Product,
    qty: number,
    parentMenuName?: string,
    visited: Set<string> = new Set()
  ) => {
    if (!prod || visited.has(prod.id)) return;
    const nextVisited = new Set(visited);
    nextVisited.add(prod.id);

    // 1. Check Komposisi Menu first
    const composition = getProductComposition(prod, assembliesMap);
    if (composition && composition.length > 0) {
      const label = parentMenuName ? `${parentMenuName} -> ${prod.name}` : prod.name;
      for (const comp of composition) {
        const deductQty = qty * (comp.quantity || 1);
        if (comp.sourceType === 'PRODUCT') {
          const compProd = resolveProductReference(comp.sourceId, comp.sourceName, productsMap);
          if (!compProd) continue;

          // If component product itself is a composition menu (e.g. Ayam Geprek inside Paket Mantul), deduct its components recursively
          const nestedComp = getProductComposition(compProd, assembliesMap);
          if (
            (nestedComp && nestedComp.length > 0) ||
            compProd.stockSource === 'COMPOSITION' ||
            compProd.productType === 'PACKAGE'
          ) {
            deductProductOrComposition(compProd, deductQty, label, nextVisited);
            continue;
          }

          const currentStock = getProdStock(compProd);
          const newStock = Math.max(0, currentStock - deductQty);
          updatedProdStocks.set(compProd.id, newStock);

          const compRef = doc(db, 'products', compProd.id);
          batch.set(
            compRef,
            sanitizeFirestore({
              ...compProd,
              stock: newStock,
              updatedAt: now,
            }),
            { merge: true }
          );

          const movementRef = doc(collection(db, 'stock_movements'));
          const movement: StockMovement = {
            id: movementRef.id,
            entityType: 'PRODUCT',
            movementCategory: compProd.stockSource === 'READY_TO_SELL' ? 'BARANG_SIAP_JUAL' : 'PRODUK_JADI',
            entityId: compProd.id,
            entityName: compProd.name,
            productId: compProd.id,
            productName: compProd.name,
            type: 'SALE',
            changeAmount: -deductQty,
            balanceAfter: newStock,
            referenceId: sale.transactionNo,
            notes: `Penjualan POS TRX: ${sale.transactionNo} (Menu: ${label} x${qty})`,
            createdBy: userUid,
            createdAt: now,
          };
          batch.set(movementRef, sanitizeFirestore(movement));
        } else if (ingredientsMap) {
          const compIng = resolveIngredientReference(comp.sourceId, comp.sourceName, ingredientsMap);
          if (!compIng) continue;

          const currentStock = getIngStock(compIng);
          const newStock = Math.max(0, currentStock - deductQty);
          updatedIngStocks.set(compIng.id, newStock);

          const ingRef = doc(db, 'ingredients', compIng.id);
          batch.set(
            ingRef,
            sanitizeFirestore({
              ...compIng,
              stock: newStock,
              updatedAt: now,
            }),
            { merge: true }
          );

          const movementRef = doc(collection(db, 'stock_movements'));
          const movement: StockMovement = {
            id: movementRef.id,
            entityType: 'INGREDIENT',
            movementCategory: compIng.type === 'PACKAGING' ? 'KEMASAN' : 'BAHAN_BAKU',
            entityId: compIng.id,
            entityName: compIng.name,
            ingredientId: compIng.id,
            ingredientName: compIng.name,
            type: 'SALE',
            changeAmount: -deductQty,
            balanceAfter: newStock,
            referenceId: sale.transactionNo,
            notes: `Penjualan POS TRX: ${sale.transactionNo} (Komposisi Menu: ${label} x${qty})`,
            createdBy: userUid,
            createdAt: now,
          };
          batch.set(movementRef, sanitizeFirestore(movement));
        }
      }
      return;
    }

    // 2. Fallback to packageItems if no composition
    const isPackage =
      prod.productType === 'PACKAGE' ||
      (prod.packageItems && prod.packageItems.length > 0);

    if (isPackage && prod.packageItems && prod.packageItems.length > 0) {
      for (const pkgItem of prod.packageItems) {
        const compProd = resolveProductReference(pkgItem.productId, pkgItem.productName, productsMap);
        if (compProd) {
          deductProductOrComposition(compProd, qty * (pkgItem.quantity || 1), prod.name, nextVisited);
        }
      }
      return;
    }

    // 3. Direct physical product deduction (Only for physical products with tracked stock or production outputs)
    if (
      !isProductionOutputProduct(prod) &&
      (prod.stockTracked === false || prod.stockSource === 'COMPOSITION' || prod.stockSource === 'NONE')
    ) {
      return;
    }

    const currentStock = getProdStock(prod);
    const newStock = Math.max(0, currentStock - qty);
    updatedProdStocks.set(prod.id, newStock);

    const prodRef = doc(db, 'products', prod.id);
    batch.set(
      prodRef,
      sanitizeFirestore({
        ...prod,
        stock: newStock,
        updatedAt: now,
      }),
      { merge: true }
    );

    const movementRef = doc(collection(db, 'stock_movements'));
    const movement: StockMovement = {
      id: movementRef.id,
      entityType: 'PRODUCT',
      movementCategory: prod.stockSource === 'READY_TO_SELL' ? 'BARANG_SIAP_JUAL' : 'PRODUK_JADI',
      entityId: prod.id,
      entityName: prod.name,
      productId: prod.id,
      productName: prod.name,
      type: 'SALE',
      changeAmount: -qty,
      balanceAfter: newStock,
      referenceId: sale.transactionNo,
      notes: `Penjualan POS TRX: ${sale.transactionNo}${parentMenuName ? ` (Paket: ${parentMenuName})` : ''}`,
      createdBy: userUid,
      createdAt: now,
    };
    batch.set(movementRef, sanitizeFirestore(movement));
  };

  for (const item of sale.items) {
    const product = resolveProductReference(item.productId, item.productName, productsMap);
    if (!product) continue;
    deductProductOrComposition(product, item.quantity);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'products_batch_sale');
  }
}

/**
 * Atomically reverses finished product & ingredient stock for a VOID sale transaction.
 */
export async function processVoidStockReversal(
  sale: Sale,
  productsMap: Map<string, Product>,
  userUid: string,
  reason: string,
  ingredientsMap?: Map<string, Ingredient>,
  assembliesMap?: Map<string, Assembly>
): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  const updatedProdStocks = new Map<string, number>();
  const updatedIngStocks = new Map<string, number>();

  const getProdStock = (p: Product) => {
    if (updatedProdStocks.has(p.id)) return updatedProdStocks.get(p.id)!;
    return typeof p.stock === 'number' ? p.stock : 0;
  };

  const getIngStock = (ing: Ingredient) => {
    if (updatedIngStocks.has(ing.id)) return updatedIngStocks.get(ing.id)!;
    return typeof ing.stock === 'number' ? ing.stock : 0;
  };

  const restoreProductOrComposition = (
    prod: Product,
    qty: number,
    parentMenuName?: string,
    visited: Set<string> = new Set()
  ) => {
    if (!prod || visited.has(prod.id)) return;
    const nextVisited = new Set(visited);
    nextVisited.add(prod.id);

    // 1. Check Komposisi Menu first
    const composition = getProductComposition(prod, assembliesMap);
    if (composition && composition.length > 0) {
      const label = parentMenuName ? `${parentMenuName} -> ${prod.name}` : prod.name;
      for (const comp of composition) {
        const addQty = qty * (comp.quantity || 1);
        if (comp.sourceType === 'PRODUCT') {
          const compProd = resolveProductReference(comp.sourceId, comp.sourceName, productsMap);
          if (!compProd) continue;

          const nestedComp = getProductComposition(compProd, assembliesMap);
          if (
            (nestedComp && nestedComp.length > 0) ||
            compProd.stockSource === 'COMPOSITION' ||
            compProd.productType === 'PACKAGE'
          ) {
            restoreProductOrComposition(compProd, addQty, label, nextVisited);
            continue;
          }

          const currentStock = getProdStock(compProd);
          const newStock = currentStock + addQty;
          updatedProdStocks.set(compProd.id, newStock);

          const compRef = doc(db, 'products', compProd.id);
          batch.set(
            compRef,
            sanitizeFirestore({
              ...compProd,
              stock: newStock,
              updatedAt: now,
            }),
            { merge: true }
          );

          const movementRef = doc(collection(db, 'stock_movements'));
          const movement: StockMovement = {
            id: movementRef.id,
            entityType: 'PRODUCT',
            movementCategory: compProd.stockSource === 'READY_TO_SELL' ? 'BARANG_SIAP_JUAL' : 'PRODUK_JADI',
            entityId: compProd.id,
            entityName: compProd.name,
            productId: compProd.id,
            productName: compProd.name,
            type: 'RETURN',
            changeAmount: addQty,
            balanceAfter: newStock,
            referenceId: sale.transactionNo,
            notes: `Pembatalan (VOID) TRX: ${sale.transactionNo} (Menu: ${label}). Alasan: ${reason}`,
            createdBy: userUid,
            createdAt: now,
          };
          batch.set(movementRef, sanitizeFirestore(movement));
        } else if (ingredientsMap) {
          const compIng = resolveIngredientReference(comp.sourceId, comp.sourceName, ingredientsMap);
          if (!compIng) continue;

          const currentStock = getIngStock(compIng);
          const newStock = currentStock + addQty;
          updatedIngStocks.set(compIng.id, newStock);

          const ingRef = doc(db, 'ingredients', compIng.id);
          batch.set(
            ingRef,
            sanitizeFirestore({
              ...compIng,
              stock: newStock,
              updatedAt: now,
            }),
            { merge: true }
          );

          const movementRef = doc(collection(db, 'stock_movements'));
          const movement: StockMovement = {
            id: movementRef.id,
            entityType: 'INGREDIENT',
            movementCategory: compIng.type === 'PACKAGING' ? 'KEMASAN' : 'BAHAN_BAKU',
            entityId: compIng.id,
            entityName: compIng.name,
            ingredientId: compIng.id,
            ingredientName: compIng.name,
            type: 'RETURN',
            changeAmount: addQty,
            balanceAfter: newStock,
            referenceId: sale.transactionNo,
            notes: `Pembatalan (VOID) TRX: ${sale.transactionNo} (Komposisi Menu: ${label}). Alasan: ${reason}`,
            createdBy: userUid,
            createdAt: now,
          };
          batch.set(movementRef, sanitizeFirestore(movement));
        }
      }
      return;
    }

    // 2. Fallback to packageItems if no composition
    const isPackage =
      prod.productType === 'PACKAGE' ||
      (prod.packageItems && prod.packageItems.length > 0);

    if (isPackage && prod.packageItems && prod.packageItems.length > 0) {
      for (const pkgItem of prod.packageItems) {
        const compProd = resolveProductReference(pkgItem.productId, pkgItem.productName, productsMap);
        if (compProd) {
          restoreProductOrComposition(compProd, qty * (pkgItem.quantity || 1), prod.name, nextVisited);
        }
      }
      return;
    }

    // 3. Direct physical product restoration
    if (
      !isProductionOutputProduct(prod) &&
      (prod.stockTracked === false || prod.stockSource === 'COMPOSITION' || prod.stockSource === 'NONE')
    ) {
      return;
    }

    const currentStock = getProdStock(prod);
    const newStock = currentStock + qty;
    updatedProdStocks.set(prod.id, newStock);

    const prodRef = doc(db, 'products', prod.id);
    batch.set(
      prodRef,
      sanitizeFirestore({
        ...prod,
        stock: newStock,
        updatedAt: now,
      }),
      { merge: true }
    );

    const movementRef = doc(collection(db, 'stock_movements'));
    const movement: StockMovement = {
      id: movementRef.id,
      entityType: 'PRODUCT',
      movementCategory: prod.stockSource === 'READY_TO_SELL' ? 'BARANG_SIAP_JUAL' : 'PRODUK_JADI',
      entityId: prod.id,
      entityName: prod.name,
      productId: prod.id,
      productName: prod.name,
      type: 'RETURN',
      changeAmount: qty,
      balanceAfter: newStock,
      referenceId: sale.transactionNo,
      notes: `Pembatalan (VOID) TRX: ${sale.transactionNo}. Alasan: ${reason}`,
      createdBy: userUid,
      createdAt: now,
    };
    batch.set(movementRef, sanitizeFirestore(movement));
  };

  for (const item of sale.items) {
    const product = productsMap.get(item.productId);
    if (!product) continue;
    restoreProductOrComposition(product, item.quantity);
  }

  // Update sale status to VOID
  const saleRef = doc(db, 'sales', sale.id);
  batch.set(
    saleRef,
    sanitizeFirestore({
      status: 'VOID',
      voidReason: reason,
      updatedAt: now,
    }),
    { merge: true }
  );

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `sales/${sale.id}/void`);
  }
}

/**
 * Parameters for executing a General Production batch.
 */
export interface GeneralProductionParams {
  product: Product;
  recipe: Recipe;
  batchQty: number; // e.g. 1, 2, 3 batches
  ingredientsMap: Map<string, Ingredient>;
  notes?: string;
  userUid: string;
  userName: string;
  date?: string;
}

/**
 * Executes a General Production batch atomically:
 * 1. Validates & deducts required raw materials and packaging from ingredient stocks.
 * 2. Adds finished goods quantity to product.stock.
 * 3. Records stock movements for both ingredients (-) and product (+).
 * 4. Records a detailed Production snapshot record.
 */
export async function processGeneralProduction(params: {
  product: Product;
  recipe: Recipe;
  batchQty?: number;
  actualYield?: number;
  ingredientsMap: Map<string, Ingredient>;
  notes?: string;
  userUid: string;
  userName: string;
  date?: string;
}): Promise<Production> {
  const { product, recipe, ingredientsMap, notes, userUid, userName } = params;
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const dateStr = params.date || now.split('T')[0];

  const standardYield = Math.max(1, recipe.yieldQty || 1);
  const batchQty = params.batchQty || 1;
  const totalProduced =
    params.actualYield !== undefined && params.actualYield > 0
      ? params.actualYield
      : batchQty * standardYield;

  // Determine items to deduct based on recipe definition
  // 1 Batch raw materials + packaging proportional to actual produced yield
  const itemsToDeduct: {
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    costPerUnit: number;
    type: 'RAW' | 'PACKAGING' | string;
  }[] = [];

  if (recipe.batchItems && recipe.batchItems.length > 0) {
    // 1. Raw materials for 1 batch
    for (const bItem of recipe.batchItems) {
      const ing = ingredientsMap.get(bItem.ingredientId);
      const costPerUnit = ing ? ing.costPerUnit : bItem.costPerUnit || 0;
      const type = ing ? ing.type : 'RAW';
      itemsToDeduct.push({
        ingredientId: bItem.ingredientId,
        ingredientName: ing?.name || bItem.ingredientName,
        quantity: bItem.quantity * batchQty,
        unit: ing?.unit || bItem.unit,
        costPerUnit,
        type,
      });
    }

    // 2. Portion items (packaging like cup, seal, etc.) deducted according to actual yield produced
    if (recipe.portionItems && recipe.portionItems.length > 0) {
      for (const pItem of recipe.portionItems) {
        const ing = ingredientsMap.get(pItem.ingredientId);
        const costPerUnit = ing ? ing.costPerUnit : pItem.costPerUnit || 0;
        const type = ing ? ing.type : 'PACKAGING';
        itemsToDeduct.push({
          ingredientId: pItem.ingredientId,
          ingredientName: ing?.name || pItem.ingredientName,
          quantity: pItem.quantity * totalProduced,
          unit: ing?.unit || pItem.unit,
          costPerUnit,
          type,
        });
      }
    }
  } else if (recipe.items && recipe.items.length > 0) {
    // Fallback: items are per-unit recipes
    for (const item of recipe.items) {
      const ing = ingredientsMap.get(item.ingredientId);
      const costPerUnit = ing ? ing.costPerUnit : item.costPerUnit || 0;
      const type = ing ? ing.type : 'RAW';
      itemsToDeduct.push({
        ingredientId: item.ingredientId,
        ingredientName: ing?.name || item.ingredientName,
        quantity: item.quantity * totalProduced,
        unit: ing?.unit || item.unit,
        costPerUnit,
        type,
      });
    }
  }

  // Validate all ingredient stocks
  for (const item of itemsToDeduct) {
    const ing = ingredientsMap.get(item.ingredientId);
    const available = ing ? ing.stock : 0;
    if (item.quantity > available) {
      const shortage = item.quantity - available;
      const formattedAvail = Number(available.toFixed(2));
      const formattedReq = Number(item.quantity.toFixed(2));
      const formattedShort = Number(shortage.toFixed(2));
      throw new Error(
        `${item.ingredientName} tidak mencukupi.\n\nTersedia: ${formattedAvail} ${item.unit}\nDibutuhkan: ${formattedReq} ${item.unit}\nKekurangan: ${formattedShort} ${item.unit}`
      );
    }
  }

  // Calculate HPP snapshot
  let totalMaterialsCost = 0;
  const productionItemsSnapshot: ProductionItem[] = itemsToDeduct.map(item => {
    const totalCost = item.quantity * item.costPerUnit;
    totalMaterialsCost += totalCost;
    return {
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      quantity: item.quantity,
      unit: item.unit,
      costPerUnit: item.costPerUnit,
      totalCost,
      type: item.type,
    };
  });

  const totalOverheadCost = (recipe.overheadCostPerUnit || 0) * totalProduced;
  const totalHpp = totalMaterialsCost + totalOverheadCost;
  const hppPerUnit = totalProduced > 0 ? Math.round(totalHpp / totalProduced) : 0;

  // 1. Create Production document
  const prodRef = doc(collection(db, 'productions'));
  const productionRecord: Production = {
    id: prodRef.id,
    date: dateStr,
    productId: product.id,
    productName: product.name,
    recipeId: recipe.id,
    batchQty: batchQty,
    yieldQty: standardYield,
    totalProduced,
    totalHpp,
    hppPerUnit,
    items: productionItemsSnapshot,
    overheadItems: recipe.overheadItems || [],
    totalOverheadCost,
    notes: notes || '',
    createdBy: userUid,
    createdByName: userName,
    createdAt: now,
  };
  batch.set(prodRef, sanitizeFirestore(productionRecord));

  // 2. Deduct ingredient stocks and record movements
  for (const item of itemsToDeduct) {
    const ing = ingredientsMap.get(item.ingredientId);
    if (!ing) continue;

    const newIngStock = Math.max(0, ing.stock - item.quantity);
    const ingRef = doc(db, 'ingredients', ing.id);
    batch.set(
      ingRef,
      sanitizeFirestore({
        ...ing,
        stock: newIngStock,
        updatedAt: now,
      }),
      { merge: true }
    );

    const moveRef = doc(collection(db, 'stock_movements'));
    const movement: StockMovement = {
      id: moveRef.id,
      entityType: 'INGREDIENT',
      entityId: ing.id,
      entityName: ing.name,
      ingredientId: ing.id,
      ingredientName: ing.name,
      type: 'PRODUCTION',
      changeAmount: -item.quantity,
      balanceAfter: newIngStock,
      referenceId: prodRef.id,
      notes: `Produksi ${product.name} (${batchQty} batch = ${totalProduced} pcs/cup)`,
      createdBy: userUid,
      createdAt: now,
    };
    batch.set(moveRef, sanitizeFirestore(movement));
  }

  // 3. Add to finished product stock and record movement
  const currentProdStock = typeof product.stock === 'number' ? product.stock : 0;
  const newProdStock = currentProdStock + totalProduced;
  const prodDocRef = doc(db, 'products', product.id);
  batch.set(
    prodDocRef,
    sanitizeFirestore({
      ...product,
      stock: newProdStock,
      updatedAt: now,
    }),
    { merge: true }
  );

  const prodMoveRef = doc(collection(db, 'stock_movements'));
  const prodMovement: StockMovement = {
    id: prodMoveRef.id,
    entityType: 'PRODUCT',
    entityId: product.id,
    entityName: product.name,
    productId: product.id,
    productName: product.name,
    ingredientId: product.id,
    ingredientName: product.name,
    type: 'PRODUCTION',
    changeAmount: totalProduced,
    balanceAfter: newProdStock,
    referenceId: prodRef.id,
    notes: `Hasil Produksi: +${totalProduced} ${product.name} (${batchQty} batch)`,
    createdBy: userUid,
    createdAt: now,
  };
  batch.set(prodMoveRef, sanitizeFirestore(prodMovement));

  // 4. If chicken production, also write to legacy stock_productions collection
  if (
    product.name.toLowerCase().includes('ayam') ||
    recipe.productName.toLowerCase().includes('ayam')
  ) {
    const rawIng = ingredientsMap.get('ing_ayam_raw');
    const legacyProdRef = doc(collection(db, 'stock_productions'));
    const rawUsed = itemsToDeduct.find(i => i.ingredientId === 'ing_ayam_raw')?.quantity || 0;
    const legacyRec: StockProduction = {
      id: legacyProdRef.id,
      date: dateStr,
      rawIngredientId: rawIng?.id || 'ing_ayam_raw',
      rawIngredientName: rawIng?.name || 'Ayam Mentah',
      rawQuantity: rawUsed,
      preparedIngredientId: product.id,
      preparedIngredientName: product.name,
      preparedQuantity: totalProduced,
      yieldRatio: rawUsed > 0 ? Number((totalProduced / rawUsed).toFixed(2)) : 0,
      notes: notes || '',
      createdBy: userUid,
      createdAt: now,
    };
    batch.set(legacyProdRef, sanitizeFirestore(legacyRec));
  }

  try {
    await batch.commit();
    return productionRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'general_production');
    throw error;
  }
}

/**
 * Adjusts stock for a finished product directly (Stock Opname / Penyesuaian Produk Jadi).
 */
export async function processProductStockOpname(
  product: Product,
  physicalStock: number,
  reason: string,
  userUid: string
): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const oldStock = typeof product.stock === 'number' ? product.stock : 0;
  const diff = physicalStock - oldStock;

  const prodRef = doc(db, 'products', product.id);
  batch.set(
    prodRef,
    sanitizeFirestore({
      ...product,
      stock: physicalStock,
      updatedAt: now,
    }),
    { merge: true }
  );

  const moveRef = doc(collection(db, 'stock_movements'));
  const movement: StockMovement = {
    id: moveRef.id,
    entityType: 'PRODUCT',
    entityId: product.id,
    entityName: product.name,
    productId: product.id,
    productName: product.name,
    ingredientId: product.id,
    ingredientName: product.name,
    type: 'ADJUSTMENT',
    changeAmount: diff,
    balanceAfter: physicalStock,
    referenceId: `OPN-${Date.now()}`,
    notes: `Stock Opname Produk: ${reason} (Sistem: ${oldStock} -> Fisik: ${physicalStock})`,
    createdBy: userUid,
    createdAt: now,
  };
  batch.set(moveRef, sanitizeFirestore(movement));

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `products/${product.id}/opname`);
  }
}

/**
 * Backward-compatible chicken processing production.
 */
export async function processChickenProduction(data: {
  date: string;
  rawIngredient: Ingredient;
  rawKg: number;
  preparedIngredient: Ingredient;
  preparedPcs: number;
  notes?: string;
  userUid: string;
}): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  const newRawStock = Math.max(0, data.rawIngredient.stock - data.rawKg);
  const newPreparedStock = data.preparedIngredient.stock + data.preparedPcs;
  const yieldRatio = data.rawKg > 0 ? Number((data.preparedPcs / data.rawKg).toFixed(2)) : 0;

  // 1. Update raw chicken stock
  const rawRef = doc(db, 'ingredients', data.rawIngredient.id);
  batch.set(
    rawRef,
    sanitizeFirestore({
      ...data.rawIngredient,
      stock: newRawStock,
      updatedAt: now,
    }),
    { merge: true }
  );

  // 2. Update prepared chicken stock
  const preparedRef = doc(db, 'ingredients', data.preparedIngredient.id);
  batch.set(
    preparedRef,
    sanitizeFirestore({
      ...data.preparedIngredient,
      stock: newPreparedStock,
      updatedAt: now,
    }),
    { merge: true }
  );

  // 3. Create production record
  const prodRef = doc(collection(db, 'stock_productions'));
  const productionRecord: StockProduction = {
    id: prodRef.id,
    date: data.date,
    rawIngredientId: data.rawIngredient.id,
    rawIngredientName: data.rawIngredient.name,
    rawQuantity: data.rawKg,
    preparedIngredientId: data.preparedIngredient.id,
    preparedIngredientName: data.preparedIngredient.name,
    preparedQuantity: data.preparedPcs,
    yieldRatio,
    notes: data.notes || '',
    createdBy: data.userUid,
    createdAt: now,
  };
  batch.set(prodRef, sanitizeFirestore(productionRecord));

  // 4. Movement log for raw chicken
  const m1Ref = doc(collection(db, 'stock_movements'));
  const m1: StockMovement = {
    id: m1Ref.id,
    entityType: 'INGREDIENT',
    entityId: data.rawIngredient.id,
    entityName: data.rawIngredient.name,
    ingredientId: data.rawIngredient.id,
    ingredientName: data.rawIngredient.name,
    type: 'PRODUCTION',
    changeAmount: -data.rawKg,
    balanceAfter: newRawStock,
    referenceId: prodRef.id,
    notes: `Produksi Ayam: -${data.rawKg} kg mentah (${data.notes || ''})`,
    createdBy: data.userUid,
    createdAt: now,
  };
  batch.set(m1Ref, sanitizeFirestore(m1));

  // 5. Movement log for prepared chicken
  const m2Ref = doc(collection(db, 'stock_movements'));
  const m2: StockMovement = {
    id: m2Ref.id,
    entityType: 'INGREDIENT',
    entityId: data.preparedIngredient.id,
    entityName: data.preparedIngredient.name,
    ingredientId: data.preparedIngredient.id,
    ingredientName: data.preparedIngredient.name,
    type: 'PRODUCTION',
    changeAmount: data.preparedPcs,
    balanceAfter: newPreparedStock,
    referenceId: prodRef.id,
    notes: `Produksi Ayam: +${data.preparedPcs} potong siap jual (${yieldRatio} pcs/kg)`,
    createdBy: data.userUid,
    createdAt: now,
  };
  batch.set(m2Ref, sanitizeFirestore(m2));

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'stock_productions');
  }
}

/**
 * Cancels a General Production record atomically:
 * 1. Restores all consumed raw materials and packaging back into ingredient stocks (+changeAmount).
 * 2. Deducts the produced finished goods from product.stock (-totalProduced).
 * 3. Records reversing StockMovement entries (type: RETURN) for complete audit trail.
 * 4. Marks the Production record as CANCELLED with cancellation metadata.
 * 5. Writes an audit log record.
 */
export async function cancelGeneralProduction(params: {
  productionId: string;
  reason?: string;
  userUid: string;
  userName: string;
  productsMap: Map<string, Product>;
  ingredientsMap: Map<string, Ingredient>;
  productions: Production[];
}): Promise<void> {
  const { productionId, reason, userUid, userName, productsMap, ingredientsMap, productions } = params;
  const prod = productions.find(p => p.id === productionId);
  if (!prod) {
    throw new Error('Data produksi tidak ditemukan');
  }
  if (prod.status === 'CANCELLED') {
    throw new Error('Produksi ini sudah dibatalkan sebelumnya.');
  }

  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const cancelReasonText = reason?.trim() || 'Dibatalkan oleh Owner';

  // 1. Restore consumed raw materials & packaging back to ingredient stocks
  const itemsToRestore = prod.items || prod.itemsConsumed || [];
  for (const item of itemsToRestore) {
    const ing =
      ingredientsMap.get(item.ingredientId) ||
      Array.from(ingredientsMap.values()).find(
        i => i.name.trim().toLowerCase() === item.ingredientName.trim().toLowerCase()
      );

    if (ing) {
      const currentStock = typeof ing.stock === 'number' ? ing.stock : 0;
      const newIngStock = Math.round((currentStock + item.quantity) * 1000) / 1000;
      const ingRef = doc(db, 'ingredients', ing.id);

      batch.set(
        ingRef,
        sanitizeFirestore({
          ...ing,
          stock: newIngStock,
          updatedAt: now,
        }),
        { merge: true }
      );

      const moveRef = doc(collection(db, 'stock_movements'));
      const movement: StockMovement = {
        id: moveRef.id,
        entityType: 'INGREDIENT',
        movementCategory: ing.type === 'PACKAGING' ? 'KEMASAN' : 'BAHAN_BAKU',
        entityId: ing.id,
        entityName: ing.name,
        ingredientId: ing.id,
        ingredientName: ing.name,
        type: 'RETURN',
        changeAmount: item.quantity,
        balanceAfter: newIngStock,
        unit: ing.stockUnit || ing.unit || item.unit,
        referenceId: prod.id,
        notes: `Batal Produksi #${prod.id} (${prod.productName}): Pengembalian +${item.quantity} ${item.unit || ing.unit}. Alasan: ${cancelReasonText}`,
        createdBy: userUid,
        createdAt: now,
      };
      batch.set(moveRef, sanitizeFirestore(movement));
    }
  }

  // 2. Deduct produced finished product stock
  const product =
    productsMap.get(prod.productId) ||
    Array.from(productsMap.values()).find(
      p => p.name.trim().toLowerCase() === prod.productName.trim().toLowerCase()
    );

  if (product) {
    const currentProdStock = typeof product.stock === 'number' ? product.stock : 0;
    const newProdStock = Math.max(0, Math.round((currentProdStock - prod.totalProduced) * 1000) / 1000);
    const prodRef = doc(db, 'products', product.id);

    batch.set(
      prodRef,
      sanitizeFirestore({
        ...product,
        stock: newProdStock,
        updatedAt: now,
      }),
      { merge: true }
    );

    const prodMoveRef = doc(collection(db, 'stock_movements'));
    const prodMovement: StockMovement = {
      id: prodMoveRef.id,
      entityType: 'PRODUCT',
      movementCategory: product.stockSource === 'READY_TO_SELL' ? 'BARANG_SIAP_JUAL' : 'PRODUK_JADI',
      entityId: product.id,
      entityName: product.name,
      productId: product.id,
      productName: product.name,
      ingredientId: product.id,
      ingredientName: product.name,
      type: 'RETURN',
      changeAmount: -prod.totalProduced,
      balanceAfter: newProdStock,
      unit: product.stockUnit || prod.yieldUnit || 'unit',
      referenceId: prod.id,
      notes: `Batal Produksi #${prod.id} (${prod.productName}): Pengurangan -${prod.totalProduced} ${prod.yieldUnit || 'unit'}. Alasan: ${cancelReasonText}`,
      createdBy: userUid,
      createdAt: now,
    };
    batch.set(prodMoveRef, sanitizeFirestore(prodMovement));
  }

  // 3. Mark Production document as CANCELLED
  const prodDocRef = doc(db, 'productions', prod.id);
  batch.set(
    prodDocRef,
    sanitizeFirestore({
      ...prod,
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledBy: userUid,
      cancelledByName: userName,
      cancelReason: cancelReasonText,
      updatedAt: now,
    }),
    { merge: true }
  );

  // 4. Record Audit Log
  const auditRef = doc(collection(db, 'audit_logs'));
  batch.set(
    auditRef,
    sanitizeFirestore({
      id: auditRef.id,
      action: 'PRODUKSI_DIBATALKAN',
      details: `Owner membatalkan produksi [${prod.productName}] (${prod.totalProduced} ${prod.yieldUnit || 'unit'}). Seluruh stok bahan baku telah dikembalikan. Alasan: ${cancelReasonText}`,
      userUid,
      userName,
      createdAt: now,
    })
  );

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `productions/${prod.id}/cancel`);
    throw error;
  }
}

/**
 * Cancels a Chicken Production record (Pemotongan Ayam) atomically:
 * 1. Restores raw chicken stock (+rawKg) to rawIngredient stock.
 * 2. Deducts prepared chicken (-preparedPcs) from preparedIngredient stock.
 * 3. Records reversing StockMovement entries (type: RETURN).
 * 4. Marks the StockProduction record as CANCELLED.
 * 5. Writes an audit log record.
 */
export async function cancelChickenProduction(params: {
  stockProductionId: string;
  reason?: string;
  userUid: string;
  userName: string;
  ingredientsMap: Map<string, Ingredient>;
  stockProductions: StockProduction[];
}): Promise<void> {
  const { stockProductionId, reason, userUid, userName, ingredientsMap, stockProductions } = params;
  const sp = stockProductions.find(p => p.id === stockProductionId);
  if (!sp) {
    throw new Error('Data pemotongan ayam tidak ditemukan');
  }
  if (sp.status === 'CANCELLED') {
    throw new Error('Pemotongan ayam ini sudah dibatalkan sebelumnya.');
  }

  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const cancelReasonText = reason?.trim() || 'Dibatalkan oleh Owner';

  // 1. Restore Raw Chicken (+rawKg)
  const rawIng =
    ingredientsMap.get(sp.rawIngredientId) ||
    ingredientsMap.get('ing_ayam_raw') ||
    Array.from(ingredientsMap.values()).find(
      i => i.name.trim().toLowerCase() === (sp.rawIngredientName || '').trim().toLowerCase() || i.type === 'RAW'
    );

  if (rawIng) {
    const curRawStock = typeof rawIng.stock === 'number' ? rawIng.stock : 0;
    const newRawStock = Math.round((curRawStock + sp.rawQuantity) * 1000) / 1000;
    const rawRef = doc(db, 'ingredients', rawIng.id);

    batch.set(
      rawRef,
      sanitizeFirestore({
        ...rawIng,
        stock: newRawStock,
        updatedAt: now,
      }),
      { merge: true }
    );

    const m1Ref = doc(collection(db, 'stock_movements'));
    const m1: StockMovement = {
      id: m1Ref.id,
      entityType: 'INGREDIENT',
      movementCategory: 'BAHAN_BAKU',
      entityId: rawIng.id,
      entityName: rawIng.name,
      ingredientId: rawIng.id,
      ingredientName: rawIng.name,
      type: 'RETURN',
      changeAmount: sp.rawQuantity,
      balanceAfter: newRawStock,
      unit: rawIng.stockUnit || rawIng.unit || 'kg',
      referenceId: sp.id,
      notes: `Batal Pemotongan Ayam #${sp.id}: Pengembalian +${sp.rawQuantity} kg mentah. Alasan: ${cancelReasonText}`,
      createdBy: userUid,
      createdAt: now,
    };
    batch.set(m1Ref, sanitizeFirestore(m1));
  }

  // 2. Deduct Prepared Chicken (-preparedPcs)
  const prepIng =
    ingredientsMap.get(sp.preparedIngredientId) ||
    ingredientsMap.get('ing_ayam_ready') ||
    Array.from(ingredientsMap.values()).find(
      i => i.name.trim().toLowerCase() === (sp.preparedIngredientName || '').trim().toLowerCase() || i.type === 'PREPARED'
    );

  if (prepIng) {
    const curPrepStock = typeof prepIng.stock === 'number' ? prepIng.stock : 0;
    const newPrepStock = Math.max(0, Math.round((curPrepStock - sp.preparedQuantity) * 1000) / 1000);
    const prepRef = doc(db, 'ingredients', prepIng.id);

    batch.set(
      prepRef,
      sanitizeFirestore({
        ...prepIng,
        stock: newPrepStock,
        updatedAt: now,
      }),
      { merge: true }
    );

    const m2Ref = doc(collection(db, 'stock_movements'));
    const m2: StockMovement = {
      id: m2Ref.id,
      entityType: 'INGREDIENT',
      movementCategory: 'BAHAN_BAKU',
      entityId: prepIng.id,
      entityName: prepIng.name,
      ingredientId: prepIng.id,
      ingredientName: prepIng.name,
      type: 'RETURN',
      changeAmount: -sp.preparedQuantity,
      balanceAfter: newPrepStock,
      unit: prepIng.stockUnit || prepIng.unit || 'pcs',
      referenceId: sp.id,
      notes: `Batal Pemotongan Ayam #${sp.id}: Pengurangan -${sp.preparedQuantity} potong siap jual. Alasan: ${cancelReasonText}`,
      createdBy: userUid,
      createdAt: now,
    };
    batch.set(m2Ref, sanitizeFirestore(m2));
  }

  // 3. Mark StockProduction document as CANCELLED
  const spDocRef = doc(db, 'stock_productions', sp.id);
  batch.set(
    spDocRef,
    sanitizeFirestore({
      ...sp,
      status: 'CANCELLED',
      cancelledAt: now,
      cancelledBy: userUid,
      cancelledByName: userName,
      cancelReason: cancelReasonText,
      updatedAt: now,
    }),
    { merge: true }
  );

  // 4. Record Audit Log
  const auditRef = doc(collection(db, 'audit_logs'));
  batch.set(
    auditRef,
    sanitizeFirestore({
      id: auditRef.id,
      action: 'PEMOTONGAN_AYAM_DIBATALKAN',
      details: `Owner membatalkan pemotongan ayam #${sp.id} (${sp.rawQuantity} kg mentah -> ${sp.preparedQuantity} potong). Stok ayam mentah telah dikembalikan. Alasan: ${cancelReasonText}`,
      userUid,
      userName,
      createdAt: now,
    })
  );

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `stock_productions/${sp.id}/cancel`);
    throw error;
  }
}

/**
 * Deprecated / Disabled processAssemblyExecution:
 * Menu POS items do not have physical assembled stock.
 * Stock deduction happens dynamically when a Menu POS item is sold.
 */
export async function processAssemblyExecution(params: {
  assembly: Assembly;
  quantityToAssemble: number;
  productsMap: Map<string, Product>;
  ingredientsMap: Map<string, Ingredient>;
  userUid: string;
  userName?: string;
  notes?: string;
}): Promise<void> {
  throw new Error(
    'Eksekusi Perakitan telah dinonaktifkan. Menu POS menggunakan Komposisi Menu dan stok komponennya terpotong secara otomatis saat penjualan POS.'
  );
}
