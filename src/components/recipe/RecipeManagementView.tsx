import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Recipe, RecipeItem, OverheadItem, Product } from '../../types';
import {
  formatRupiah,
  formatNumber,
  formatNumberInput,
  parseNumberInput,
  calculateHPP,
  getProductRecipeHpp,
} from '../../utils/formatters';
import { getProductImageUrl } from '../../utils/productImages';
import {
  ChefHat,
  Plus,
  Edit3,
  Trash2,
  X,
  Search,
  Scale,
  Flame,
  Zap,
  HelpCircle,
  Factory,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Boxes,
  Info,
} from 'lucide-react';

interface RecipeManagementViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const RecipeManagementView: React.FC<RecipeManagementViewProps> = ({ onNavigateTab }) => {
  const {
    products,
    productsMap,
    recipes,
    recipesMap,
    ingredients,
    ingredientsMap,
    saveRecipe,
    addProduct,
    updateProduct,
  } = useApp();
  const { currentRole } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('ALL');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // ==========================================
  // MODAL STATE: BUAT / UBAH RESEP
  // ==========================================
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const [formProductId, setFormProductId] = useState('');
  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [formYieldQty, setFormYieldQty] = useState<number>(8);
  const [formYieldUnit, setFormYieldUnit] = useState<string>('pcs');
  const [formPatokanIngredientId, setFormPatokanIngredientId] = useState<string>('');

  const [formBatchItems, setFormBatchItems] = useState<RecipeItem[]>([
    { ingredientId: '', ingredientName: '', quantity: 1, unit: 'kg', costPerUnit: 0 },
  ]);

