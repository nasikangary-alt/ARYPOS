import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Product, Recipe, Production, StockProduction } from '../../types';
import {
  formatRupiah,
  formatNumber,
  formatDateTimeIndonesian,
  calculateHPP,
} from '../../utils/formatters';
import { getProductImageUrl } from '../../utils/productImages';
import {
  isProductionOutputProduct,
  isPosMenuProduct,
  isRawOrPackagingProduct,
} from '../../services/stockEngine';
import { RecipeFormModal } from './RecipeFormModal';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import { SummaryBar } from '../common/SummaryBar';
import {
  Factory,
  Flame,
  History,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Minus,
  Package,
  X,
  Sliders,
  Check,
  ChefHat,
  Edit3,
  Search,
  MoreHorizontal,
  RotateCcw,
  Undo2,
  AlertCircle,
  Ban,
} from 'lucide-react';

interface ProductionViewProps {
  initialTab?: 'products' | 'recipes' | 'chicken' | 'history' | 'opname';
}

export const ProductionView: React.FC<ProductionViewProps> = ({ initialTab = 'products' }) => {
  const {
    products,
    productsMap,
    recipes,
    recipesMap,
    ingredientsMap,
    productions,
    stockProductions,
    assemblies,
    assembliesMap,
    submitGeneralProduction,
    cancelGeneralProduction,
    submitChickenProduction,
    cancelChickenProduction,
    submitProductStockOpname,
  } = useApp();
  const { currentRole } = useAuth();
  const canEditRecipe = currentRole !== 'KASIR';
  const isOwner = currentRole === 'OWNER';

  const [activeTab, setActiveTab] = useState<'products' | 'recipes' | 'chicken' | 'history' | 'opname'>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recipeToView, setRecipeToView] = useState<{ product: Product; recipe?: Recipe } | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeTargetProduct, setRecipeTargetProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'SAFE' | 'LOW'>('ALL');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeUnitFilter, setRecipeUnitFilter] = useState('ALL');

  // Cancel production states (Khusus Akun Owner)
  const [cancellingProduction, setCancellingProduction] = useState<Production | null>(null);
  const [cancellingChickenBatch, setCancellingChickenBatch] = useState<StockProduction | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [batchCount, setBatchCount] = useState<number>(1);
  const [actualYield, setActualYield] = useState<number>(1);
  const [patokanInputVal, setPatokanInputVal] = useState<number>(1);
  const [prodNotes, setProdNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const findRecipeForProduct = (prod: Product | null | undefined): Recipe | undefined => {
    if (!prod) return undefined;
    if (prod.recipeId && recipesMap.get(prod.recipeId)) {
      return recipesMap.get(prod.recipeId);
    }
    if (recipesMap.get(prod.id)) {
      return recipesMap.get(prod.id);
    }
    const nameLower = prod.name.trim().toLowerCase();
    return recipes.find(
      (r) =>
        r.productId === prod.id ||
        (prod.recipeId && r.id === prod.recipeId) ||
        (r.productName && r.productName.trim().toLowerCase() === nameLower)
    );
  };

  // Filter products that are Produk Hasil Produksi (strictly excluding Menu POS and Raw/Packaging)
  const producibleProducts = useMemo(() => {
    return products.filter((p) => {
      if (isRawOrPackagingProduct(p)) return false;
      if (isPosMenuProduct(p, recipes, assemblies)) return false;
      if (assembliesMap.has(p.id) || (p.compositionItems && p.compositionItems.length > 0)) {
        return false;
      }
      if (isProductionOutputProduct(p, recipes)) return true;
      const recipe = findRecipeForProduct(p);
      if (recipe) return true;
      return false;
    });
  }, [products, recipes, recipesMap, assemblies, assembliesMap]);

  // Selected product's recipe
  const activeRecipe = useMemo<Recipe | undefined>(() => {
    return findRecipeForProduct(selectedProduct);
  }, [selectedProduct, recipes, recipesMap]);

  // Selected product's patokan batch details (Reference Ingredient or Product yield itself)
  const patokanInfo = useMemo(() => {
    if (!activeRecipe) return null;
    const { patokanIngredientId, patokanIngredientName, batchItems, yieldQty, yieldUnit } = activeRecipe;
    if (!patokanIngredientId) return null;

    if (patokanIngredientId === 'PRODUCT') {
      return {
        id: 'PRODUCT',
        name: selectedProduct?.name || patokanIngredientName || 'Hasil Produksi',
        unit: yieldUnit || 'pcs',
        quantityInOneBatch: yieldQty || 1,
      };
    }

    const itemInRecipe = batchItems?.find(it => it.ingredientId === patokanIngredientId);
    if (itemInRecipe) {
      return {
        id: patokanIngredientId,
        name: itemInRecipe.ingredientName,
        unit: itemInRecipe.unit || 'kg',
        quantityInOneBatch: itemInRecipe.quantity || 1,
      };
    }

    return null;
  }, [activeRecipe, selectedProduct]);

  // Synchronize patokan input value with batch count
  React.useEffect(() => {
    if (patokanInfo) {
      setPatokanInputVal(Number((batchCount * patokanInfo.quantityInOneBatch).toFixed(3)));
    }
  }, [patokanInfo, batchCount]);

  // Calculation for batch yield & unit name
  const yieldPerBatch = activeRecipe?.yieldQty || 1;
  const yieldUnit =
    activeRecipe?.yieldUnit ||
    selectedProduct?.stockUnit ||
    (selectedProduct?.name.toLowerCase().includes('teh') ||
    selectedProduct?.name.toLowerCase().includes('es')
      ? 'cup'
      : selectedProduct?.name.toLowerCase().includes('sambal') ||
        selectedProduct?.name.toLowerCase().includes('nasi')
      ? 'porsi'
      : 'pcs');
  const totalYield =
    typeof actualYield === 'number' && !isNaN(actualYield) ? Math.max(0, actualYield) : 0;
  const effectiveBatches =
    yieldPerBatch > 0 ? totalYield / yieldPerBatch : Math.max(0, batchCount || 1);

  const formatCleanQty = (val: number): string => {
    if (typeof val !== 'number' || isNaN(val)) return '0';
    const rounded = Number(val.toFixed(4));
    return formatNumber(rounded);
  };

  // Compute ingredient requirement for batchCount + actual yield packaging & check stock sufficiency
  interface MaterialReqItem {
    ingredientId: string;
    name: string;
    unit: string;
    qtyPerBatch: number;
    totalNeeded: number;
    currentStock: number;
    isSufficient: boolean;
    costPerUnit: number;
    subtotal: number;
    type: 'RAW' | 'PACKAGING';
  }

  const materialRequirements = useMemo<MaterialReqItem[]>(() => {
    if (!activeRecipe) return [];
    
    // Check if batchItems exist
    if (activeRecipe.batchItems && activeRecipe.batchItems.length > 0) {
      // 1. Raw materials scaled by effectiveBatches
      const list: MaterialReqItem[] = activeRecipe.batchItems.map(item => {
        const ing = ingredientsMap.get(item.ingredientId);
        const currentStock = ing ? ing.stock : 0;
        const totalNeeded = item.quantity * effectiveBatches;
        const isSufficient = currentStock >= totalNeeded;
        const costPerUnit = item.costPerUnit || (ing ? ing.costPerUnit : 0);
        const subtotal = totalNeeded * costPerUnit;

        return {
          ingredientId: item.ingredientId,
          name: item.ingredientName,
          unit: item.unit,
          qtyPerBatch: item.quantity,
          totalNeeded,
          currentStock,
          isSufficient,
          costPerUnit,
          subtotal,
          type: 'RAW',
        };
      });

      // 2. Portion/packaging items (calculated based on actual yield produced)
      if (activeRecipe.portionItems && activeRecipe.portionItems.length > 0) {
        activeRecipe.portionItems.forEach(item => {
          const ing = ingredientsMap.get(item.ingredientId);
          const currentStock = ing ? ing.stock : 0;
          const totalNeeded = item.quantity * totalYield;
          const isSufficient = currentStock >= totalNeeded;
          const costPerUnit = item.costPerUnit || (ing ? ing.costPerUnit : 0);
          const subtotal = totalNeeded * costPerUnit;

          list.push({
            ingredientId: item.ingredientId,
            name: item.ingredientName,
            unit: item.unit,
            qtyPerBatch: item.quantity * yieldPerBatch,
            totalNeeded,
            currentStock,
            isSufficient,
            costPerUnit,
            subtotal,
            type: 'PACKAGING',
          });
        });
      }

      return list;
    }

    // Fallback if only legacy items exist
    if (activeRecipe.items && activeRecipe.items.length > 0) {
      return activeRecipe.items.map(item => {
        const ing = ingredientsMap.get(item.ingredientId);
        const currentStock = ing ? ing.stock : 0;
        const totalNeeded = item.quantity * totalYield;
        const isSufficient = currentStock >= totalNeeded;
        const costPerUnit = item.costPerUnit || (ing ? ing.costPerUnit : 0);
        const subtotal = totalNeeded * costPerUnit;

        return {
          ingredientId: item.ingredientId,
          name: item.ingredientName,
          unit: item.unit,
          qtyPerBatch: item.quantity * yieldPerBatch,
          totalNeeded,
          currentStock,
          isSufficient,
          costPerUnit,
          subtotal,
          type: 'RAW',
        };
      });
    }

    return [];
  }, [activeRecipe, totalYield, effectiveBatches, yieldPerBatch, ingredientsMap]);

  const rawMaterials = useMemo(() => materialRequirements.filter(m => m.type === 'RAW'), [materialRequirements]);
  const packMaterials = useMemo(() => materialRequirements.filter(m => m.type === 'PACKAGING'), [materialRequirements]);

  // Check if all ingredients are sufficient
  const canProduce = useMemo(() => {
    if (totalYield <= 0) return false;
    if (materialRequirements.length === 0) return true;
    return materialRequirements.every(m => m.isSufficient);
  }, [materialRequirements, totalYield]);

  // Compute batch HPP
  const batchCostSummary = useMemo(() => {
    const rawAndPackCost = materialRequirements.reduce((sum, item) => sum + item.subtotal, 0);
    const overheadPerUnit = activeRecipe?.overheadCostPerUnit || 0;
    const overheadTotal = overheadPerUnit * totalYield;
    const totalHpp = rawAndPackCost + overheadTotal;
    const hppPerUnit = totalYield > 0 ? Math.round(totalHpp / totalYield) : 0;

    return {
      rawAndPackCost,
      overheadTotal,
      totalHpp,
      hppPerUnit,
    };
  }, [materialRequirements, activeRecipe, totalYield]);

  // Open production modal for a product
  const handleOpenModal = (prod: Product) => {
    const recipe = findRecipeForProduct(prod);
    const standardYield = recipe?.yieldQty || 1;
    setSelectedProduct(prod);
    setBatchCount(1);
    setActualYield(standardYield);
    setProdNotes('');
    setErrorMessage(null);
  };

  const handleOpenCreateRecipe = (targetProd?: Product) => {
    if (!canEditRecipe) {
      alert('Akses Ditolak: Hanya ADMIN/OWNER yang berwenang mengatur resep & HPP.');
      return;
    }
    setEditingRecipe(targetProd ? findRecipeForProduct(targetProd) || null : null);
    setRecipeTargetProduct(targetProd || null);
    setShowRecipeModal(true);
  };

  const handleOpenEditRecipe = (recipe: Recipe, targetProd?: Product) => {
    if (!canEditRecipe) {
      alert('Akses Ditolak: Hanya ADMIN/OWNER yang berwenang mengubah resep & HPP.');
      return;
    }
    setEditingRecipe(recipe);
    setRecipeTargetProduct(targetProd || productsMap.get(recipe.productId) || null);
    setShowRecipeModal(true);
  };

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      if (
        recipeUnitFilter !== 'ALL' &&
        (r.yieldUnit || 'pcs').toLowerCase() !== recipeUnitFilter.toLowerCase()
      ) {
        return false;
      }
      if (recipeSearch.trim()) {
        const q = recipeSearch.toLowerCase();
        const matchName = r.productName.toLowerCase().includes(q);
        const matchIng = (r.batchItems || r.items || []).some((it) =>
          it.ingredientName.toLowerCase().includes(q)
        );
        if (!matchName && !matchIng) return false;
      }
      return true;
    });
  }, [recipes, recipeUnitFilter, recipeSearch]);

  const filteredProducibleProducts = useMemo(() => {
    return producibleProducts.filter((prod) => {
      const liveProd = productsMap.get(prod.id) || prod;
      const currentStock = liveProd.stock ?? 0;
      const isLow = currentStock <= (liveProd.minStock ?? 5);

      if (stockStatusFilter === 'SAFE' && isLow) return false;
      if (stockStatusFilter === 'LOW' && !isLow) return false;

      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        const recipe = findRecipeForProduct(liveProd);
        const matchName = liveProd.name.toLowerCase().includes(q);
        const matchSku = liveProd.sku?.toLowerCase().includes(q);
        const matchIng = (recipe?.batchItems || recipe?.items || []).some((it) =>
          it.ingredientName.toLowerCase().includes(q)
        );
        if (!matchName && !matchSku && !matchIng) return false;
      }
      return true;
    });
  }, [producibleProducts, productsMap, stockStatusFilter, productSearch, recipes, recipesMap]);

  const lowStockProdCount = useMemo(() => {
    return producibleProducts.filter((prod) => {
      const liveProd = productsMap.get(prod.id) || prod;
      return (liveProd.stock ?? 0) <= (liveProd.minStock ?? 5);
    }).length;
  }, [producibleProducts, productsMap]);

  const avgProdHpp = useMemo(() => {
    if (producibleProducts.length === 0) return 0;
    const sum = producibleProducts.reduce((acc, prod) => {
      const liveProd = productsMap.get(prod.id) || prod;
      const recipe = findRecipeForProduct(liveProd);
      const hpp = recipe
        ? calculateHPP(recipe, ingredientsMap) || recipe.totalHpp || liveProd.costPerUnit || 0
        : liveProd.costPerUnit || 0;
      return acc + hpp;
    }, 0);
    return Math.round(sum / producibleProducts.length);
  }, [producibleProducts, productsMap, recipes, recipesMap, ingredientsMap]);

  // Submit production
  const handleConfirmProduction = async () => {
    if (!selectedProduct) return;
    if (!canProduce) {
      setErrorMessage('Stok bahan baku tidak mencukupi untuk hasil produksi yang ditentukan.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const prod = await submitGeneralProduction(selectedProduct.id, actualYield, prodNotes, effectiveBatches);
      setSuccessMessage(`Berhasil memproduksi ${prod.totalProduced} ${yieldUnit} ${prod.productName}! Stok produk bertambah.`);
      setSelectedProduct(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal memproses produksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Chicken Production State
  const rawChicken = ingredientsMap.get('ing_ayam_raw');
  const prepChicken = ingredientsMap.get('ing_ayam_ready');
  const [chickenRawKg, setChickenRawKg] = useState<number>(20);
  const [chickenPrepPcs, setChickenPrepPcs] = useState<number>(157);
  const [chickenNotes, setChickenNotes] = useState<string>('Potong standar geprek 1 ekor jadi 8-9 potong');
  const [isChickenSubmitting, setIsChickenSubmitting] = useState(false);

  const chickenRatio = chickenRawKg > 0 ? Number((chickenPrepPcs / chickenRawKg).toFixed(2)) : 0;

  const handleChickenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chickenRawKg <= 0 || chickenPrepPcs <= 0) {
      alert('Jumlah kg ayam mentah dan jumlah potong harus lebih dari 0.');
      return;
    }

    if (rawChicken && chickenRawKg > rawChicken.stock) {
      alert(`Stok Ayam Mentah tidak cukup. Tersedia: ${rawChicken.stock} kg, diminta: ${chickenRawKg} kg.`);
      return;
    }

    setIsChickenSubmitting(true);
    try {
      await submitChickenProduction(chickenRawKg, chickenPrepPcs, chickenNotes);
      setSuccessMessage(`Produksi ayam berhasil! Menghasilkan ${chickenPrepPcs} potong ayam siap jual (Yield: ${chickenRatio} pcs/kg).`);
      setChickenNotes('Potong standar geprek');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memproses produksi ayam');
    } finally {
      setIsChickenSubmitting(false);
    }
  };

  // Product Stock Opname State
  const [opnameProduct, setOpnameProduct] = useState<Product | null>(null);
  const [opnamePhysical, setOpnamePhysical] = useState<number>(0);
  const [opnameReason, setOpnameReason] = useState<string>('Penyesuaian fisik dapur');
  const [isOpnameSubmitting, setIsOpnameSubmitting] = useState(false);

  const handleProductOpnameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opnameProduct) return;

    setIsOpnameSubmitting(true);
    try {
      await submitProductStockOpname(opnameProduct, opnamePhysical, opnameReason);
      setSuccessMessage(`Stok ${opnameProduct.name} berhasil disesuaikan menjadi ${opnamePhysical} unit.`);
      setOpnameProduct(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyesuaikan stok produk');
    } finally {
      setIsOpnameSubmitting(false);
    }
  };

  const handleCancelProduction = async () => {
    if (!cancellingProduction) return;
    setIsCancelling(true);
    try {
      await cancelGeneralProduction(cancellingProduction.id, cancelReasonInput);
      setSuccessMessage(
        `Produksi ${cancellingProduction.productName} berhasil dibatalkan. Stok bahan baku telah dikembalikan.`
      );
      setCancellingProduction(null);
      setCancelReasonInput('');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal membatalkan produksi');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCancelChickenBatch = async () => {
    if (!cancellingChickenBatch) return;
    setIsCancelling(true);
    try {
      await cancelChickenProduction(cancellingChickenBatch.id, cancelReasonInput);
      setSuccessMessage(
        `Batch pemotongan ayam (${cancellingChickenBatch.rawQuantity} kg) berhasil dibatalkan. Stok ayam mentah telah dikembalikan.`
      );
      setCancellingChickenBatch(null);
      setCancelReasonInput('');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal membatalkan pemotongan ayam');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <PageContainer
      className="pb-32"
      onClick={() => {
        if (openActionMenuId) setOpenActionMenuId(null);
      }}
    >
      {/* PageHeader */}
      <PageHeader
        title="Produksi & Resep"
        description="Kelola resep produk olahan dapur, HPP per porsi, dan pencatatan produksi harian."
        actions={
          canEditRecipe ? (
            <button
              type="button"
              onClick={() => handleOpenCreateRecipe()}
              className="h-9 px-3.5 rounded-lg bg-[#FF5A1F] hover:bg-[#E04F16] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Buat Produk</span>
            </button>
          ) : undefined
        }
      />

      {/* Compact SummaryBar */}
      <SummaryBar
        items={[
          {
            label: 'Produk Produksi',
            value: `${producibleProducts.length} Produk`,
          },
          {
            label: 'Total Resep',
            value: `${recipes.length} Resep`,
          },
          {
            label: 'Stok Rendah',
            value: `${lowStockProdCount} Produk`,
            valueClassName:
              lowStockProdCount > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]',
          },
        ]}
      />

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5] text-[#12B76A] text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-[#12B76A] p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'products' && (
        <div className="space-y-3">
          {/* Compact Search & Horizontal Scroll Filter Bar */}
          <div className="bg-white rounded-2xl border border-[#E8ECF2] p-3 shadow-2xs space-y-2.5">
            {/* Full-width Search Bar */}
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Cari produk produksi atau nama bahan baku..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF6B22] focus:bg-white transition"
              />
            </div>

            {/* Horizontal Scroll Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap shrink-0 pb-0.5 no-scrollbar">
              {[
                { id: 'ALL', label: `Semua (${producibleProducts.length})` },
                { id: 'SAFE', label: `Stok Aman (${Math.max(0, producibleProducts.length - lowStockProdCount)})` },
                { id: 'LOW', label: `Stok Rendah (${lowStockProdCount})` },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStockStatusFilter(st.id as 'ALL' | 'SAFE' | 'LOW')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    stockStatusFilter === st.id
                      ? 'bg-[#172033] text-white'
                      : 'bg-[#F7F8FA] text-[#667085] hover:bg-[#E8ECF2]'
                  }`}
                >
                  {st.label}
                </button>
              ))}

              <span className="text-[#CBD5E1] shrink-0">|</span>

              <button
                type="button"
                onClick={() => setActiveTab('chicken')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 bg-[#F7F8FA] text-[#667085] hover:bg-[#E8ECF2] hover:text-[#172033] cursor-pointer flex items-center gap-1"
              >
                <Flame className="w-3 h-3 text-[#FF6B22]" />
                <span>Potong Ayam</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 bg-[#F7F8FA] text-[#667085] hover:bg-[#E8ECF2] hover:text-[#172033] cursor-pointer flex items-center gap-1"
              >
                <History className="w-3 h-3 text-[#667085]" />
                <span>Riwayat</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('opname')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 bg-[#F7F8FA] text-[#667085] hover:bg-[#E8ECF2] hover:text-[#172033] cursor-pointer flex items-center gap-1"
              >
                <Sliders className="w-3 h-3 text-[#667085]" />
                <span>Stok Opname</span>
              </button>
            </div>
          </div>

          {filteredProducibleProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8ECF2] p-10 text-center space-y-2">
              <Factory className="w-8 h-8 text-[#98A2B3] mx-auto" />
              <p className="text-sm font-bold text-[#172033]">Tidak ada produk hasil produksi</p>
              <p className="text-xs text-[#667085]">
                Coba ubah kata kunci pencarian atau buat resep produk produksi baru.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs overflow-visible">
              {/* DESKTOP COMPACT TABLE-LIST */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8ECF2] bg-[#F8FAFC] text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                      <th className="py-2.5 pl-4 pr-3">Produk</th>
                      <th className="py-2.5 px-3">Batch</th>
                      <th className="py-2.5 px-3 text-right">HPP/Unit</th>
                      <th className="py-2.5 px-3 text-right">Stok</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 pl-3 pr-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8ECF2] text-xs">
                    {filteredProducibleProducts.map((product) => {
                      const liveProd = productsMap.get(product.id) || product;
                      const recipe = findRecipeForProduct(liveProd);
                      const currentStock = liveProd.stock ?? 0;
                      const yieldQty = recipe?.yieldQty || 1;
                      const rUnit =
                        recipe?.yieldUnit ||
                        liveProd.stockUnit ||
                        (product.name.toLowerCase().includes('teh') ||
                        product.name.toLowerCase().includes('es')
                          ? 'cup'
                          : product.name.toLowerCase().includes('sambal') ||
                            product.name.toLowerCase().includes('nasi')
                          ? 'porsi'
                          : 'pcs');
                      const isLowStock = currentStock <= (liveProd.minStock ?? 5);
                      const liveHpp = recipe
                        ? calculateHPP(recipe, ingredientsMap) ||
                          recipe.totalHpp ||
                          liveProd.costPerUnit ||
                          0
                        : liveProd.costPerUnit || 0;
                      const recipeItems = recipe?.batchItems?.length
                        ? recipe.batchItems
                        : recipe?.items || [];

                      return (
                        <tr
                          key={product.id}
                          onClick={() => handleOpenModal(liveProd)}
                          className="hover:bg-[#F8FAFC] transition cursor-pointer group"
                        >
                          {/* PRODUK */}
                          <td className="py-2.5 pl-4 pr-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={getProductImageUrl(product.name)}
                                alt={product.name}
                                className="w-9 h-9 rounded-lg object-cover border border-[#E8ECF2] shrink-0"
                                loading="lazy"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-[#172033] group-hover:text-[#FF641F] transition block truncate">
                                  {product.name}
                                </span>
                                <span className="text-[11px] text-[#667085] block truncate max-w-xs">
                                  {recipeItems.length > 0
                                    ? `${recipeItems.length} bahan (${recipeItems
                                        .slice(0, 3)
                                        .map((it) => it.ingredientName)
                                        .join(', ')}${recipeItems.length > 3 ? '...' : ''})`
                                    : 'Resep belum diatur'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* BATCH */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {recipe ? (
                              <span className="font-semibold text-[#172033]">
                                1 batch = <strong>{yieldQty} {rUnit}</strong>
                              </span>
                            ) : (
                              <span className="text-amber-600 font-semibold text-[11px]">
                                Belum diatur
                              </span>
                            )}
                          </td>

                          {/* HPP/UNIT */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[#172033]">
                            {formatRupiah(liveHpp)}
                            <span className="text-[10px] font-normal text-[#667085]">/{rUnit}</span>
                          </td>

                          {/* STOK */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span
                              className={`font-extrabold ${
                                currentStock <= 0
                                  ? 'text-[#F04438]'
                                  : isLowStock
                                  ? 'text-[#F79009]'
                                  : 'text-[#172033]'
                              }`}
                            >
                              {formatNumber(currentStock)}
                            </span>{' '}
                            <span className="text-[11px] text-[#667085]">{rUnit}</span>
                          </td>

                          {/* STATUS */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {currentStock <= 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FEF3F2] text-[#F04438] border border-[#FECDCA] text-[11px] font-bold">
                                Habis
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                                Rendah
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ECFDF3] text-[#12B76A] border border-[#ABEFC6] text-[11px] font-bold">
                                Aman
                              </span>
                            )}
                          </td>

                          {/* AKSI */}
                          <td
                            className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-end gap-1.5 relative">
                              <button
                                type="button"
                                onClick={() => setRecipeToView({ product: liveProd, recipe })}
                                className="px-2.5 py-1 rounded-lg border border-[#E8ECF2] bg-white hover:bg-[#F8FAFC] text-[#172033] font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                              >
                                <ChefHat className="w-3 h-3 text-[#667085]" />
                                <span>Resep &amp; HPP</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  recipe
                                    ? handleOpenModal(liveProd)
                                    : handleOpenCreateRecipe(liveProd)
                                }
                                className="px-2.5 py-1 rounded-lg bg-[#FF641F] hover:bg-[#F45116] text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                              >
                                <Factory className="w-3 h-3" />
                                <span>{recipe ? 'Produksi' : 'Atur Resep'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionMenuId(
                                    openActionMenuId === product.id ? null : product.id
                                  )
                                }
                                className="p-1.5 rounded-lg border border-[#E8ECF2] bg-white hover:bg-[#F8FAFC] text-[#667085] hover:text-[#172033] transition cursor-pointer"
                                title="Aksi lainnya"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>

                              {openActionMenuId === product.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-[#E8ECF2] shadow-lg py-1 z-30 text-left">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleOpenModal(liveProd);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs font-semibold text-[#172033] hover:bg-[#F8FAFC] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Factory className="w-3.5 h-3.5 text-[#FF641F]" />
                                    <span>Detail &amp; Produksi</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setRecipeToView({ product: liveProd, recipe });
                                    }}
                                    className="w-full px-3 py-1.5 text-xs font-semibold text-[#172033] hover:bg-[#F8FAFC] flex items-center gap-2 cursor-pointer"
                                  >
                                    <ChefHat className="w-3.5 h-3.5 text-[#667085]" />
                                    <span>Lihat Resep &amp; HPP</span>
                                  </button>
                                  {canEditRecipe && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        if (recipe) {
                                          handleOpenEditRecipe(recipe, liveProd);
                                        } else {
                                          handleOpenCreateRecipe(liveProd);
                                        }
                                      }}
                                      className="w-full px-3 py-1.5 text-xs font-semibold text-[#172033] hover:bg-[#F8FAFC] flex items-center gap-2 cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-[#FF641F]" />
                                      <span>Edit Formula Resep</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setOpnameProduct(liveProd);
                                      setOpnamePhysical(liveProd.stock ?? 0);
                                      setOpnameReason('Stok Opname Fisik');
                                    }}
                                    className="w-full px-3 py-1.5 text-xs font-semibold text-[#172033] hover:bg-[#F8FAFC] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Sliders className="w-3.5 h-3.5 text-[#667085]" />
                                    <span>Sesuaikan Stok Fisik</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE COMPACT VERTICAL LIST */}
              <div className="md:hidden divide-y divide-[#E8ECF2]">
                {filteredProducibleProducts.map((product) => {
                  const liveProd = productsMap.get(product.id) || product;
                  const recipe = findRecipeForProduct(liveProd);
                  const currentStock = liveProd.stock ?? 0;
                  const yieldQty = recipe?.yieldQty || 1;
                  const rUnit =
                    recipe?.yieldUnit ||
                    liveProd.stockUnit ||
                    (product.name.toLowerCase().includes('teh') ||
                    product.name.toLowerCase().includes('es')
                      ? 'cup'
                      : product.name.toLowerCase().includes('sambal') ||
                        product.name.toLowerCase().includes('nasi')
                      ? 'porsi'
                      : 'pcs');
                  const isLowStock = currentStock <= (liveProd.minStock ?? 5);
                  const liveHpp = recipe
                    ? calculateHPP(recipe, ingredientsMap) ||
                      recipe.totalHpp ||
                      liveProd.costPerUnit ||
                      0
                    : liveProd.costPerUnit || 0;

                  return (
                    <div
                      key={product.id}
                      onClick={() => handleOpenModal(liveProd)}
                      className="p-3 hover:bg-[#F8FAFC] transition flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <img
                          src={getProductImageUrl(product.name)}
                          alt={product.name}
                          className="w-10 h-10 rounded-xl object-cover border border-[#E8ECF2] shrink-0 mt-0.5"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-xs text-[#172033] truncate">
                              {product.name}
                            </h3>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                currentStock <= 0
                                  ? 'bg-[#FEF3F2] text-[#F04438]'
                                  : isLowStock
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-[#ECFDF3] text-[#12B76A]'
                              }`}
                            >
                              {currentStock <= 0 ? 'Habis' : isLowStock ? 'Rendah' : 'Aman'}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                            <span className="text-[#667085]">
                              1 batch = <strong className="text-[#172033]">{yieldQty} {rUnit}</strong>
                            </span>
                            <span className="text-[#CBD5E1]">&bull;</span>
                            <span className="font-bold text-[#FF6B22]">
                              HPP {formatRupiah(liveHpp)}/{rUnit}
                            </span>
                          </div>

                          <div className="mt-0.5 text-[11px] text-[#667085]">
                            Stok:{' '}
                            <strong className="text-[#172033]">
                              {formatCleanQty(currentStock)} {rUnit}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setRecipeToView({ product: liveProd, recipe })}
                          className="px-2.5 py-1.5 rounded-lg border border-[#E2E6EC] bg-white text-[#172033] font-bold text-[11px] hover:bg-[#F7F8FA] transition cursor-pointer"
                        >
                          Resep
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            recipe
                              ? handleOpenModal(liveProd)
                              : handleOpenCreateRecipe(liveProd)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#FF6B22] hover:bg-[#F45116] text-white font-bold text-[11px] transition cursor-pointer"
                        >
                          Produksi
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECONDARY TAB: PEMOTONGAN AYAM MENTAH                                    */}
      {/* ========================================================================= */}
      {activeTab === 'chicken' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-[#E8ECF2] shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className="text-xs font-bold text-[#FF6B22] flex items-center gap-1.5 hover:underline cursor-pointer"
            >
              &larr; Kembali ke Daftar Produk
            </button>
          </div>
          {/* Overview Cards: Current Raw Stock vs Current Prepared Stock */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Stok Ayam Mentah
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {rawChicken ? formatNumber(rawChicken.stock) : 0}
                </span>
                <span className="text-xs font-bold text-slate-500">kg</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Siap untuk dipotong</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Stok Ayam Siap Jual
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                  {prepChicken ? formatNumber(prepChicken.stock) : 0}
                </span>
                <span className="text-xs font-bold text-slate-500">potong</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Tersedia di etalase</span>
            </div>

            <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Yield Ratio Terakhir
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {stockProductions.length > 0 ? stockProductions[0].yieldRatio : 7.85}
                </span>
                <span className="text-xs font-bold text-slate-500">potong / kg</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Standar ideal: 7.8 - 8.0</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Form Input Pemotongan */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <span>Catat Batch Pemotongan Ayam</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Konversi Ayam Mentah (kg) menjadi Ayam Siap Jual (potong) beserta audit efisiensi susut
              </p>

              <form onSubmit={handleChickenSubmit} className="space-y-4">
                <div className="p-3 bg-orange-50/60 dark:bg-orange-950/30 rounded-2xl border border-orange-100 dark:border-orange-900/60 flex items-center justify-between text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Ayam Mentah</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">{chickenRawKg} kg</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-orange-500 mx-2" />
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Ayam Siap Jual</span>
                    <span className="text-base font-black text-orange-600">{chickenPrepPcs} potong</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Ayam Mentah (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={chickenRawKg === 0 ? '' : chickenRawKg}
                      onChange={e => setChickenRawKg(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                      placeholder="20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Hasil Potongan (Pcs) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={chickenPrepPcs === 0 ? '' : chickenPrepPcs}
                      onChange={e => setChickenPrepPcs(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                      placeholder="157"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      Rasio Hasil (Yield Ratio):
                    </span>
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      {chickenRatio} potong / kg
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {chickenRatio >= 7.5 && chickenRatio <= 8.5
                      ? 'Ideal (Standar 7.8 - 8.0 potong/kg)'
                      : chickenRatio < 7.5
                      ? 'Rendah (Potongan besar / susut tinggi)'
                      : 'Tinggi (Potongan kecil)'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Catatan Batch / Shift (Opsional)
                  </label>
                  <input
                    type="text"
                    value={chickenNotes}
                    onChange={e => setChickenNotes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    placeholder="Contoh: Pemotongan pagi untuk shift 1"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isChickenSubmitting}
                  className="w-full py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-600/30 transition disabled:opacity-50"
                >
                  <Flame className="w-4 h-4" />
                  <span>{isChickenSubmitting ? 'Memproses...' : 'SIMPAN PRODUKSI AYAM'}</span>
                </button>
              </form>
            </div>
            {/* Riwayat Batch Pemotongan Ayam */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <History className="w-4 h-4 text-orange-600" />
                  <span>Riwayat Batch Pemotongan Ayam</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Total {formatNumber(stockProductions.length)} batch
                </span>
              </div>

              <div className="space-y-2.5 max-h-[48vh] overflow-y-auto">
                {stockProductions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Flame className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Belum ada riwayat batch produksi ayam.</p>
                  </div>
                ) : (
                  stockProductions.map(batch => {
                    const isCancelled = batch.status === 'CANCELLED';
                    return (
                      <div
                        key={batch.id}
                        className={`p-3 rounded-2xl border text-xs space-y-1.5 transition ${
                          isCancelled
                            ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 opacity-80'
                            : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-slate-900 dark:text-white ${isCancelled ? 'line-through text-slate-500' : ''}`}>
                              {formatNumber(batch.rawQuantity)} kg Mentah &rarr; {formatNumber(batch.preparedQuantity)} Potong
                            </span>
                            {isCancelled ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                                DIBATALKAN
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400">
                                {batch.yieldRatio} pcs/kg
                              </span>
                            )}
                          </div>

                          {!isCancelled && isOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancellingChickenBatch(batch);
                                setCancelReasonInput('Salah input / Pembatalan pemotongan ayam');
                              }}
                              className="px-2 py-1 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 font-bold text-[10px] flex items-center gap-1 transition cursor-pointer shrink-0"
                              title="Khusus Owner: Batalkan pemotongan ayam dan kembalikan stok kg mentah"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Batalkan</span>
                            </button>
                          )}
                        </div>

                        <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{formatDateTimeIndonesian(batch.createdAt)}</span>
                          <span className="italic">{batch.notes || 'Standar'}</span>
                        </div>

                        {isCancelled && (
                          <div className="p-2 rounded-xl bg-red-100/60 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-[10px] text-red-800 dark:text-red-300 font-medium">
                            Dibatalkan pada {formatDateTimeIndonesian(batch.cancelledAt || '')} oleh {batch.cancelledByName || 'Owner'}.
                            Stok {batch.rawQuantity} kg mentah telah dikembalikan ke gudang.
                            {batch.cancelReason && <span className="block mt-0.5 italic">Alasan: {batch.cancelReason}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECONDARY TAB: RIWAYAT PRODUKSI                                           */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-[#E8ECF2] shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className="text-xs font-bold text-[#FF6B22] flex items-center gap-1.5 hover:underline cursor-pointer"
            >
              &larr; Kembali ke Daftar Produk
            </button>
            {isOwner && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                Mode Owner: Memiliki hak akses pembatalan produksi &amp; pengembalian stok bahan
              </span>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-[#FF6B22]" />
              <span>Log Transaksi Produksi Produk Jadi</span>
            </h3>

            {productions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Factory className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold">Belum ada riwayat produksi produk jadi.</p>
                <p className="text-[11px]">Silakan lakukan produksi pertama di tab Produk Jadi.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {productions.map(prod => {
                  const isCancelled = prod.status === 'CANCELLED';
                  return (
                    <div
                      key={prod.id}
                      className={`py-3.5 space-y-2.5 transition rounded-2xl p-3 my-1 border ${
                        isCancelled
                          ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                          : 'bg-white dark:bg-slate-900 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-extrabold text-xs text-slate-900 dark:text-white ${isCancelled ? 'line-through text-slate-500' : ''}`}>
                              {prod.productName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                isCancelled
                                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  : 'bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300'
                              }`}
                            >
                              +{prod.totalProduced} {prod.yieldUnit || 'unit'}
                            </span>
                            {isCancelled ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                <span>DIBATALKAN</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>SELESAI</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {formatDateTimeIndonesian(prod.createdAt)} &bull; {prod.batchQty} Batch &bull; Oleh: {prod.userName || prod.createdByName || 'Admin'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-black text-xs text-slate-900 dark:text-white block">
                              Total HPP: {formatRupiah(prod.totalHpp)}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                              HPP/{prod.yieldUnit || 'unit'}: {formatRupiah(prod.hppPerUnit)}
                            </span>
                          </div>

                          {!isCancelled && isOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancellingProduction(prod);
                                setCancelReasonInput('Salah input / Pembatalan batch produksi');
                              }}
                              className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                              title="Khusus Akun Owner: Batalkan produksi dan kembalikan stok bahan baku"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                              <span>Batalkan Produksi</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isCancelled && (
                        <div className="p-3 rounded-xl bg-red-100/70 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-xs text-red-900 dark:text-red-200 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">
                              Produksi ini telah dibatalkan pada {formatDateTimeIndonesian(prod.cancelledAt || '')} oleh {prod.cancelledByName || 'Owner'}.
                            </span>
                            <span className="text-[11px] text-red-700 dark:text-red-300 block mt-0.5">
                              Stok bahan baku di bawah telah dikembalikan ke persediaan dan stok {prod.productName} telah dikurangi (-{prod.totalProduced} {prod.yieldUnit || 'unit'}).
                            </span>
                            {prod.cancelReason && (
                              <span className="text-[11px] font-semibold italic text-red-800 dark:text-red-200 block mt-1">
                                Catatan pembatalan: &quot;{prod.cancelReason}&quot;
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Snapshot of items consumed */}
                      {((prod.items && prod.items.length > 0) || (prod.itemsConsumed && prod.itemsConsumed.length > 0)) && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-2.5 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider block">
                              Bahan Baku yang Dikonsumsi (Snapshot):
                            </span>
                            {isCancelled && (
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                                (Semua bahan telah dikembalikan ke stok)
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(prod.items || prod.itemsConsumed || []).map((item, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center justify-between px-2 py-1 rounded-lg border text-[11px] ${
                                  isCancelled
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300'
                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span className="font-medium truncate">
                                  {item.ingredientName}
                                </span>
                                <span className={`font-bold ml-1 shrink-0 ${isCancelled ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-500'}`}>
                                  {isCancelled ? `+${item.quantity}` : `-${item.quantity}`} {item.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECONDARY TAB: STOK OPNAME PRODUK JADI                                    */}
      {/* ========================================================================= */}
      {activeTab === 'opname' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-[#E8ECF2] shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className="text-xs font-bold text-[#FF6B22] flex items-center gap-1.5 hover:underline cursor-pointer"
            >
              &larr; Kembali ke Daftar Produk
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#FF6B22]" />
              <span>Stok Opname Produk Jadi</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Sesuaikan stok produk di etalase jika ada selisih fisik, basi, atau tumpah
            </p>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {producibleProducts.map(prod => {
                const liveProd = productsMap.get(prod.id) || prod;
                return (
                  <div key={prod.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={getProductImageUrl(prod.name)}
                        alt={prod.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shrink-0"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white block">
                          {prod.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Stok Sistem: <b className="text-slate-700 dark:text-slate-200">{liveProd.stock ?? 0}</b> unit
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setOpnameProduct(liveProd);
                        setOpnamePhysical(liveProd.stock ?? 0);
                        setOpnameReason('Stok Opname Fisik');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/50 text-slate-700 dark:text-slate-300 hover:text-orange-600 font-bold text-xs border border-slate-200 dark:border-slate-700 transition"
                    >
                      Sesuaikan Stok
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PRODUKSI AKTUAL (COMPACT & MOBILE-FIRST)                            */}
      {/* ========================================================================= */}
      {selectedProduct && (() => {
        const liveSelected = productsMap.get(selectedProduct.id) || selectedProduct;
        const currentStock = liveSelected.stock ?? 0;
        const newStockAfterProd = Math.round((currentStock + totalYield) * 1000) / 1000;

        return (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <div
              className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[#E2E6EC] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. COMPACT HEADER */}
              <div className="px-4 py-3.5 border-b border-[#E2E6EC] flex items-center justify-between gap-3 bg-white shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={getProductImageUrl(liveSelected.name)}
                    alt={liveSelected.name}
                    className="w-11 h-11 rounded-xl object-cover border border-[#E2E6EC] shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-[15px] text-[#172033] leading-snug truncate">
                      {liveSelected.name}
                    </h3>
                    <p className="text-xs text-[#667085] mt-0.5">
                      Stok saat ini:{' '}
                      <strong className="text-[#172033]">
                        {formatCleanQty(currentStock)} {yieldUnit}
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#667085] hover:text-[#172033] hover:bg-[#F7F8FA] transition cursor-pointer shrink-0"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2. MODAL BODY */}
              <div className="p-4 space-y-4 overflow-y-auto">
                {/* INPUT JUMLAH PRODUKSI AKTUAL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-[#172033] uppercase tracking-wider">
                      Jumlah Produksi
                    </label>
                    {activeRecipe && (
                      <span className="text-[11px] text-[#667085] font-medium">
                        Acuan resep: 1 batch = {formatCleanQty(yieldPerBatch)} {yieldUnit}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextYield = Math.max(1, Math.round((totalYield - 1) * 100) / 100);
                        setActualYield(nextYield);
                        setBatchCount(nextYield / yieldPerBatch);
                      }}
                      className="w-11 h-11 rounded-xl bg-[#F7F8FA] border border-[#E2E6EC] flex items-center justify-center text-[#172033] font-bold hover:bg-[#E8ECF2] active:scale-95 transition cursor-pointer shrink-0"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <div className="flex-1 h-11 rounded-xl border border-[#FF6B22] bg-white px-3 flex items-center justify-center gap-1.5 shadow-2xs">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={actualYield === 0 ? '' : actualYield}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setActualYield(0);
                            setBatchCount(0);
                            return;
                          }
                          const val = parseFloat(raw);
                          const cleanVal = isNaN(val) ? 0 : Math.max(0, val);
                          setActualYield(cleanVal);
                          setBatchCount(cleanVal / yieldPerBatch);
                        }}
                        placeholder="0"
                        className="w-24 text-center font-extrabold text-base text-[#172033] focus:outline-none"
                      />
                      <span className="text-xs font-bold text-[#667085] shrink-0">
                        {yieldUnit}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextYield = Math.round((totalYield + 1) * 100) / 100;
                        setActualYield(nextYield);
                        setBatchCount(nextYield / yieldPerBatch);
                      }}
                      className="w-11 h-11 rounded-xl bg-[#F7F8FA] border border-[#E2E6EC] flex items-center justify-center text-[#172033] font-bold hover:bg-[#E8ECF2] active:scale-95 transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* BAHAN YANG DIGUNAKAN (PROPORSIONAL) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-[#172033] uppercase tracking-wider">
                      Bahan yang Digunakan
                    </span>
                    <span className="text-[11px] text-[#667085]">
                      Otomatis proporsional
                    </span>
                  </div>

                  {materialRequirements.length > 0 ? (
                    <div className="bg-[#F7F8FA] rounded-xl border border-[#E2E6EC] divide-y divide-[#E2E6EC] overflow-hidden">
                      {materialRequirements.map((mat, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-[#172033] block truncate">
                              {mat.name}
                            </span>
                            {!mat.isSufficient && (
                              <span className="text-[10px] text-[#F04438] font-semibold block">
                                Stok kurang (tersedia: {formatCleanQty(mat.currentStock)} {mat.unit})
                              </span>
                            )}
                          </div>
                          <span
                            className={`font-bold shrink-0 ${
                              mat.isSufficient ? 'text-[#172033]' : 'text-[#F04438]'
                            }`}
                          >
                            -{formatCleanQty(mat.totalNeeded)} {mat.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      Resep belum diatur untuk produk ini. Silakan atur melalui tombol <strong>Resep</strong>.
                    </div>
                  )}
                </div>

                {/* STOK SETELAH PRODUKSI */}
                <div className="bg-[#F7F8FA] rounded-xl border border-[#E2E6EC] px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-[#667085] uppercase tracking-wider">
                    Stok Setelah Produksi
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#172033]">
                    <span>
                      {formatCleanQty(currentStock)} {yieldUnit}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#667085]" />
                    <span className="text-[#12B76A] font-extrabold">
                      {formatCleanQty(newStockAfterProd)} {yieldUnit} (+{formatCleanQty(totalYield)} {yieldUnit})
                    </span>
                  </div>
                </div>

                {/* CATATAN PRODUKSI (OPSIONAL) */}
                <div>
                  <label className="text-xs font-semibold text-[#667085] block mb-1">
                    Catatan (opsional)
                  </label>
                  <input
                    type="text"
                    value={prodNotes}
                    onChange={(e) => setProdNotes(e.target.value)}
                    placeholder="Contoh: Shift pagi / masak 1 wajan"
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E6EC] bg-white text-xs text-[#172033] focus:outline-none focus:border-[#FF6B22]"
                  />
                </div>

                {/* ERROR MESSAGE IF ANY */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-[#F04438] text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* 3. MODAL FOOTER ACTIONS */}
              <div className="px-4 py-3 border-t border-[#E2E6EC] bg-white flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#E2E6EC] bg-white text-[#667085] font-bold text-xs hover:bg-[#F7F8FA] transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleConfirmProduction}
                  disabled={!canProduce || isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF6B22] hover:bg-[#F45116] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Memproses...'
                      : `Produksi Sekarang (+${formatCleanQty(totalYield)} ${yieldUnit})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Recipe Viewer & Quick Action Modal */}
      {recipeToView && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-[#E8ECF2] space-y-4">
            <div className="flex items-start justify-between border-b border-[#E8ECF2] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#172033]">
                  Resep &amp; HPP: {recipeToView.product.name}
                </h3>
                <p className="text-[11px] text-[#667085] mt-0.5">
                  Formula takaran bahan baku &amp; kalkulasi HPP per unit
                </p>
              </div>
              <button
                onClick={() => setRecipeToView(null)}
                className="p-1 rounded-full text-[#98A2B3] hover:text-[#172033]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {recipeToView.recipe ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-[#F7F8FA] rounded-xl border border-[#E8ECF2]">
                    <span className="text-[10px] text-[#667085] block">Hasil 1 Batch</span>
                    <span className="font-extrabold text-[#172033]">
                      {recipeToView.recipe.yieldQty} {recipeToView.recipe.yieldUnit || 'unit'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-orange-50/70 rounded-xl border border-orange-200/80">
                    <span className="text-[10px] text-[#667085] block">HPP per Unit</span>
                    <span className="font-extrabold text-[#FF641F]">
                      {formatRupiah(
                        calculateHPP(recipeToView.recipe, ingredientsMap) ||
                          recipeToView.recipe.totalHpp ||
                          0
                      )}{' '}
                      / {recipeToView.recipe.yieldUnit || 'unit'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  <span className="text-[11px] font-bold text-[#667085] block uppercase">
                    Komposisi Bahan (1 Batch):
                  </span>
                  {(recipeToView.recipe.batchItems || recipeToView.recipe.items || []).map(
                    (it, idx) => {
                      const ing = ingredientsMap.get(it.ingredientId);
                      const unitCost =
                        ing && typeof ing.costPerUnit === 'number'
                          ? ing.costPerUnit
                          : it.costPerUnit || 0;
                      return (
                        <div
                          key={idx}
                          className="flex justify-between items-center py-1.5 border-b border-[#E8ECF2]"
                        >
                          <div>
                            <span className="text-[#172033] font-semibold block">
                              {it.ingredientName}
                            </span>
                            <span className="text-[10px] text-[#667085]">
                              {it.quantity} {it.unit} &times; {formatRupiah(unitCost)}
                            </span>
                          </div>
                          <span className="font-bold text-[#172033]">
                            {formatRupiah(it.quantity * unitCost)}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#667085]">
                Resep belum diatur untuk produk ini. Silakan atur formula resep &amp; HPP terlebih dahulu.
              </p>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-[#E8ECF2]">
              <button
                type="button"
                onClick={() => setRecipeToView(null)}
                className="px-3 py-2.5 rounded-xl bg-[#F1F4F8] hover:bg-[#E8ECF2] text-[#172033] font-semibold text-xs transition cursor-pointer"
              >
                Tutup
              </button>

              {canEditRecipe && (
                <button
                  type="button"
                  onClick={() => {
                    const target = recipeToView.product;
                    const rec = recipeToView.recipe;
                    setRecipeToView(null);
                    if (rec) {
                      handleOpenEditRecipe(rec, target);
                    } else {
                      handleOpenCreateRecipe(target);
                    }
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-[#FF641F] text-[#FF641F] hover:bg-orange-50 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{recipeToView.recipe ? 'Edit Resep & HPP' : 'Buat Resep'}</span>
                </button>
              )}

              {recipeToView.recipe && (
                <button
                  type="button"
                  onClick={() => {
                    const target = recipeToView.product;
                    setRecipeToView(null);
                    handleOpenModal(target);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Factory className="w-3.5 h-3.5" />
                  <span>Produksi</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recipe Form Modal (Create / Edit Recipe & HPP) */}
      <RecipeFormModal
        isOpen={showRecipeModal}
        onClose={() => {
          setShowRecipeModal(false);
          setEditingRecipe(null);
          setRecipeTargetProduct(null);
        }}
        editingRecipe={editingRecipe}
        targetProduct={recipeTargetProduct}
        availableProducts={producibleProducts}
        onSaved={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 5000);
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: STOK OPNAME PRODUK JADI                                          */}
      {/* ========================================================================= */}
      {opnameProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400">
                  Stok Opname Produk
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {opnameProduct.name}
                </h3>
              </div>
              <button onClick={() => setOpnameProduct(null)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProductOpnameSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Stok Fisik Sebenarnya (Unit)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={opnamePhysical}
                  onChange={e => setOpnamePhysical(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Alasan Penyesuaian
                </label>
                <input
                  type="text"
                  required
                  value={opnameReason}
                  onChange={e => setOpnameReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  placeholder="Contoh: Rusak, tumpah, atau basi"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpnameProduct(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isOpnameSubmitting}
                  className="flex-1 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
                >
                  {isOpnameSubmitting ? 'Menyimpan...' : 'Simpan Stok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KONFIRMASI PEMBATALAN PRODUKSI (KHUSUS AKUN OWNER)               */}
      {/* ========================================================================= */}
      {cancellingProduction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 border border-red-200 dark:border-red-900/60 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Batalkan Produksi (Khusus Owner)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Stok bahan baku akan dikembalikan &amp; stok produk jadi dikurangkan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancellingProduction(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-red-50/70 dark:bg-red-950/40 rounded-2xl border border-red-100 dark:border-red-900/50 space-y-1.5">
                <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
                  <span>Produk Jadi:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {cancellingProduction.productName}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-red-700 dark:text-red-300">
                  <span>Pengurangan Stok Produk Jadi:</span>
                  <span className="font-black">
                    -{cancellingProduction.totalProduced} {cancellingProduction.yieldUnit || 'unit'}
                  </span>
                </div>
              </div>

              {/* Rincian Bahan yang akan dikembalikan */}
              {((cancellingProduction.items && cancellingProduction.items.length > 0) ||
                (cancellingProduction.itemsConsumed && cancellingProduction.itemsConsumed.length > 0)) && (
                <div className="space-y-1.5">
                  <span className="font-extrabold text-[11px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                    Bahan Baku yang Akan Dikembalikan ke Stok (+):
                  </span>
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/50 p-2.5 max-h-40 overflow-y-auto space-y-1">
                    {(cancellingProduction.items || cancellingProduction.itemsConsumed || []).map((it: { ingredientName: string; quantity: number; unit: string }, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {it.ingredientName}
                        </span>
                        <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                          +{it.quantity} {it.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Alasan Pembatalan Produksi
                </label>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Contoh: Salah catat batch / bahan salah takar"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCancellingProduction(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleCancelProduction}
                disabled={isCancelling}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isCancelling ? 'Membatalkan...' : 'Ya, Batalkan & Kembalikan Stok'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: KONFIRMASI PEMBATALAN PEMOTONGAN AYAM (KHUSUS AKUN OWNER)         */}
      {/* ========================================================================= */}
      {cancellingChickenBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 border border-red-200 dark:border-red-900/60 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Batalkan Batch Pemotongan Ayam
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Stok kg ayam mentah akan dikembalikan &amp; stok potong dikurangkan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancellingChickenBatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-red-50/70 dark:bg-red-950/40 rounded-2xl border border-red-100 dark:border-red-900/50 space-y-2">
                <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-300">
                  <span>Stok Ayam Mentah yang Dikembalikan (+):</span>
                  <span className="font-black text-sm">+{cancellingChickenBatch.rawQuantity} kg</span>
                </div>
                <div className="flex justify-between font-semibold text-red-700 dark:text-red-300">
                  <span>Pengurangan Ayam Siap Jual (-):</span>
                  <span className="font-black text-sm">-{cancellingChickenBatch.preparedQuantity} potong</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Alasan Pembatalan Batch
                </label>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Contoh: Salah catat timbangan mentah / potongan"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCancellingChickenBatch(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleCancelChickenBatch}
                disabled={isCancelling}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isCancelling ? 'Membatalkan...' : 'Ya, Batalkan Batch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