  // Overhead Utilities per batch
  const [formGasCost, setFormGasCost] = useState<number>(0);
  const [formElectricityCost, setFormElectricityCost] = useState<number>(0);
  const [formOtherOverheadCost, setFormOtherOverheadCost] = useState<number>(0);
  const [formOverheadNotes, setFormOverheadNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Delete Confirm
  const [deletingRecipe, setDeletingRecipe] = useState<Recipe | null>(null);

  // Available semi-finished products for dropdown
  const availableSemiFinishedProducts = useMemo(() => {
    return products.filter(p => {
      // Products that are physical goods (not packages, not retail only, not composite-only)
      if (p.productType === 'PACKAGE' || p.stockSource === 'COMPOSITION' || p.stockSource === 'NONE') {
        return false;
      }
      return true;
    });
  }, [products]);

  // Filtered recipes list
  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      // 1. Unit filter
      if (selectedUnitFilter !== 'ALL' && (r.yieldUnit || 'pcs').toLowerCase() !== selectedUnitFilter.toLowerCase()) {
        return false;
      }

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.productName.toLowerCase().includes(q);
        const matchIngredient = (r.batchItems || r.items || []).some(it =>
          it.ingredientName.toLowerCase().includes(q)
        );
        if (!matchName && !matchIngredient) return false;
      }
      return true;
    });
  }, [recipes, selectedUnitFilter, searchQuery]);

  // Total Summary Stats
  const totalRecipesCount = recipes.length;
  const avgHppValue = useMemo(() => {
    if (recipes.length === 0) return 0;
    const sum = recipes.reduce((acc, r) => {
      const hpp = calculateHPP(r, ingredientsMap) || r.totalHpp || 0;
      return acc + hpp;
    }, 0);
    return Math.round(sum / recipes.length);
  }, [recipes, ingredientsMap]);

  // =========================================================================
  // LIVE HPP CALCULATIONS FOR FORM MODAL
  // =========================================================================
  const modalRawMaterialsCost = useMemo(() => {
    return formBatchItems.reduce((acc, item) => {
      if (!item.ingredientId) return acc;
      const ing = ingredientsMap.get(item.ingredientId);
      const unitCost = ing && typeof ing.costPerUnit === 'number' ? ing.costPerUnit : (item.costPerUnit || 0);
      return acc + unitCost * (item.quantity || 0);
    }, 0);
  }, [formBatchItems, ingredientsMap]);

  const modalOverheadTotal = useMemo(() => {
    return (formGasCost || 0) + (formElectricityCost || 0) + (formOtherOverheadCost || 0);
  }, [formGasCost, formElectricityCost, formOtherOverheadCost]);

  const modalTotalBatchCost = useMemo(() => {
    return modalRawMaterialsCost + modalOverheadTotal;
  }, [modalRawMaterialsCost, modalOverheadTotal]);

  const modalHppPerUnit = useMemo(() => {
    const validYield = Math.max(1, formYieldQty || 1);
    return Math.round((modalTotalBatchCost / validYield) * 100) / 100;
  }, [modalTotalBatchCost, formYieldQty]);

  // =========================================================================
  // HANDLERS
  // =========================================================================
  const handleOpenCreate = () => {
    if (currentRole === 'KASIR') {
      alert('Akses Ditolak: Hanya ADMIN/OWNER yang berwenang membuat resep.');
      return;
    }
    setEditingRecipeId(null);
    setIsCreatingNewProduct(false);
    setNewProductName('');
    setFormProductId(availableSemiFinishedProducts[0]?.id || '');
    setFormYieldQty(8);
    setFormYieldUnit('pcs');
    setFormPatokanIngredientId('');

    // Default first ingredient if available
    const firstIng = ingredients[0];
    setFormBatchItems([
      {
        ingredientId: firstIng?.id || '',
        ingredientName: firstIng?.name || '',
        quantity: 1,
        unit: firstIng?.unit || 'kg',
        costPerUnit: firstIng?.costPerUnit || 0,
      },
    ]);

    setFormGasCost(0);
    setFormElectricityCost(0);
    setFormOtherOverheadCost(0);
    setFormOverheadNotes('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (recipe: Recipe) => {
    if (currentRole === 'KASIR') {
      alert('Akses Ditolak: Hanya ADMIN/OWNER yang berwenang mengubah resep.');
      return;
    }
    setEditingRecipeId(recipe.id);
    setIsCreatingNewProduct(false);
    setNewProductName('');
    setFormProductId(recipe.productId);
    setFormYieldQty(recipe.yieldQty || 1);
    setFormYieldUnit(recipe.yieldUnit || 'pcs');
    setFormPatokanIngredientId(recipe.patokanIngredientId || '');

    const items = recipe.batchItems && recipe.batchItems.length > 0
      ? recipe.batchItems
      : recipe.items && recipe.items.length > 0
      ? recipe.items
      : [];

    if (items.length > 0) {
      setFormBatchItems(
        items.map(it => {
          const ing = ingredientsMap.get(it.ingredientId);
          return {
            ...it,
            ingredientName: ing?.name || it.ingredientName,
            costPerUnit: ing?.costPerUnit || it.costPerUnit || 0,
          };
        })
      );
    } else {
      setFormBatchItems([
        { ingredientId: '', ingredientName: '', quantity: 1, unit: 'kg', costPerUnit: 0 },
      ]);
    }

    const gas = recipe.overheadItems?.find(o => o.name.toLowerCase().includes('gas'))?.cost || 0;
    const elect = recipe.overheadItems?.find(o => o.name.toLowerCase().includes('listrik'))?.cost || 0;
    const other = recipe.overheadItems?.find(o => !o.name.toLowerCase().includes('gas') && !o.name.toLowerCase().includes('listrik'))?.cost || 0;

    setFormGasCost(gas);
    setFormElectricityCost(elect);
    setFormOtherOverheadCost(other);
    setFormOverheadNotes(recipe.overheadNotes || '');
    setShowFormModal(true);
  };

  // Preset quick templates
  const applyPresetTemplate = (preset: 'AYAM_CRISPY' | 'SAMBAL' | 'NASI' | 'TEH_MANIS') => {
    const ayam = ingredients.find(i => i.name.toLowerCase().includes('ayam') && i.name.toLowerCase().includes('mentah')) || ingredients.find(i => i.name.toLowerCase().includes('ayam'));
    const tepung = ingredients.find(i => i.name.toLowerCase().includes('tepung'));
    const bumbu = ingredients.find(i => i.name.toLowerCase().includes('bumbu') || i.name.toLowerCase().includes('garam'));
    const minyak = ingredients.find(i => i.name.toLowerCase().includes('minyak'));
    const cabe = ingredients.find(i => i.name.toLowerCase().includes('cabai') || i.name.toLowerCase().includes('cabe'));
    const bawang = ingredients.find(i => i.name.toLowerCase().includes('bawang'));
    const beras = ingredients.find(i => i.name.toLowerCase().includes('beras'));
    const gula = ingredients.find(i => i.name.toLowerCase().includes('gula'));
    const teh = ingredients.find(i => i.name.toLowerCase().includes('teh'));

    if (preset === 'AYAM_CRISPY') {
      setFormYieldQty(8);
      setFormYieldUnit('pcs');
      const list: RecipeItem[] = [];
      if (ayam) list.push({ ingredientId: ayam.id, ingredientName: ayam.name, quantity: 1, unit: ayam.unit, costPerUnit: ayam.costPerUnit });
      if (tepung) list.push({ ingredientId: tepung.id, ingredientName: tepung.name, quantity: 0.2, unit: tepung.unit, costPerUnit: tepung.costPerUnit });
      if (bumbu) list.push({ ingredientId: bumbu.id, ingredientName: bumbu.name, quantity: 0.05, unit: bumbu.unit, costPerUnit: bumbu.costPerUnit });
      if (minyak) list.push({ ingredientId: minyak.id, ingredientName: minyak.name, quantity: 0.2, unit: minyak.unit, costPerUnit: minyak.costPerUnit });
      setFormBatchItems(list.length > 0 ? list : formBatchItems);
      setFormGasCost(1500);
      setFormOverheadNotes('Alokasi gas penggorengan');
    } else if (preset === 'SAMBAL') {
      setFormYieldQty(40);
      setFormYieldUnit('porsi');
      const list: RecipeItem[] = [];
      if (cabe) list.push({ ingredientId: cabe.id, ingredientName: cabe.name, quantity: 1, unit: cabe.unit, costPerUnit: cabe.costPerUnit });
      if (bawang) list.push({ ingredientId: bawang.id, ingredientName: bawang.name, quantity: 0.2, unit: bawang.unit, costPerUnit: bawang.costPerUnit });
      if (minyak) list.push({ ingredientId: minyak.id, ingredientName: minyak.name, quantity: 0.25, unit: minyak.unit, costPerUnit: minyak.costPerUnit });
      setFormBatchItems(list.length > 0 ? list : formBatchItems);
      setFormGasCost(1000);
    } else if (preset === 'NASI') {
      setFormYieldQty(25);
      setFormYieldUnit('porsi');
      const list: RecipeItem[] = [];
      if (beras) list.push({ ingredientId: beras.id, ingredientName: beras.name, quantity: 2, unit: beras.unit, costPerUnit: beras.costPerUnit });
      setFormBatchItems(list.length > 0 ? list : formBatchItems);
      setFormElectricityCost(1500);
      setFormOverheadNotes('Listrik Rice Cooker');
    } else if (preset === 'TEH_MANIS') {
      setFormYieldQty(20);
      setFormYieldUnit('cup');
      const list: RecipeItem[] = [];
      if (gula) list.push({ ingredientId: gula.id, ingredientName: gula.name, quantity: 0.5, unit: gula.unit, costPerUnit: gula.costPerUnit });
      if (teh) list.push({ ingredientId: teh.id, ingredientName: teh.name, quantity: 5, unit: teh.unit, costPerUnit: teh.costPerUnit });
      setFormBatchItems(list.length > 0 ? list : formBatchItems);
      setFormGasCost(500);
    }
  };

  // Add / Remove ingredient row in form
  const handleAddIngredientRow = () => {
    const firstIng = ingredients[0];
    setFormBatchItems(prev => [
      ...prev,
      {
        ingredientId: firstIng?.id || '',
        ingredientName: firstIng?.name || '',
        quantity: 1,
        unit: firstIng?.unit || 'kg',
        costPerUnit: firstIng?.costPerUnit || 0,
      },
    ]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    if (formBatchItems.length <= 1) return;
    setFormBatchItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateIngredientRow = (index: number, field: keyof RecipeItem, value: any) => {
    setFormBatchItems(prev => {
      const clone = [...prev];
      if (field === 'ingredientId') {
        const ing = ingredientsMap.get(value);
        clone[index] = {
          ...clone[index],
          ingredientId: value,
          ingredientName: ing?.name || '',
          unit: ing?.unit || clone[index].unit,
          costPerUnit: ing?.costPerUnit || 0,
        };
      } else {
        clone[index] = {
          ...clone[index],
          [field]: value,
        };
      }
      return clone;
    });
  };

  // Submit Save Recipe
  const handleSubmitRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreatingNewProduct && !formProductId) {
      alert('Silakan pilih Produk 1/2 Jadi target.');
      return;
    }
    if (isCreatingNewProduct && !newProductName.trim()) {
      alert('Silakan masukkan nama Produk 1/2 Jadi baru.');
      return;
    }
    if (formYieldQty <= 0) {
      alert('Jumlah hasil produksi (yield) harus lebih dari 0.');
      return;
    }
    if (formBatchItems.some(it => !it.ingredientId || it.quantity < 0)) {
      alert('Pastikan semua bahan baku dipilih dan jumlahnya minimal 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      let targetProductId = formProductId;
      let targetProductName = '';

      if (isCreatingNewProduct) {
        const newProd = await addProduct(
          {
            name: newProductName.trim(),
            categoryId: 'cat_olahan_dapur',
            sellingPrice: 0,
            active: true,
            stockTracked: true,
            stock: 0,
            stockUnit: formYieldUnit.trim() || 'pcs',
            costPerUnit: modalHppPerUnit,
            isProduction: true,
            stockSource: 'PRODUCTION',
          },
          []
        );
        targetProductId = newProd.id;
        targetProductName = newProd.name;
      } else {
        const p = productsMap.get(targetProductId);
        targetProductName = p?.name || 'Produk 1/2 Jadi';
      }

      const recipeId = editingRecipeId || `rec_${targetProductId}`;
      const validYield = Math.max(1, formYieldQty || 1);

      // Clean items list per portion (for backward compatibility)
      const perPortionItems: RecipeItem[] = formBatchItems.map(b => ({
        ingredientId: b.ingredientId,
        ingredientName: b.ingredientName,
        quantity: b.quantity / validYield,
        unit: b.unit,
        costPerUnit: b.costPerUnit,
      }));

      const overheadItems: OverheadItem[] = [];
      if (formGasCost > 0) overheadItems.push({ name: 'Gas LPG', cost: formGasCost });
      if (formElectricityCost > 0) overheadItems.push({ name: 'Listrik & Air', cost: formElectricityCost });
      if (formOtherOverheadCost > 0) overheadItems.push({ name: 'Operasional Lainnya', cost: formOtherOverheadCost });

      const recipeDoc: Recipe = {
        id: recipeId,
        productId: targetProductId,
        productName: targetProductName,
        recipeMode: 'BATCH',
        yieldQty: validYield,
        yieldUnit: formYieldUnit.trim() || 'pcs',
        batchItems: formBatchItems,
        portionItems: [],
        items: perPortionItems,
        overheadCostPerUnit: modalOverheadTotal / validYield,
        overheadItems,
        overheadNotes: formOverheadNotes || undefined,
        totalHpp: modalHppPerUnit,
        patokanIngredientId: formPatokanIngredientId || undefined,
        patokanIngredientName: formPatokanIngredientId === 'PRODUCT'
          ? targetProductName
          : formPatokanIngredientId
          ? ingredientsMap.get(formPatokanIngredientId)?.name
          : undefined,
        updatedAt: new Date().toISOString(),
      };

      await saveRecipe(recipeDoc);

      // Also update product's costPerUnit and stockUnit
      const prod = productsMap.get(targetProductId);
      if (prod) {
        await updateProduct(
          targetProductId,
          {
            costPerUnit: modalHppPerUnit,
            stockUnit: formYieldUnit.trim() || prod.stockUnit || 'pcs',
            isProduction: true,
            stockSource: 'PRODUCTION',
            recipeId,
          }
        );
      }

      setShowFormModal(false);
      setSuccessToast(`Resep [${targetProductName}] berhasil disimpan! HPP: ${formatRupiah(modalHppPerUnit)} / ${formYieldUnit}`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan resep');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 selection:bg-[#FF641F] selection:text-white pb-24">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[#172033] via-[#1E293B] to-[#2B384E] text-white rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden border border-slate-700/60">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF641F]/20 text-[#FF854D] text-xs font-bold border border-[#FF641F]/30 backdrop-blur-md">
              <ChefHat className="w-3.5 h-3.5" />
              <span>Formula & Resep Produk 1/2 Jadi</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Resep Dapur & Kalkulasi HPP</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Formula standar untuk membuat <span className="font-bold text-white">Produk 1/2 Jadi</span> (<span className="text-orange-400 font-semibold">Ayam Crispy, Sambal, Nasi, Teh Manis</span>). Menghitung kebutuhan bahan baku, estimasi hasil produksi (yield), dan menetapkan HPP per unit secara akurat.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-orange-400" />
              <span>Cara Kerja HPP</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2.5 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-orange-500/25 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Buat Resep Baru</span>
            </button>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#FF641F]/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-[#E8ECF2] dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#EFF8FF] text-[#1570EF] flex items-center justify-center shrink-0 border border-[#D1E9FF]">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#667085]">Total Resep Terdaftar</p>
            <p className="text-lg font-black text-[#172033] dark:text-white">{totalRecipesCount} Formula</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-[#E8ECF2] dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#FFFAFA] text-[#FF641F] flex items-center justify-center shrink-0 border border-[#FFE4D6]">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#667085]">Rata-rata HPP Unit</p>
            <p className="text-lg font-black text-[#FF641F]">{formatRupiah(avgHppValue)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-[#E8ECF2] dark:border-slate-800 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#ECFDF3] text-[#12B76A] flex items-center justify-center shrink-0 border border-[#ABEFC6]">
            <Factory className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#667085]">Siap Diproduksi</p>
            <p className="text-lg font-black text-[#12B76A]">Dapur Olahan</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama resep atau bahan baku..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Satuan Yield:</span>
          <select
            value={selectedUnitFilter}
            onChange={e => setSelectedUnitFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="ALL">Semua Satuan</option>
            <option value="pcs">pcs (Potong)</option>
            <option value="porsi">porsi</option>
            <option value="cup">cup</option>
            <option value="kg">kg</option>
          </select>
        </div>
      </div>

      {/* Recipe Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredRecipes.map(recipe => {
          const items = recipe.batchItems && recipe.batchItems.length > 0
            ? recipe.batchItems
            : recipe.items && recipe.items.length > 0
            ? recipe.items
            : [];

          const yieldQty = recipe.yieldQty || 1;
          const yieldUnit = recipe.yieldUnit || 'pcs';

          // Calculate current cost from latest ingredient prices
          let totalRawCost = 0;
          items.forEach(it => {
            const ing = ingredientsMap.get(it.ingredientId);
            const cost = ing && typeof ing.costPerUnit === 'number' ? ing.costPerUnit : (it.costPerUnit || 0);
            totalRawCost += cost * it.quantity;
          });

          const overheadTotal = (recipe.overheadCostPerUnit || 0) * yieldQty;
          const totalBatchCost = totalRawCost + overheadTotal;
          const liveHppPerUnit = yieldQty > 0 ? Math.round((totalBatchCost / yieldQty) * 100) / 100 : 0;

          // Target product
          const targetProd = productsMap.get(recipe.productId);

          return (
            <div
              key={recipe.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between hover:border-orange-300 dark:hover:border-orange-700 transition"
            >
              <div className="space-y-4">
                {/* Header: Title & Action Buttons */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <img
                      src={getProductImageUrl(recipe.productName)}
                      alt={recipe.productName}
                      className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-slate-100 dark:border-slate-800"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                          {recipe.productName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 text-[10px] font-black border border-orange-200 dark:border-orange-800">
                          PRODUK 1/2 JADI
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        Hasil per Batch: <strong className="text-slate-700 dark:text-slate-200">{yieldQty} {yieldUnit}</strong>
                        {recipe.patokanIngredientName && (
                          <span className="ml-2 text-[10px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-1.5 py-0.5 rounded-md font-bold">
                            Patokan: {recipe.patokanIngredientName}
                          </span>
                        )}
                        {targetProd && typeof targetProd.stock === 'number' && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px]">
                            Stok Saat Ini: {targetProd.stock} {targetProd.stockUnit || yieldUnit}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(recipe)}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300 transition cursor-pointer"
                      title="Ubah Resep"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Formula Bahan Baku Table */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>Daftar Bahan Baku (1 Batch):</span>
                    <span>Subtotal Biaya</span>
                  </div>

                  <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 space-y-2">
                    {items.map((item, idx) => {
                      const ing = ingredientsMap.get(item.ingredientId);
                      const unitCost = ing && typeof ing.costPerUnit === 'number' ? ing.costPerUnit : (item.costPerUnit || 0);
                      const subtotal = unitCost * item.quantity;
                      const hasStock = (ing?.stock || 0) >= item.quantity;

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                hasStock ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
                              }`}
                              title={hasStock ? `Stok aman (${ing?.stock} ${ing?.unit})` : `Stok kurang (${ing?.stock || 0} ${item.unit})`}
                            />
                            <span className="font-bold text-slate-900 dark:text-white">
                              {item.quantity} {item.unit}
                            </span>
                            <span className="truncate">{item.ingredientName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              (@{formatRupiah(unitCost)})
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white shrink-0">
                            {formatRupiah(subtotal)}
                          </span>
                        </div>
                      );
                    })}

                    {/* Overhead Breakdown if any */}
                    {overheadTotal > 0 && (
                      <div className="pt-2 mt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-orange-700 dark:text-orange-400 font-bold">
                        <span className="flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-orange-500" />
                          <span>Alokasi Utilitas (Gas LPG / Listrik):</span>
                        </span>
                        <span>+{formatRupiah(overheadTotal)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Calculation Summary Box (Formula HPP) */}
                <div className="p-3.5 rounded-2xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300 block">
                      Total Biaya 1 Batch
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                      {formatRupiah(totalBatchCost)}
                    </span>
                  </div>

                  <div className="border-x border-orange-200 dark:border-orange-800/60">
                    <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300 block">
                      Hasil Produksi (Yield)
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                      {yieldQty} {yieldUnit}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300 block">
                      HPP per Unit
                    </span>
                    <span className="text-xs sm:text-sm font-black text-orange-600 dark:text-orange-400 mt-0.5 block">
                      {formatRupiah(liveHppPerUnit)} <span className="text-[10px] font-normal">/{yieldUnit}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 font-semibold">
                  Update: {new Date(recipe.updatedAt || Date.now()).toLocaleDateString('id-ID')}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateTab) {
                        onNavigateTab('produksi');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Factory className="w-3.5 h-3.5" />
                    <span>Produksi Sekarang</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: BAGAIMANA HPP RESEP BEKERJA                                         */}
      {/* ========================================================================= */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
                <ChefHat className="w-5 h-5 text-orange-500" />
                <span>Formula Resep & Perhitungan HPP</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-2xl border border-orange-200 dark:border-orange-800/60 space-y-1.5">
                <p className="font-bold text-orange-900 dark:text-orange-200">
                  1. Formula Standar Produk 1/2 Jadi
                </p>
                <p className="text-[11px]">
                  Resep adalah racikan bahan baku mentah (misal: Ayam Mentah, Tepung, Bumbu, Minyak) untuk menghasilkan Produk 1/2 Jadi (misal: <em>Ayam Crispy</em>).
                </p>
              </div>

              <div className="p-3 bg-sky-50 dark:bg-sky-950/30 rounded-2xl border border-sky-200 dark:border-sky-800/60 space-y-1.5">
                <p className="font-bold text-sky-950 dark:text-sky-200">
                  2. Rumus HPP Otomatis
                </p>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-700 font-mono text-[11px] text-sky-700 dark:text-sky-300">
                  HPP per unit = (Total Biaya Bahan + Overhead) ÷ Yield (Hasil)
                </div>
                <p className="text-[11px]">
                  Jika biaya 1 batch = Rp 42.900 dan menghasilkan 8 pcs, maka HPP Ayam Crispy = Rp 5.362,50 / pcs.
                </p>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                <p className="font-bold text-emerald-900 dark:text-emerald-200">
                  3. Tidak Mengubah Histori Produksi Lama
                </p>
                <p className="text-[11px]">
                  Perubahan harga bahan baku akan memperbarui estimasi HPP resep saat ini, namun histori produksi yang telah dicatat di masa lalu tidak akan berubah secara retroaktif.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FORM BUAT / UBAH RESEP & KALKULASI HPP                              */}
      {/* ========================================================================= */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitRecipe}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {editingRecipeId ? 'Ubah Formula Resep Dapur' : 'Buat Formula Resep Baru'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Tentukan takaran bahan baku untuk menghasilkan Produk 1/2 Jadi dan hitung HPP
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Template Buttons */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 block">
                Template Cepat Resep Populer:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyPresetTemplate('AYAM_CRISPY')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold hover:border-orange-500 hover:text-orange-600 transition cursor-pointer"
                >
                  🍗 Ayam Crispy (8 pcs)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate('SAMBAL')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold hover:border-orange-500 hover:text-orange-600 transition cursor-pointer"
                >
                  🌶️ Sambal Bawang (40 porsi)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate('NASI')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold hover:border-orange-500 hover:text-orange-600 transition cursor-pointer"
                >
                  🍚 Nasi Pulen (25 porsi)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate('TEH_MANIS')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold hover:border-orange-500 hover:text-orange-600 transition cursor-pointer"
                >
                  🍵 Teh Manis (20 cup)
                </button>
              </div>
            </div>

            {/* Target Product Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Produk 1/2 Jadi Hasil <span className="text-red-500">*</span>
                  </label>
                  {!editingRecipeId && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewProduct(!isCreatingNewProduct)}
                      className="text-[10px] font-bold text-orange-600 hover:underline cursor-pointer"
                    >
                      {isCreatingNewProduct ? 'Pilih Produk Ada' : '+ Produk Baru'}
                    </button>
                  )}
                </div>

                {isCreatingNewProduct ? (
                  <input
                    type="text"
                    value={newProductName}
                    onChange={e => setNewProductName(e.target.value)}
                    placeholder="Misal: Ayam Crispy Renyah..."
                    required
                    className="w-full px-3 py-2 rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-950/30 font-bold text-slate-900 dark:text-white"
                  />
                ) : (
                  <select
                    value={formProductId}
                    onChange={e => setFormProductId(e.target.value)}
                    disabled={Boolean(editingRecipeId)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white disabled:opacity-60"
                  >
                    {availableSemiFinishedProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Yield Quantity & Unit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Hasil per Batch (Yield) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={formYieldQty}
                    onChange={e => setFormYieldQty(Math.max(1, parseFloat(e.target.value) || 1))}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Satuan Hasil <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formYieldUnit}
                    onChange={e => setFormYieldUnit(e.target.value)}
                    placeholder="pcs / porsi / cup"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Patokan Batch (Reference Ingredient) */}
              <div className="text-xs">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Bahan Utama Patokan Batch (Basis Skala)
                </label>
                <select
                  value={formPatokanIngredientId}
                  onChange={e => setFormPatokanIngredientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                >
                  <option value="">-- Tanpa Patokan Khusus --</option>
                  <option value="PRODUCT">
                    Hasil Produksi Sendiri: {isCreatingNewProduct ? (newProductName || 'Produk Baru') : (productsMap.get(formProductId)?.name || 'Produk')} ({formYieldUnit})
                  </option>
                  {formBatchItems
                    .filter(it => it.ingredientId)
                    .map(it => (
                      <option key={it.ingredientId} value={it.ingredientId}>
                        Bahan Baku: {it.ingredientName} ({it.unit})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Pilih bahan utama yang menjadi acuan atau basis skala batch resep ini (misal: <strong>Cabai/Sambal</strong> untuk Sambal, <strong>Beras</strong> untuk Nasi, atau <strong>Gula/Teh</strong> untuk Teh Manis).
                </p>
              </div>
            </div>

            {/* List Bahan Baku Resep */}
            <div className="space-y-2 pt-2 border-t dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Komposisi Bahan Baku (Takaran 1 Batch):</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddIngredientRow}
                  className="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold text-xs flex items-center gap-1 hover:bg-orange-100 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Bahan</span>
                </button>
              </div>

              <div className="space-y-2">
                {formBatchItems.map((item, index) => {
                  const ing = ingredientsMap.get(item.ingredientId);
                  const currentCost = ing && typeof ing.costPerUnit === 'number' ? ing.costPerUnit : (item.costPerUnit || 0);
                  const subtotal = currentCost * (item.quantity || 0);

                  return (
                    <div
                      key={index}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 text-xs"
                    >
                      {/* Ingredient Selector */}
                      <div className="flex-1">
                        <select
                          value={item.ingredientId}
                          onChange={e => handleUpdateIngredientRow(index, 'ingredientId', e.target.value)}
                          required
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                        >
                          <option value="">-- Pilih Bahan Baku --</option>
                          {ingredients.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.name} (Stok: {i.stock} {i.unit} | Rp {i.costPerUnit?.toLocaleString('id-ID')}/{i.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity Input */}
                      <div className="w-28 flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.quantity}
                          onChange={e => handleUpdateIngredientRow(index, 'quantity', parseFloat(e.target.value) || 0)}
                          required
                          placeholder="Jumlah"
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-center text-slate-900 dark:text-white"
                        />
                        <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                          {item.unit}
                        </span>
                      </div>

                      {/* Subtotal Display */}
                      <div className="w-28 text-right font-black text-slate-900 dark:text-white shrink-0">
                        {formatRupiah(subtotal)}
                      </div>

                      {/* Remove Button */}
                      {formBatchItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredientRow(index)}
                          className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer self-end sm:self-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overhead Utilities Breakdown */}
            <div className="p-3.5 bg-orange-50/50 dark:bg-orange-950/20 rounded-2xl border border-orange-200/80 dark:border-orange-800/50 space-y-2.5 text-xs">
              <span className="font-extrabold text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>Alokasi Biaya Utilitas per Batch (Opsional):</span>
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Gas LPG (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(formGasCost)}
                    onChange={e => setFormGasCost(parseNumberInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Listrik & Air (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(formElectricityCost)}
                    onChange={e => setFormElectricityCost(parseNumberInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Lainnya (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(formOtherOverheadCost)}
                    onChange={e => setFormOtherOverheadCost(parseNumberInput(e.target.value))}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Live Kalkulasi HPP Footer Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500 to-[#FF641F] text-white shadow-lg space-y-2">
              <div className="flex items-center justify-between text-xs opacity-90">
                <span>Total Biaya Bahan: {formatRupiah(modalRawMaterialsCost)} + Utilitas: {formatRupiah(modalOverheadTotal)}</span>
                <span>Hasil: {formYieldQty} {formYieldUnit}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-white/20">
                <div>
                  <span className="text-[11px] font-bold block opacity-90">Kalkulasi Otomatis HPP per Unit:</span>
                  <span className="text-xl font-black">{formatRupiah(modalHppPerUnit)} <span className="text-xs font-normal">/{formYieldUnit}</span></span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] opacity-80 block">Biaya 1 Batch:</span>
                  <span className="text-sm font-black">{formatRupiah(modalTotalBatchCost)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-black text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Formula Resep'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
