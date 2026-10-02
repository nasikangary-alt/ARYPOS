import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Ingredient, IngredientCategory, Product } from '../../types';
import {
  formatRupiah,
  formatNumber,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import { getIngredientImageUrl } from '../../utils/productImages';
import { isProductionOutputProduct } from '../../services/stockEngine';
import { PageHeader } from '../common/PageHeader';
import { SummaryBar } from '../common/SummaryBar';
import {
  HelpCircle,
  X,
  Plus,
  Flame,
  PlusCircle,
  ClipboardCheck,
  Edit2,
  Trash2,
  Package,
  Search,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  Layers,
  ChevronDown,
  Download,
  MoreHorizontal,
  Boxes,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';

interface InventoryViewProps {
  isDesktopWide?: boolean;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ isDesktopWide = true }) => {
  const {
    ingredients,
    ingredientCategories,
    products,
    recipes,
    recipesMap,
    ingredientsMap,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    addIngredientCategory,
    updateIngredientCategory,
    deleteIngredientCategory,
    submitStockOpname,
    submitPurchase,
    submitChickenProduction,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useApp();
  const { currentRole } = useAuth();
  const isReadOnlyStock = currentRole === 'KASIR';

  const [mainFilter, setMainFilter] = useState<
    'ALL' | 'BAHAN_BAKU' | 'PRODUK' | 'KEMASAN' | 'LOW' | 'CRITICAL'
  >('ALL');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Dropdown & Selection UI State
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals for CRUD Barang & Kategori
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);
  const [deletingIng, setDeletingIng] = useState<Ingredient | null>(null);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [deletingProd, setDeletingProd] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Modals for Aksi Cepat
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showOpnameModal, setShowOpnameModal] = useState(false);

  // Category Manager State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');

  // Form State: Tambah Barang
  const [addItemType, setAddItemType] = useState<'SELECT' | 'RAW' | 'PACKAGING' | 'PRODUK_JADI' | 'READY_TO_SELL'>('SELECT');
  const [addName, setAddName] = useState('');
  const [addCategoryId, setAddCategoryId] = useState<string>('cat_ing_raw');
  const [isAddingNewCatInline, setIsAddingNewCatInline] = useState(false);
  const [inlineNewCatName, setInlineNewCatName] = useState('');
  const [addStockUnit, setAddStockUnit] = useState('pcs');
  const [addPurchaseUnit, setAddPurchaseUnit] = useState('pack');
  const [addConversionFactor, setAddConversionFactor] = useState<number>(100);
  const [addPurchasePrice, setAddPurchasePrice] = useState<number>(10000);
  const [addStock, setAddStock] = useState<number>(0);
  const [addMinStock, setAddMinStock] = useState<number>(5);
  const [addCritStock, setAddCritStock] = useState<number>(2);
  const [addCostPerUnit, setAddCostPerUnit] = useState<number>(100);
  const [addSellingPrice, setAddSellingPrice] = useState<number>(15000);
  const [addNotes, setAddNotes] = useState<string>('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Form State: Edit Barang
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string>('cat_ing_raw');
  const [isEditAddingNewCatInline, setIsEditAddingNewCatInline] = useState(false);
  const [editInlineNewCatName, setEditInlineNewCatName] = useState('');
  const [editStockUnit, setEditStockUnit] = useState('pcs');
  const [editPurchaseUnit, setEditPurchaseUnit] = useState('pack');
  const [editConversionFactor, setEditConversionFactor] = useState<number>(100);
  const [editPurchasePrice, setEditPurchasePrice] = useState<number>(10000);
  const [editStock, setEditStock] = useState<number>(0);
  const [editMinStock, setEditMinStock] = useState<number>(5);
  const [editCritStock, setEditCritStock] = useState<number>(2);
  const [editCostPerUnit, setEditCostPerUnit] = useState<number>(100);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // State: Hapus Barang
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Production Form State
  const rawChicken = ingredients.find(i => i.id === 'ing_ayam_raw' || i.name.toLowerCase().includes('ayam mentah'));
  const [rawKg, setRawKg] = useState<number>(5);
  const [preparedPcs, setPreparedPcs] = useState<number>(40);
  const [prodNotes, setProdNotes] = useState('');
  const [isSubmittingProd, setIsSubmittingProd] = useState(false);

  // Purchase Form State
  const [supplier, setSupplier] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(ingredients[0]?.id || '');
  const [selectedItemType, setSelectedItemType] = useState<'INGREDIENT' | 'PRODUCT'>('INGREDIENT');
  const [purchaseQty, setPurchaseQty] = useState<number>(10);
  const [costPerUnit, setCostPerUnit] = useState<number>(2000);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  // Opname Form State
  const [opnameIngId, setOpnameIngId] = useState(ingredients[0]?.id || '');
  const [physicalCount, setPhysicalCount] = useState<number>(0);
  const [opnameReason, setOpnameReason] = useState('');
  const [isSubmittingOpname, setIsSubmittingOpname] = useState(false);

  // Helper to resolve category name
  const getCategoryName = (ing: Ingredient): string => {
    if (ing.categoryId) {
      const found = ingredientCategories.find(c => c.id === ing.categoryId);
      if (found) return found.name;
    }
    if (ing.type) {
      const foundById = ingredientCategories.find(c => c.id === ing.type);
      if (foundById) return foundById.name;
      const foundByName = ingredientCategories.find(c => c.name.toLowerCase() === ing.type.toLowerCase());
      if (foundByName) return foundByName.name;
      if (ing.type === 'RAW') return 'Bahan Mentah';
      if (ing.type === 'PREPARED') return 'Bahan Olahan';
      if (ing.type === 'PACKAGING') return 'Kemasan';
      if (ing.type === 'BEVERAGE') return 'Minuman';
      if (ing.type === 'OTHER') return 'Lainnya';
      return ing.type;
    }
    return 'Lainnya';
  };

  // Helper to check if ingredient matches category filter
  const isIngredientInFilter = (ing: Ingredient, categoryId: string): boolean => {
    if (categoryId === 'ALL') return true;
    if (ing.categoryId === categoryId) return true;
    if (ing.type === categoryId) return true;

    // Check mapping for system categories
    if (categoryId === 'cat_ing_raw') {
      return ing.type === 'RAW' || (!ing.categoryId && ing.name.toLowerCase().includes('mentah'));
    }
    if (categoryId === 'cat_ing_prepared') {
      return ing.type === 'PREPARED' || (!ing.categoryId && !ing.name.toLowerCase().includes('mentah') && !ing.type);
    }
    if (categoryId === 'cat_ing_packaging') {
      return ing.type === 'PACKAGING';
    }
    if (categoryId === 'cat_ing_beverage') {
      return ing.type === 'BEVERAGE' || ing.name.toLowerCase().includes('teh') || ing.name.toLowerCase().includes('sirup');
    }
    if (categoryId === 'cat_ing_other') {
      return ing.type === 'OTHER';
    }

    const catObj = ingredientCategories.find(c => c.id === categoryId);
    if (catObj && ing.type && catObj.name.toLowerCase() === ing.type.toLowerCase()) {
      return true;
    }

    return false;
  };

  // Open Edit Modal with Pre-populated data
  const handleOpenEdit = (ing: Ingredient) => {
    setEditingIng(ing);
    setEditName(ing.name);

    // Resolve category id
    let matchedCatId = ing.categoryId;
    if (!matchedCatId) {
      if (ing.type === 'RAW') matchedCatId = 'cat_ing_raw';
      else if (ing.type === 'PREPARED') matchedCatId = 'cat_ing_prepared';
      else if (ing.type === 'PACKAGING') matchedCatId = 'cat_ing_packaging';
      else if (ing.type === 'BEVERAGE') matchedCatId = 'cat_ing_beverage';
      else if (ing.type === 'OTHER') matchedCatId = 'cat_ing_other';
      else {
        const found = ingredientCategories.find(c => c.id === ing.type || c.name.toLowerCase() === ing.type.toLowerCase());
        matchedCatId = found ? found.id : (ingredientCategories[0]?.id || 'cat_ing_other');
      }
    }
    setEditCategoryId(matchedCatId || 'cat_ing_raw');
    setIsEditAddingNewCatInline(false);
    setEditInlineNewCatName('');

    const sUnit = ing.stockUnit || ing.unit || 'pcs';
    const pUnit = ing.purchaseUnit || sUnit;
    const cFactor = ing.conversionFactor || 1;
    const pPrice = ing.purchasePrice || (ing.costPerUnit ? Math.round(ing.costPerUnit * cFactor) : 0);

    setEditStockUnit(sUnit);
    setEditPurchaseUnit(pUnit);
    setEditConversionFactor(cFactor);
    setEditPurchasePrice(pPrice);
    setEditStock(ing.stock);
    setEditMinStock(ing.minimumStock);
    setEditCritStock(ing.criticalStock);
    setEditCostPerUnit(ing.costPerUnit || 0);
  };

  // Submit Tambah Barang
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnlyStock) return;
    if (!addName.trim()) {
      alert('Nama barang/produk wajib diisi.');
      return;
    }

    const sUnit = addStockUnit.trim() || 'pcs';
    const pUnit = addPurchaseUnit.trim() || sUnit;
    const cFactor = addConversionFactor > 0 ? addConversionFactor : 1;
    const pPrice = addPurchasePrice || 0;
    const calculatedCostPerStockUnit = pPrice > 0 ? Math.round((pPrice / cFactor) * 100) / 100 : addCostPerUnit;

    setIsSubmittingAdd(true);

    try {
      let finalCatId = addCategoryId;

      // If user typed a new category inline
      if (isAddingNewCatInline && inlineNewCatName.trim()) {
        const createdCat = await addIngredientCategory({
          name: inlineNewCatName.trim(),
        });
        finalCatId = createdCat.id;
      }

      if (addItemType === 'RAW') {
        await addIngredient({
          name: addName.trim(),
          type: 'RAW',
          categoryId: finalCatId || 'cat_ing_raw',
          unit: sUnit,
          stockUnit: sUnit,
          purchaseUnit: pUnit,
          conversionFactor: cFactor,
          purchasePrice: pPrice,
          stock: addStock,
          minimumStock: addMinStock,
          criticalStock: addCritStock,
          costPerUnit: calculatedCostPerStockUnit,
          notes: addNotes.trim(),
        });
      } else if (addItemType === 'PACKAGING') {
        await addIngredient({
          name: addName.trim(),
          type: 'PACKAGING',
          categoryId: finalCatId || 'cat_ing_packaging',
          unit: sUnit,
          stockUnit: sUnit,
          purchaseUnit: pUnit,
          conversionFactor: cFactor,
          purchasePrice: pPrice,
          stock: addStock,
          minimumStock: addMinStock,
          criticalStock: addCritStock,
          costPerUnit: calculatedCostPerStockUnit,
          notes: addNotes.trim(),
        });
      } else if (addItemType === 'PRODUK_JADI') {
        await addProduct(
          {
            name: addName.trim(),
            sku: `SKU-${Date.now().toString().slice(-4)}`,
            categoryId: finalCatId || 'cat_ayam',
            category: 'Produk Stok',
            sellingPrice: 0,
            stockUnit: sUnit,
            active: true,
            stockTracked: true,
            stock: addStock,
            isProduction: true,
            productType: 'SINGLE',
            stockSource: 'PRODUCTION',
            minStock: addMinStock,
            criticalStock: addCritStock,
            notes: addNotes.trim(),
          },
          [],
          undefined
        );
      } else if (addItemType === 'READY_TO_SELL') {
        await addProduct(
          {
            name: addName.trim(),
            sku: `SKU-${Date.now().toString().slice(-4)}`,
            categoryId: finalCatId || 'cat_minuman',
            costPerUnit: calculatedCostPerStockUnit,
            purchasePrice: pPrice,
            conversionFactor: cFactor,
            purchaseUnit: pUnit,
            stockUnit: sUnit,
            sellingPrice: addSellingPrice,
            active: true,
            stockTracked: true,
            stock: addStock,
            isProduction: false,
            productType: 'SINGLE',
            stockSource: 'READY_TO_SELL',
            minStock: addMinStock,
            criticalStock: addCritStock,
            notes: addNotes.trim(),
          },
          [],
          undefined
        );
      }

      // Reset Form
      setAddName('');
      setAddStockUnit('pcs');
      setAddPurchaseUnit('pack');
      setAddConversionFactor(100);
      setAddPurchasePrice(10000);
      setAddStock(0);
      setAddMinStock(5);
      setAddCritStock(2);
      setAddCostPerUnit(100);
      setAddSellingPrice(15000);
      setAddNotes('');
      setIsAddingNewCatInline(false);
      setInlineNewCatName('');
      setAddItemType('SELECT');
      setShowAddModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menambahkan barang');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Submit Edit Barang
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnlyStock) return;
    if (!editingIng) return;
    if (!editName.trim()) {
      alert('Nama barang wajib diisi');
      return;
    }

    const sUnit = editStockUnit.trim() || 'pcs';
    const pUnit = editPurchaseUnit.trim() || sUnit;
    const cFactor = editConversionFactor > 0 ? editConversionFactor : 1;
    const pPrice = editPurchasePrice || 0;
    const calculatedCostPerStockUnit = pPrice > 0 ? Math.round((pPrice / cFactor) * 100) / 100 : editCostPerUnit;

    setIsSubmittingEdit(true);

    try {
      let finalCatId = editCategoryId;
      let finalCatType = 'OTHER';

      if (isEditAddingNewCatInline && editInlineNewCatName.trim()) {
        const createdCat = await addIngredientCategory({
          name: editInlineNewCatName.trim(),
        });
        finalCatId = createdCat.id;
        finalCatType = createdCat.name;
      } else {
        const matched = ingredientCategories.find(c => c.id === editCategoryId);
        if (matched) {
          if (matched.id === 'cat_ing_raw') finalCatType = 'RAW';
          else if (matched.id === 'cat_ing_prepared') finalCatType = 'PREPARED';
          else if (matched.id === 'cat_ing_packaging') finalCatType = 'PACKAGING';
          else if (matched.id === 'cat_ing_beverage') finalCatType = 'BEVERAGE';
          else if (matched.id === 'cat_ing_other') finalCatType = 'OTHER';
          else finalCatType = matched.name;
        }
      }

      await updateIngredient(editingIng.id, {
        name: editName.trim(),
        type: finalCatType,
        categoryId: finalCatId,
        unit: sUnit,
        stockUnit: sUnit,
        purchaseUnit: pUnit,
        conversionFactor: cFactor,
        purchasePrice: pPrice,
        stock: editStock,
        minimumStock: editMinStock,
        criticalStock: editCritStock,
        costPerUnit: calculatedCostPerStockUnit,
      });

      setEditingIng(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memperbarui barang');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Submit Hapus Barang
  const handleDeleteSubmit = async () => {
    if (isReadOnlyStock) return;
    if (!deletingIng) return;

    setIsSubmittingDelete(true);
    try {
      await deleteIngredient(deletingIng.id);
      setDeletingIng(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus barang');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Category Manager: Add New Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      alert('Nama kategori wajib diisi');
      return;
    }
    setIsSubmittingCat(true);
    try {
      await addIngredientCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim(),
      });
      setNewCatName('');
      setNewCatDesc('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menambahkan kategori');
    } finally {
      setIsSubmittingCat(false);
    }
  };

  // Category Manager: Update Category
  const handleSaveEditCategory = async (catId: string) => {
    if (!editCatName.trim()) {
      alert('Nama kategori tidak boleh kosong');
      return;
    }
    try {
      await updateIngredientCategory(catId, {
        name: editCatName.trim(),
        description: editCatDesc.trim(),
      });
      setEditingCatId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memperbarui kategori');
    }
  };

  // Category Manager: Delete Category
  const handleDeleteCategory = async (cat: IngredientCategory) => {
    const count = ingredients.filter(i => isIngredientInFilter(i, cat.id)).length;
    if (count > 0) {
      if (!confirm(`Ada ${count} barang yang menggunakan kategori "${cat.name}". Yakin ingin menghapus kategori ini?`)) {
        return;
      }
    } else {
      if (!confirm(`Hapus kategori "${cat.name}"?`)) {
        return;
      }
    }
    try {
      await deleteIngredientCategory(cat.id);
      if (activeCategory === cat.id) {
        setActiveCategory('ALL');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus kategori');
    }
  };

  // Production Submit
  const handleProductionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rawKg <= 0 || preparedPcs <= 0) {
      alert('Jumlah bahan baku & hasil potong harus lebih dari 0.');
      return;
    }
    setIsSubmittingProd(true);
    try {
      await submitChickenProduction(rawKg, preparedPcs, prodNotes);
      setShowProductionModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat produksi';
      alert(msg);
    } finally {
      setIsSubmittingProd(false);
    }
  };

  // Purchase Submit
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseQty <= 0) {
      alert('Jumlah barang masuk harus lebih dari 0.');
      return;
    }
    setIsSubmittingPurchase(true);
    try {
      await submitPurchase(
        supplier || 'Supplier Umum',
        selectedItemId,
        purchaseQty,
        costPerUnit,
        purchaseNotes || '',
        selectedItemType
      );
      setShowPurchaseModal(false);
      setSupplier('');
      setPurchaseNotes('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat barang masuk';
      alert(msg);
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // Opname Submit
  const handleOpnameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetIng = ingredients.find(i => i.id === opnameIngId);
    if (!targetIng) return;
    if (!opnameReason.trim()) {
      alert('Mohon tulis alasan penyesuaian stok.');
      return;
    }
    setIsSubmittingOpname(true);
    try {
      await submitStockOpname(targetIng, physicalCount, opnameReason);
      setShowOpnameModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal stock opname';
      alert(msg);
    } finally {
      setIsSubmittingOpname(false);
    }
  };

  // Helper to identify packaging ingredients
  const isPackagingItem = (i: Ingredient): boolean => {
    return (
      i.type === 'PACKAGING' ||
      i.categoryId === 'cat_ing_packaging' ||
      i.name.toLowerCase().includes('cup') ||
      i.name.toLowerCase().includes('seal') ||
      i.name.toLowerCase().includes('plastik') ||
      i.name.toLowerCase().includes('kresek') ||
      i.name.toLowerCase().includes('dus') ||
      i.name.toLowerCase().includes('box') ||
      i.name.toLowerCase().includes('paper bowl')
    );
  };

  const rawMaterials = useMemo(() => {
    return ingredients.filter(i => !isPackagingItem(i));
  }, [ingredients]);

  const packagingMaterials = useMemo(() => {
    return ingredients.filter(i => isPackagingItem(i));
  }, [ingredients]);

  // Unified Inventory Item representation (read-only view model over existing Ingredient & Product data)
  interface UnifiedInventoryItem {
    uid: string;
    rawId: string;
    sourceType: 'INGREDIENT' | 'PRODUCT';
    groupType: 'BAHAN_BAKU' | 'PRODUK_JADI' | 'KEMASAN';
    groupLabel: 'Bahan Baku' | 'Produk Jadi' | 'Kemasan';
    subCategoryName: string;
    code: string;
    name: string;
    stock: number;
    unit: string;
    hpp: number;
    status: 'SAFE' | 'LOW' | 'CRITICAL';
    ingredientRef?: Ingredient;
    productRef?: Product;
  }

  const allInventoryItems = useMemo<UnifiedInventoryItem[]>(() => {
    const items: UnifiedInventoryItem[] = [];

    // 1. Ingredients (Bahan Baku & Kemasan)
    ingredients.forEach((ing, idx) => {
      const isPkg = isPackagingItem(ing);
      const isKritis = ing.stock <= ing.criticalStock;
      const isMenipis = ing.stock <= ing.minimumStock && !isKritis;
      const status: 'SAFE' | 'LOW' | 'CRITICAL' = isKritis
        ? 'CRITICAL'
        : isMenipis
        ? 'LOW'
        : 'SAFE';
      const unit = ing.stockUnit || ing.unit || 'pcs';
      const code = `BRG-${String(idx + 1).padStart(3, '0')}`;

      items.push({
        uid: `ING:${ing.id}`,
        rawId: ing.id,
        sourceType: 'INGREDIENT',
        groupType: isPkg ? 'KEMASAN' : 'BAHAN_BAKU',
        groupLabel: isPkg ? 'Kemasan' : 'Bahan Baku',
        subCategoryName: getCategoryName(ing),
        code,
        name: ing.name,
        stock: ing.stock ?? 0,
        unit,
        hpp: ing.costPerUnit || 0,
        status,
        ingredientRef: ing,
      });
    });

    // 2. Products (Produk Jadi hasil produksi & Barang Siap Jual berstok fisik)
    products.forEach((prod, idx) => {
      const isProdOutput = isProductionOutputProduct(prod, recipes);
      const isCompositeOrNonTracked =
        prod.stockSource === 'COMPOSITION' ||
        prod.stockSource === 'ASSEMBLY' ||
        prod.stockTracked === false ||
        prod.productType === 'PACKAGE' ||
        Boolean(
          prod.compositionId ||
            prod.assemblyId ||
            (prod.compositionItems && prod.compositionItems.length > 0)
        );
      const isReadyToSell = !isProdOutput && !isCompositeOrNonTracked && prod.stockSource === 'READY_TO_SELL';

      if (!isProdOutput && !isReadyToSell) return;

      const stock = prod.stock ?? 0;
      const critThreshold = prod.criticalStock ?? 0;
      const minThreshold = prod.minStock ?? 5;
      const isKritis = stock <= critThreshold;
      const isMenipis = !isKritis && stock <= minThreshold;
      const status: 'SAFE' | 'LOW' | 'CRITICAL' = isKritis
        ? 'CRITICAL'
        : isMenipis
        ? 'LOW'
        : 'SAFE';

      const unit =
        prod.stockUnit ||
        (prod.name.toLowerCase().includes('teh') ? 'cup' : isProdOutput ? 'porsi' : 'pcs');
      const rec = prod.recipeId ? recipesMap.get(prod.recipeId) : recipesMap.get(prod.id);
      const hpp = prod.costPerUnit || (rec as any)?.hppPerUnit || rec?.totalHpp || 0;
      const code = prod.sku || `PRD-${String(idx + 1).padStart(3, '0')}`;

      items.push({
        uid: `PRD:${prod.id}`,
        rawId: prod.id,
        sourceType: 'PRODUCT',
        groupType: 'PRODUK_JADI',
        groupLabel: 'Produk Jadi',
        subCategoryName: isProdOutput ? 'Hasil Produksi' : 'Siap Jual',
        code,
        name: prod.name,
        stock,
        unit,
        hpp,
        status,
        productRef: prod,
      });
    });

    return items;
  }, [ingredients, products, recipes, recipesMap, ingredientCategories]);

  // Summary counts (unfiltered by search/tab)
  const summaryCounts = useMemo(() => {
    let bahanBaku = 0;
    let produkJadi = 0;
    let kemasan = 0;
    let low = 0;
    let critical = 0;

    allInventoryItems.forEach(item => {
      if (item.groupType === 'BAHAN_BAKU') bahanBaku += 1;
      else if (item.groupType === 'PRODUK_JADI') produkJadi += 1;
      else if (item.groupType === 'KEMASAN') kemasan += 1;

      if (item.status === 'LOW') low += 1;
      if (item.status === 'CRITICAL') critical += 1;
    });

    return {
      total: allInventoryItems.length,
      bahanBaku,
      produkJadi,
      kemasan,
      low,
      critical,
    };
  }, [allInventoryItems]);

  // Filtered items based on active filter tab, category, and search query
  const filteredItems = useMemo(() => {
    return allInventoryItems.filter(item => {
      if (mainFilter === 'BAHAN_BAKU' && item.groupType !== 'BAHAN_BAKU') return false;
      if (mainFilter === 'PRODUK' && item.groupType !== 'PRODUK_JADI') return false;
      if (mainFilter === 'KEMASAN' && item.groupType !== 'KEMASAN') return false;
      if (mainFilter === 'LOW' && item.status !== 'LOW') return false;
      if (mainFilter === 'CRITICAL' && item.status !== 'CRITICAL') return false;

      if (activeCategory !== 'ALL') {
        if (item.sourceType === 'INGREDIENT' && item.ingredientRef) {
          if (!isIngredientInFilter(item.ingredientRef, activeCategory)) return false;
        } else {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchGroup = item.groupLabel.toLowerCase().includes(q);
        const matchSub = item.subCategoryName.toLowerCase().includes(q);
        const matchUnit = item.unit.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchGroup && !matchSub && !matchUnit) return false;
      }

      return true;
    });
  }, [allInventoryItems, mainFilter, activeCategory, searchQuery]);

  // Selection helpers
  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every(it => selectedIds.includes(it.uid));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredItems.map(it => it.uid));
      setSelectedIds(prev => prev.filter(id => !visibleSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredItems.map(it => it.uid)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleSelectItem = (uid: string) => {
    setSelectedIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  // Export CSV helper
  const handleExportCsv = (onlySelected = false) => {
    const targetList = onlySelected
      ? allInventoryItems.filter(it => selectedIds.includes(it.uid))
      : filteredItems;

    if (targetList.length === 0) {
      alert('Tidak ada data barang untuk diekspor.');
      return;
    }

    const headers = ['Kode Barang', 'Nama Barang', 'Kategori', 'Stok Saat Ini', 'Satuan', 'HPP', 'Status'];
    const rows = targetList.map(it => [
      it.code,
      `"${it.name.replace(/"/g, '""')}"`,
      it.groupLabel,
      String(it.stock),
      it.unit,
      String(Math.round(it.hpp)),
      it.status === 'CRITICAL' ? 'Kritis' : it.status === 'LOW' ? 'Menipis' : 'Aman',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stok-master-barang-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportDropdown(false);
  };

  // Bulk delete helper using existing deleteIngredient / deleteProduct
  const handleBulkDelete = async () => {
    if (isReadOnlyStock) return;
    if (selectedIds.length === 0) return;
    if (!confirm(`Hapus ${selectedIds.length} barang yang dipilih dari daftar master stok?`)) return;

    try {
      for (const uid of selectedIds) {
        const found = allInventoryItems.find(it => it.uid === uid);
        if (!found) continue;
        if (found.sourceType === 'INGREDIENT') {
          await deleteIngredient(found.rawId);
        } else if (found.sourceType === 'PRODUCT') {
          await deleteProduct(found.rawId);
        }
      }
      setSelectedIds([]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus beberapa barang.');
    }
  };

  const handleEditItem = (item: UnifiedInventoryItem) => {
    if (isReadOnlyStock) return;
    setOpenRowMenuId(null);
    if (item.sourceType === 'INGREDIENT' && item.ingredientRef) {
      handleOpenEdit(item.ingredientRef);
    } else if (item.sourceType === 'PRODUCT' && item.productRef) {
      setEditingProd(item.productRef);
    }
  };

  const handleDeleteItem = (item: UnifiedInventoryItem) => {
    if (isReadOnlyStock) return;
    setOpenRowMenuId(null);
    if (item.sourceType === 'INGREDIENT' && item.ingredientRef) {
      setDeletingIng(item.ingredientRef);
    } else if (item.sourceType === 'PRODUCT' && item.productRef) {
      setDeletingProd(item.productRef);
    }
  };

  const handleQuickStockIn = (item: UnifiedInventoryItem) => {
    if (isReadOnlyStock) return;
    setOpenRowMenuId(null);
    setSelectedItemId(item.rawId);
    setSelectedItemType(item.sourceType);
    setCostPerUnit(Math.round(item.hpp || 0));
    setPurchaseQty(10);
    setShowPurchaseModal(true);
  };

  const handleQuickOpname = (item: UnifiedInventoryItem) => {
    if (isReadOnlyStock) return;
    setOpenRowMenuId(null);
    if (item.sourceType === 'INGREDIENT') {
      setOpnameIngId(item.rawId);
      setPhysicalCount(item.stock);
      setShowOpnameModal(true);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F7F8FA] w-full max-w-none pb-28 text-[#172033]"
      onClick={() => {
        if (showAddDropdown) setShowAddDropdown(false);
        if (showExportDropdown) setShowExportDropdown(false);
        if (openRowMenuId) setOpenRowMenuId(null);
      }}
    >
      <div className={`w-full ${isDesktopWide ? 'px-4 lg:px-6 py-5' : 'p-4'} space-y-5`}>
        {/* 1. PAGE HEADER */}
        <PageHeader
          title="Stok & Master Barang"
          description={
            isReadOnlyStock
              ? 'Lihat ketersediaan stok bahan baku, kemasan, dan produk jadi.'
              : 'Kelola bahan baku, packaging, dan produk jadi untuk operasional restoran.'
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[#667085] hover:text-[#172033] hover:bg-[#F7F8FA] transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Panduan Stok & Master Barang"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#FF5A1F]" />
                <span>Panduan</span>
              </button>

              {!isReadOnlyStock && (
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setAddItemType('SELECT');
                        setShowAddModal(true);
                        setShowAddDropdown(false);
                      }}
                      className="px-3.5 py-2 rounded-l-xl bg-[#FF6B22] hover:bg-[#F45116] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>+ Tambah Barang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddDropdown(prev => !prev)}
                      className="px-2 py-2 rounded-r-xl bg-[#E85A15] hover:bg-[#D94E0F] text-white text-xs font-bold border-l border-white/20 transition cursor-pointer"
                      title="Pilih jenis barang"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {showAddDropdown && (
                    <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl border border-[#E2E6EC] shadow-lg py-1 z-40 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setAddItemType('RAW');
                          setAddCategoryId('cat_ing_raw');
                          setAddStockUnit('gram');
                          setAddPurchaseUnit('kg');
                          setAddConversionFactor(1000);
                          setAddPurchasePrice(15000);
                          setShowAddModal(true);
                          setShowAddDropdown(false);
                        }}
                        className="w-full px-3.5 py-2 text-left font-semibold text-[#172033] hover:bg-[#F7F8FA] flex items-center gap-2 cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#12B76A]" />
                        <span>+ Bahan Baku</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddItemType('PRODUK_JADI');
                          setAddCategoryId('cat_ayam');
                          setAddStockUnit('porsi');
                          setAddPurchaseUnit('porsi');
                          setAddConversionFactor(1);
                          setAddPurchasePrice(0);
                          setAddSellingPrice(15000);
                          setShowAddModal(true);
                          setShowAddDropdown(false);
                        }}
                        className="w-full px-3.5 py-2 text-left font-semibold text-[#172033] hover:bg-[#F7F8FA] flex items-center gap-2 cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#FF6B22]" />
                        <span>+ Produk Jadi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddItemType('PACKAGING');
                          setAddCategoryId('cat_ing_packaging');
                          setAddStockUnit('pcs');
                          setAddPurchaseUnit('pack');
                          setAddConversionFactor(100);
                          setAddPurchasePrice(10000);
                          setShowAddModal(true);
                          setShowAddDropdown(false);
                        }}
                        className="w-full px-3.5 py-2 text-left font-semibold text-[#172033] hover:bg-[#F7F8FA] flex items-center gap-2 cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>+ Kemasan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddItemType('READY_TO_SELL');
                          setAddCategoryId('cat_minuman');
                          setAddStockUnit('botol');
                          setAddPurchaseUnit('dus');
                          setAddConversionFactor(24);
                          setAddPurchasePrice(60000);
                          setAddSellingPrice(4000);
                          setShowAddModal(true);
                          setShowAddDropdown(false);
                        }}
                        className="w-full px-3.5 py-2 text-left font-semibold text-[#172033] hover:bg-[#F7F8FA] flex items-center gap-2 border-t border-[#E2E6EC] cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>+ Barang Siap Jual</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          }
        />

        {/* 2. COMPACT SUMMARY BAR */}
        <SummaryBar
          items={[
            {
              label: 'Total Semua Barang',
              value: `${summaryCounts.total} Item`,
            },
            {
              label: 'Bahan Baku',
              value: `${summaryCounts.bahanBaku} Item`,
            },
            {
              label: 'Produk Jadi',
              value: `${summaryCounts.produkJadi} Item`,
            },
            {
              label: 'Kemasan',
              value: `${summaryCounts.kemasan} Item`,
            },
          ]}
        />

        {/* 3. FILTER & SEARCH BAR + QUICK ACTIONS */}
        <div className="bg-white rounded-2xl border border-[#E2E6EC] p-3.5 sm:p-4 shadow-2xs space-y-3">
          {/* Filter Tabs + Search Row */}
          <div className={`flex ${isDesktopWide ? 'flex-col lg:flex-row lg:items-center justify-between' : 'flex-col'} gap-3`}>
            <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-0.5 no-scrollbar">
              {[
                { id: 'ALL', label: `Semua Stok (${summaryCounts.total})` },
                { id: 'BAHAN_BAKU', label: `Bahan Baku (${summaryCounts.bahanBaku})` },
                { id: 'PRODUK', label: `Produk Jadi (${summaryCounts.produkJadi})` },
                { id: 'KEMASAN', label: `Kemasan (${summaryCounts.kemasan})` },
                { id: 'LOW', label: `Stok Rendah (${summaryCounts.low})` },
                { id: 'CRITICAL', label: `Stok Kritis (${summaryCounts.critical})` },
              ].map(f => {
                const isActive = mainFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setMainFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                      isActive
                        ? 'bg-[#FF6B22] text-white shadow-2xs'
                        : 'bg-[#F7F8FA] border border-[#E2E6EC] text-[#667085] hover:text-[#172033]'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className={`relative ${isDesktopWide ? 'w-full lg:w-72 shrink-0' : 'w-full'}`}>
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama barang, kategori, atau kode..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#F7F8FA] border border-[#E2E6EC] text-xs font-medium text-[#172033] placeholder-[#98A2B3] focus:outline-none focus:border-[#FF6B22] focus:bg-white transition"
              />
            </div>
          </div>

          {/* Quick Actions + Export Row */}
          {!isReadOnlyStock && (
            <div className="pt-2.5 border-t border-[#E2E6EC] flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 overflow-x-auto flex-nowrap no-scrollbar">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#12B76A]" />
                  <span>+ Beli Bahan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOpnameModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 text-[#FF6B22]" />
                  <span>Stok Opname</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductionModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-[#F79009]" />
                  <span>Potong Ayam</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-[#667085] hover:text-[#172033] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Kategori</span>
                </button>
              </div>

              {/* Export Dropdown */}
              <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setShowExportDropdown(prev => !prev)}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#667085]" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3 text-[#667085]" />
                </button>

                {showExportDropdown && (
                  <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl border border-[#E2E6EC] shadow-lg py-1 z-40 text-xs">
                    <button
                      type="button"
                      onClick={() => handleExportCsv(false)}
                      className="w-full px-3.5 py-2 text-left font-semibold text-[#172033] hover:bg-[#F7F8FA] cursor-pointer"
                    >
                      Export Data Tampil ({filteredItems.length})
                    </button>
                    {selectedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleExportCsv(true)}
                        className="w-full px-3.5 py-2 text-left font-semibold text-[#FF6B22] hover:bg-[#F7F8FA] cursor-pointer"
                      >
                        Export Dipilih ({selectedIds.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. CONDITIONAL BULK ACTION BAR */}
        {!isReadOnlyStock && selectedIds.length > 0 && (
          <div className="bg-[#172033] text-white rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
            <span className="text-xs font-bold">
              {selectedIds.length} barang dipilih
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportCsv(true)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition cursor-pointer"
              >
                Export
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-3 py-1 rounded-lg bg-[#F04438] hover:bg-red-600 text-white text-xs font-semibold transition cursor-pointer"
              >
                Hapus
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* 5. INVENTORY TABLE (DESKTOP) & COMPACT LIST (MOBILE) */}
        <div className="bg-white rounded-2xl border border-[#E2E6EC] shadow-2xs overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-xs font-medium text-[#667085]">
                Tidak ada barang yang sesuai.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMainFilter('ALL');
                  setActiveCategory('ALL');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 rounded-lg border border-[#E2E6EC] bg-white hover:bg-[#F7F8FA] text-[#172033] text-xs font-bold transition cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              {isDesktopWide && (
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E6EC] text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                        {!isReadOnlyStock && (
                          <th className="py-3 pl-4 pr-2 w-10">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 rounded border-[#D0D5DD] text-[#FF6B22] focus:ring-[#FF6B22] cursor-pointer"
                            />
                          </th>
                        )}
                        <th className={`py-3 ${isReadOnlyStock ? 'pl-4 pr-3' : 'px-3'}`}>Barang</th>
                        <th className="py-3 px-3">Kategori</th>
                        <th className="py-3 px-3 text-right">Stok Saat Ini</th>
                        <th className="py-3 px-3">Satuan</th>
                        <th className="py-3 px-3">HPP</th>
                        <th className={`py-3 ${isReadOnlyStock ? 'pl-3 pr-4' : 'px-3'}`}>Status</th>
                        {!isReadOnlyStock && (
                          <th className="py-3 pr-4 pl-3 text-right">Aksi</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E6EC] text-xs">
                      {filteredItems.map(item => {
                        const isSelected = selectedIds.includes(item.uid);
                        const catBadgeClass =
                          item.groupType === 'BAHAN_BAKU'
                            ? 'bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]'
                            : item.groupType === 'PRODUK_JADI'
                            ? 'bg-[#FFF6F0] text-[#C4320A] border-[#FEDF89]'
                            : 'bg-[#F4F3FF] text-[#5925DC] border-[#D9D6FE]';

                        return (
                          <tr
                            key={item.uid}
                            className={`hover:bg-[#F8FAFC] transition ${
                              isSelected ? 'bg-[#FFF6F0]/40' : ''
                            }`}
                          >
                            {/* 1. Checkbox */}
                            {!isReadOnlyStock && (
                              <td className="py-3 pl-4 pr-2 align-middle">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectItem(item.uid)}
                                  className="w-4 h-4 rounded border-[#D0D5DD] text-[#FF6B22] focus:ring-[#FF6B22] cursor-pointer"
                                />
                              </td>
                            )}

                            {/* 2. Barang (Thumbnail + Nama + Kode) */}
                            <td className={`py-3 ${isReadOnlyStock ? 'pl-4 pr-3' : 'px-3'} align-middle`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={getIngredientImageUrl(item.name)}
                                  alt={item.name}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[#F1F4F8] border border-[#E2E6EC]"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-[#172033] truncate">
                                    {item.name}
                                  </div>
                                  <div className="text-[11px] text-[#667085] tabular-nums mt-0.5">
                                    {item.code}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 3. Kategori */}
                            <td className="py-3 px-3 align-middle">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${catBadgeClass}`}
                              >
                                {item.groupLabel}
                              </span>
                            </td>

                            {/* 4. Stok Saat Ini */}
                            <td className="py-3 px-3 align-middle text-right font-bold text-sm text-[#172033] tabular-nums">
                              {formatNumber(item.stock)}
                            </td>

                            {/* 5. Satuan */}
                            <td className="py-3 px-3 align-middle font-medium text-[#667085]">
                              {item.unit}
                            </td>

                            {/* 6. HPP */}
                            <td className="py-3 px-3 align-middle tabular-nums">
                              <span className="font-bold text-[#FF6B22]">
                                {formatRupiah(item.hpp)}
                              </span>
                              <span className="text-[#667085]">/{item.unit}</span>
                            </td>

                            {/* 7. Status */}
                            <td className={`py-3 ${isReadOnlyStock ? 'pl-3 pr-4' : 'px-3'} align-middle`}>
                              {item.status === 'CRITICAL' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3F2] text-[#F04438] border border-[#FECDCA]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#F04438]" />
                                  <span>Kritis</span>
                                </span>
                              ) : item.status === 'LOW' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFFAEB] text-[#F79009] border border-[#FEDF89]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#F79009]" />
                                  <span>Menipis</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF3] text-[#12B76A] border border-[#ABEFC6]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
                                  <span>Aman</span>
                                </span>
                              )}
                            </td>

                            {/* 8. Aksi */}
                            {!isReadOnlyStock && (
                              <td className="py-3 pr-4 pl-3 align-middle text-right">
                                <div
                                  className="inline-flex items-center justify-end gap-1 relative"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleEditItem(item)}
                                    className="p-1.5 rounded-lg text-[#667085] hover:text-[#172033] hover:bg-[#F1F4F8] transition cursor-pointer"
                                    title="Edit Barang"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item)}
                                    className="p-1.5 rounded-lg text-[#667085] hover:text-[#F04438] hover:bg-[#FEF3F2] transition cursor-pointer"
                                    title="Hapus Barang"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenRowMenuId(prev =>
                                        prev === item.uid ? null : item.uid
                                      )
                                    }
                                    className="p-1.5 rounded-lg text-[#667085] hover:text-[#172033] hover:bg-[#F1F4F8] transition cursor-pointer"
                                    title="Aksi Lainnya"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>

                                  {openRowMenuId === item.uid && (
                                    <div className="absolute right-0 top-8 w-44 bg-white rounded-xl border border-[#E2E6EC] shadow-lg py-1 z-40 text-left text-xs">
                                      <button
                                        type="button"
                                        onClick={() => handleQuickStockIn(item)}
                                        className="w-full px-3 py-1.5 text-left font-medium text-[#172033] hover:bg-[#F7F8FA] cursor-pointer"
                                      >
                                        + Beli / Stok Masuk
                                      </button>
                                      {item.sourceType === 'INGREDIENT' && (
                                        <button
                                          type="button"
                                          onClick={() => handleQuickOpname(item)}
                                          className="w-full px-3 py-1.5 text-left font-medium text-[#172033] hover:bg-[#F7F8FA] cursor-pointer"
                                        >
                                          Stok Opname
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleEditItem(item)}
                                        className="w-full px-3 py-1.5 text-left font-medium text-[#172033] hover:bg-[#F7F8FA] border-t border-[#E2E6EC] cursor-pointer"
                                      >
                                        Edit Barang
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteItem(item)}
                                        className="w-full px-3 py-1.5 text-left font-medium text-[#F04438] hover:bg-[#FEF3F2] cursor-pointer"
                                      >
                                        Hapus Barang
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* MOBILE COMPACT LIST */}
              <div className={`${isDesktopWide ? 'md:hidden' : ''} divide-y divide-[#E2E6EC]`}>
                {filteredItems.map(item => {
                  return (
                    <div
                      key={item.uid}
                      className="p-3.5 flex items-start justify-between gap-3 hover:bg-[#F8FAFC] transition"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <img
                          src={getIngredientImageUrl(item.name)}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[#F1F4F8] border border-[#E2E6EC] mt-0.5"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-xs text-[#172033] truncate">
                              {item.name}
                            </h3>
                          </div>

                          <div className="text-[11px] text-[#667085] flex items-center gap-1.5">
                            <span>{item.groupLabel}</span>
                            <span>&middot;</span>
                            <span className="tabular-nums">{item.code}</span>
                          </div>

                          <div className="text-xs flex items-center flex-wrap gap-x-1.5 gap-y-0.5 pt-0.5 tabular-nums">
                            <span className="font-bold text-[#172033]">
                              {formatNumber(item.stock)} {item.unit}
                            </span>
                            <span className="text-[#CBD5E1]">&middot;</span>
                            <span className="text-[11px] text-[#667085]">
                              HPP <strong className="text-[#FF6B22]">{formatRupiah(item.hpp)}</strong>/{item.unit}
                            </span>
                          </div>

                          <div className="pt-1 flex items-center justify-between">
                            {item.status === 'CRITICAL' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F04438]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#F04438]" />
                                <span>Kritis</span>
                              </span>
                            ) : item.status === 'LOW' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F79009]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#F79009]" />
                                <span>Menipis</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#12B76A]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
                                <span>Aman</span>
                              </span>
                            )}

                            {!isReadOnlyStock && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditItem(item)}
                                  className="p-1.5 rounded-lg text-[#667085] hover:text-[#172033] hover:bg-[#F1F4F8] transition cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-1.5 rounded-lg text-[#667085] hover:text-[#F04438] hover:bg-[#FEF3F2] transition cursor-pointer"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: EDIT PRODUK JADI / SIAP JUAL                                       */}
      {/* ========================================================================= */}
      {editingProd && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={async e => {
              e.preventDefault();
              try {
                await updateProduct(editingProd.id, {
                  name: editingProd.name,
                  stock: editingProd.stock,
                  stockUnit: editingProd.stockUnit,
                  costPerUnit: editingProd.costPerUnit,
                  minStock: editingProd.minStock,
                  criticalStock: editingProd.criticalStock,
                });
                setEditingProd(null);
              } catch (err: unknown) {
                alert(err instanceof Error ? err.message : 'Gagal memperbarui produk');
              }
            }}
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-[#E2E6EC] space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-[#E2E6EC] pb-2.5">
              <h3 className="font-extrabold text-sm text-[#172033]">
                Edit Produk: {editingProd.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProd(null)}
                className="p-1 rounded-lg text-[#667085] hover:text-[#172033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#344054] block mb-1">Nama Produk</label>
                <input
                  type="text"
                  required
                  value={editingProd.name}
                  onChange={e => setEditingProd({ ...editingProd, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E6EC] text-xs font-bold text-[#172033]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-[#344054] block mb-1">Stok Saat Ini</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(editingProd.stock ?? 0)}
                    onChange={e =>
                      setEditingProd({
                        ...editingProd,
                        stock: parseNumberInput(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E6EC] text-xs font-bold text-[#172033]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#344054] block mb-1">Satuan</label>
                  <input
                    type="text"
                    value={editingProd.stockUnit || 'pcs'}
                    onChange={e =>
                      setEditingProd({ ...editingProd, stockUnit: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E2E6EC] text-xs font-bold text-[#172033]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#344054] block mb-1">HPP per Satuan (Rp)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(editingProd.costPerUnit ?? 0)}
                  onChange={e =>
                    setEditingProd({
                      ...editingProd,
                      costPerUnit: parseNumberInput(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E6EC] text-xs font-bold text-[#172033]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingProd(null)}
                className="w-1/2 py-2 rounded-xl border border-[#E2E6EC] text-[#667085] font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-1/2 py-2 rounded-xl bg-[#FF6B22] hover:bg-[#F45116] text-white font-bold text-xs"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: HAPUS PRODUK JADI / SIAP JUAL                                      */}
      {/* ========================================================================= */}
      {deletingProd && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-[#E2E6EC] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF3F2] text-[#F04438] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#172033]">
                  Hapus Produk Ini?
                </h3>
                <p className="text-xs text-[#667085] mt-0.5">
                  <strong>{deletingProd.name}</strong> akan dihapus dari daftar produk.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeletingProd(null)}
                className="w-1/2 py-2 rounded-xl border border-[#E2E6EC] text-[#667085] font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteProduct(deletingProd.id);
                    setDeletingProd(null);
                  } catch (err: unknown) {
                    alert(err instanceof Error ? err.message : 'Gagal menghapus produk');
                  }
                }}
                className="w-1/2 py-2 rounded-xl bg-[#F04438] hover:bg-red-600 text-white font-bold text-xs"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KELOLA & TAMBAH KATEGORI BARANG                                    */}
      {/* ========================================================================= */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-orange-600" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Kelola Kategori Barang
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Tambah Kategori Baru */}
            <form
              onSubmit={handleAddCategory}
              className="p-3.5 bg-orange-50/70 dark:bg-orange-950/30 rounded-2xl border border-orange-200 dark:border-orange-800/60 space-y-2.5"
            >
              <h4 className="text-xs font-extrabold text-orange-950 dark:text-orange-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Kategori Baru</span>
              </h4>
              <div>
                <label className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block mb-1">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="Misal: Frozen Food, Sayuran, Bahan Sambal..."
                  required
                  className="w-full px-3 py-1.5 rounded-xl border border-orange-300 dark:border-orange-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block mb-1">
                  Keterangan (opsional)
                </label>
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={e => setNewCatDesc(e.target.value)}
                  placeholder="Misal: Aneka sosis, nugget, dan kentang beku"
                  className="w-full px-3 py-1.5 rounded-xl border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingCat}
                className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition"
              >
                {isSubmittingCat ? 'Menyimpan...' : '+ Tambahkan Kategori'}
              </button>
            </form>

            {/* List Kategori yang Ada */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Daftar Kategori ({ingredientCategories.length})</span>
                <span className="text-[10px] text-slate-400 font-normal">Klik untuk filter</span>
              </h4>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {ingredientCategories.map(cat => {
                  const isEditing = editingCatId === cat.id;
                  const count = ingredients.filter(i => isIngredientInFilter(i, cat.id)).length;

                  if (isEditing) {
                    return (
                      <div
                        key={cat.id}
                        className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-orange-300 dark:border-orange-700 space-y-2"
                      >
                        <input
                          type="text"
                          value={editCatName}
                          onChange={e => setEditCatName(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={editCatDesc}
                          onChange={e => setEditCatDesc(e.target.value)}
                          placeholder="Keterangan..."
                          className="w-full px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-[11px] text-slate-900 dark:text-white"
                        />
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditCategory(cat.id)}
                            className="px-3 py-1 text-[11px] rounded-lg bg-orange-600 text-white font-bold"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={cat.id}
                      className="p-2.5 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-750 flex items-center justify-between gap-2 hover:border-orange-300 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                            {cat.name}
                          </span>
                          {cat.isSystem ? (
                            <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 text-[9px] font-bold">
                              Sistem
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold border border-emerald-200 dark:border-emerald-800">
                              Kustom
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {cat.description || `${count} barang terkait`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {count} item
                        </span>
                        {!cat.isSystem && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCatId(cat.id);
                                setEditCatName(cat.name);
                                setEditCatDesc(cat.description || '');
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-orange-600 transition"
                              title="Ubah Nama Kategori"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 transition"
                              title="Hapus Kategori"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH BARANG BARU                                                 */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            {addItemType === 'SELECT' ? (
              /* STEP 1: PILIH JENIS BARANG */
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#172033] dark:text-white flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-[#FF641F]" />
                      <span>Tambah Barang Baru</span>
                    </h3>
                    <p className="text-[11px] text-[#667085] dark:text-slate-400 mt-0.5">
                      Pilih jenis barang yang ingin Anda tambahkan:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAddItemType('RAW');
                      setAddCategoryId('cat_ing_raw');
                      setAddStockUnit('gram');
                      setAddPurchaseUnit('kg');
                      setAddConversionFactor(1000);
                      setAddPurchasePrice(15000);
                    }}
                    className="p-3.5 rounded-2xl border border-[#E8ECF2] dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-[#FF641F] hover:bg-[#FF641F]/5 text-left transition flex items-start gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-lg shrink-0 group-hover:bg-[#FF641F] group-hover:text-white transition">
                      🥬
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-[#172033] dark:text-white group-hover:text-[#FF641F]">
                        Bahan Baku
                      </h4>
                      <p className="text-[10px] text-[#667085] dark:text-slate-400 mt-0.5 leading-snug">
                        Bahan yang digunakan untuk membuat produk (Ayam Mentah, Beras, Gula, Teh, Cabai, Bawang, Minyak).
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAddItemType('PACKAGING');
                      setAddCategoryId('cat_ing_packaging');
                      setAddStockUnit('pcs');
                      setAddPurchaseUnit('pack');
                      setAddConversionFactor(100);
                      setAddPurchasePrice(10000);
                    }}
                    className="p-3.5 rounded-2xl border border-[#E8ECF2] dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-[#FF641F] hover:bg-[#FF641F]/5 text-left transition flex items-start gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center text-lg shrink-0 group-hover:bg-[#FF641F] group-hover:text-white transition">
                      📦
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-[#172033] dark:text-white group-hover:text-[#FF641F]">
                        Kemasan
                      </h4>
                      <p className="text-[10px] text-[#667085] dark:text-slate-400 mt-0.5 leading-snug">
                        Barang fisik yang digunakan sebagai packaging (Cup 16oz, Seal Cup, Sedotan, Box, Plastik, Kertas Nasi).
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAddItemType('PRODUK_JADI');
                      setAddCategoryId('cat_ayam');
                      setAddStockUnit('porsi');
                      setAddPurchaseUnit('porsi');
                      setAddConversionFactor(1);
                      setAddPurchasePrice(0);
                      setAddSellingPrice(15000);
                    }}
                    className="p-3.5 rounded-2xl border border-[#E8ECF2] dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-[#FF641F] hover:bg-[#FF641F]/5 text-left transition flex items-start gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center text-lg shrink-0 group-hover:bg-[#FF641F] group-hover:text-white transition">
                      🍗
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-[#172033] dark:text-white group-hover:text-[#FF641F]">
                        Produk Jadi
                      </h4>
                      <p className="text-[10px] text-[#667085] dark:text-slate-400 mt-0.5 leading-snug">
                        Produk yang dibuat melalui proses produksi dapur (Ayam Geprek, Teh Manis, Nasi, Sambal).
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAddItemType('READY_TO_SELL');
                      setAddCategoryId('cat_minuman');
                      setAddStockUnit('botol');
                      setAddPurchaseUnit('dus');
                      setAddConversionFactor(24);
                      setAddPurchasePrice(60000);
                      setAddSellingPrice(4000);
                    }}
                    className="p-3.5 rounded-2xl border border-[#E8ECF2] dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-[#FF641F] hover:bg-[#FF641F]/5 text-left transition flex items-start gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-lg shrink-0 group-hover:bg-[#FF641F] group-hover:text-white transition">
                      🛒
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-[#172033] dark:text-white group-hover:text-[#FF641F]">
                        Barang Siap Jual
                      </h4>
                      <p className="text-[10px] text-[#667085] dark:text-slate-400 mt-0.5 leading-snug">
                        Barang yang dibeli dari supplier dan langsung dijual (Aqua 600ml, Teh Botol, Kerupuk, Es Krim).
                      </p>
                    </div>
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="w-full py-2.5 rounded-xl border border-[#E8ECF2] dark:border-slate-800 text-[#667085] font-bold text-xs hover:bg-[#F7F8FA] transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: FORM TAILORED DENGAN TIPE BARANG */
              <form onSubmit={handleAddSubmit} className="space-y-3.5">
                <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAddItemType('SELECT')}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-600"
                      title="Kembali ke Pilihan Jenis"
                    >
                      ←
                    </button>
                    <div>
                      <h3 className="font-extrabold text-sm text-[#172033] dark:text-white">
                        Tambah {addItemType === 'RAW' ? 'Bahan Baku' : addItemType === 'PACKAGING' ? 'Kemasan' : addItemType === 'PRODUK_JADI' ? 'Produk Jadi' : 'Barang Siap Jual'}
                      </h3>
                      <p className="text-[10px] text-[#667085] mt-0.5">
                        Isi informasi {addItemType === 'RAW' ? 'bahan mentah' : addItemType === 'PACKAGING' ? 'packaging' : addItemType === 'PRODUK_JADI' ? 'hasil dapur' : 'retail siap jual'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Nama Barang */}
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {addItemType === 'RAW' ? 'Nama Bahan Baku' : addItemType === 'PACKAGING' ? 'Nama Kemasan' : addItemType === 'PRODUK_JADI' ? 'Nama Produk Jadi' : 'Nama Barang Siap Jual'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addName}
                      onChange={e => setAddName(e.target.value)}
                      placeholder={addItemType === 'RAW' ? 'Misal: Ayam Mentah, Beras, Gula Pasir' : addItemType === 'PACKAGING' ? 'Misal: Cup 16oz, Seal Cup, Sedotan' : addItemType === 'PRODUK_JADI' ? 'Misal: Ayam Geprek, Teh Manis, Sambal' : 'Misal: Aqua 600ml, Teh Botol, Kerupuk'}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-[#FF641F] focus:outline-none"
                    />
                  </div>

                  {/* Kategori */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        Kategori <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAddingNewCatInline(!isAddingNewCatInline)}
                        className="text-[11px] font-bold text-[#FF641F] hover:underline flex items-center gap-1"
                      >
                        {isAddingNewCatInline ? 'Pilih dari Daftar' : '+ Baru'}
                      </button>
                    </div>

                    {isAddingNewCatInline ? (
                      <input
                        type="text"
                        value={inlineNewCatName}
                        onChange={e => setInlineNewCatName(e.target.value)}
                        placeholder="Nama kategori baru..."
                        required={isAddingNewCatInline}
                        className="w-full px-3 py-2 rounded-xl border border-[#FF641F] bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    ) : (
                      <select
                        value={addCategoryId}
                        onChange={e => setAddCategoryId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        {ingredientCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* SATUAN & KONVERSI */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
                      <span className="font-extrabold text-xs text-[#172033] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#FF641F]" />
                        <span>Sistem Satuan &amp; Konversi</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Satuan Stok (Internal) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={addStockUnit}
                          onChange={e => setAddStockUnit(e.target.value)}
                          placeholder="pcs, gram, ml, botol"
                          required
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF641F] focus:outline-none"
                        />
                        <p className="text-[10px] text-[#667085] dark:text-slate-400 mt-0.5">Satuan resep &amp; stok</p>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Satuan Pembelian <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={addPurchaseUnit}
                          onChange={e => setAddPurchaseUnit(e.target.value)}
                          placeholder="pack, dus, kg, liter"
                          required
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF641F] focus:outline-none"
                        />
                        <p className="text-[10px] text-[#667085] dark:text-slate-400 mt-0.5">Satuan saat beli</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Konversi (Isi per {addPurchaseUnit || 'pembelian'})
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-[#667085]">1 {addPurchaseUnit || 'pack'} =</span>
                          <input
                            type="number"
                            min="0.0001"
                            step="any"
                            value={addConversionFactor}
                            onChange={e => setAddConversionFactor(Number(e.target.value))}
                            required
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF641F] focus:outline-none"
                          />
                          <span className="text-xs font-semibold text-[#667085]">{addStockUnit || 'pcs'}</span>
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Harga Beli (Rp / {addPurchaseUnit || 'pack'})
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberInput(addPurchasePrice)}
                          onChange={e => setAddPurchasePrice(parseNumberInput(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Preview Konversi Otomatis */}
                    <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                      <div className="flex justify-between items-center font-bold text-blue-900 dark:text-blue-300">
                        <span>Preview Konversi Otomatis:</span>
                        <span className="text-[#FF641F]">1 {addPurchaseUnit || 'pack'} = {formatNumber(addConversionFactor)} {addStockUnit || 'pcs'}</span>
                      </div>
                      <p className="text-[11px] text-[#667085] dark:text-slate-300">
                        Membeli 1 {addPurchaseUnit || 'pack'} menambah stok <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatNumber(addConversionFactor)} {addStockUnit || 'pcs'}</span>
                      </p>
                      <p className="font-extrabold text-blue-900 dark:text-blue-200 text-xs pt-1 border-t border-blue-200/60 dark:border-blue-800/60">
                        Harga per {addStockUnit || 'pcs'}: {formatRupiah(addConversionFactor > 0 ? addPurchasePrice / addConversionFactor : 0)}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Stock Inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    {(addItemType === 'PRODUK_JADI' || addItemType === 'READY_TO_SELL') && (
                      <div>
                        <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Harga Jual Kasir (Rp) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberInput(addSellingPrice)}
                          onChange={e => setAddSellingPrice(parseNumberInput(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Stok Awal ({addStockUnit || 'pcs'})
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(addStock)}
                        onChange={e => setAddStock(parseNumberInput(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Batas Minimum & Kritis */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Batas Minimum (Menipis)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(addMinStock)}
                        onChange={e => setAddMinStock(parseNumberInput(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Batas Kritis (Habis)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(addCritStock)}
                        onChange={e => setAddCritStock(parseNumberInput(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Catatan */}
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Catatan (opsional)
                    </label>
                    <input
                      type="text"
                      value={addNotes}
                      onChange={e => setAddNotes(e.target.value)}
                      placeholder="Misal: Beli di pasar induk tiap pagi..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddItemType('SELECT')}
                    className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdd}
                    className="w-1/2 py-2.5 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-bold text-xs shadow-md transition"
                  >
                    {isSubmittingAdd ? 'Menyimpan...' : 'Simpan Barang'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UBAH BARANG (TERMASUK MERUBAH SATUAN & KATEGORI)                   */}
      {/* ========================================================================= */}
      {editingIng && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-orange-600" />
                <span>Ubah Data & Satuan Barang</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingIng(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Nama Barang */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nama Barang / Bahan Baku <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                />
              </div>

              {/* Kategori Barang */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Kategori Barang <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEditAddingNewCatInline(!isEditAddingNewCatInline)}
                    className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                  >
                    {isEditAddingNewCatInline ? 'Pilih dari Daftar' : '+ Kategori Baru'}
                  </button>
                </div>

                {isEditAddingNewCatInline ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={editInlineNewCatName}
                      onChange={e => setEditInlineNewCatName(e.target.value)}
                      placeholder="Ketik nama kategori baru..."
                      required={isEditAddingNewCatInline}
                      className="w-full px-3 py-2 rounded-xl border border-orange-300 dark:border-orange-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                    />
                  </div>
                ) : (
                  <select
                    value={editCategoryId}
                    onChange={e => setEditCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {ingredientCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {cat.isSystem ? '(Bawaan)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* SATUAN & KONVERSI EDIT */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 space-y-3">
                <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold border-b border-amber-200/60 dark:border-amber-800/60 pb-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Pengaturan Satuan &amp; Konversi</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Satuan Stok (Internal)
                    </label>
                    <input
                      type="text"
                      value={editStockUnit}
                      onChange={e => setEditStockUnit(e.target.value)}
                      placeholder="pcs, gram, ml"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Satuan Pembelian
                    </label>
                    <input
                      type="text"
                      value={editPurchaseUnit}
                      onChange={e => setEditPurchaseUnit(e.target.value)}
                      placeholder="pack, dus, kg"
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Konversi (1 {editPurchaseUnit || 'pack'} =)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={editConversionFactor}
                        onChange={e => setEditConversionFactor(Number(e.target.value))}
                        required
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      />
                      <span className="text-[11px] font-bold text-[#667085]">{editStockUnit || 'pcs'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Harga Beli (Rp / {editPurchaseUnit || 'pack'})
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberInput(editPurchasePrice)}
                      onChange={e => setEditPurchasePrice(parseNumberInput(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="p-2.5 bg-amber-100/60 dark:bg-amber-900/40 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">
                    ⚠️ Warning: Mengubah satuan stok dapat memengaruhi resep, produksi, dan riwayat stok.
                  </p>
                  <p>
                    1 {editPurchaseUnit || 'pack'} = {formatNumber(editConversionFactor)} {editStockUnit || 'pcs'} &bull; HPP: {formatRupiah(editConversionFactor > 0 ? editPurchasePrice / editConversionFactor : editCostPerUnit)} / {editStockUnit || 'pcs'}
                  </p>
                </div>
              </div>

              {/* Stok Saat Ini & HPP per Satuan */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Stok Saat Ini
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(editStock)}
                    onChange={e => setEditStock(parseNumberInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    HPP per Satuan (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(editCostPerUnit)}
                    onChange={e => setEditCostPerUnit(parseNumberInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Batas Minimum & Kritis */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Batas Minimum
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(editMinStock)}
                    onChange={e => setEditMinStock(parseNumberInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Batas Kritis
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(editCritStock)}
                    onChange={e => setEditCritStock(parseNumberInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingIng(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="w-1/2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md transition"
              >
                {isSubmittingEdit ? 'Menyimpan...' : 'Perbarui Barang'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KONFIRMASI HAPUS BARANG                                            */}
      {/* ========================================================================= */}
      {deletingIng && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Hapus Barang Ini?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
              Barang: <strong>{deletingIng.name}</strong> ({deletingIng.stock} {deletingIng.unit}) akan dihapus dari daftar master stok.
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingIng(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isSubmittingDelete}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition"
              >
                {isSubmittingDelete ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Help Modal                                                                */}
      {/* ========================================================================= */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Panduan Master & Stok Barang
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <FolderPlus className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900 dark:text-white">Tambah Kategori:</strong> Klik tombol <em>+ Kategori</em> untuk menambah kategori baru (misal: Frozen Food, Sayuran, Bahan Minuman) atau buat kategori langsung saat input barang.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900 dark:text-white">Tambah & Hapus Barang:</strong> Anda dapat menambah bahan baku / packaging baru atau menghapus barang yang sudah tidak digunakan.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Edit2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900 dark:text-white">Ubah Satuan:</strong> Klik tombol Ubah pada kartu barang untuk mengganti satuan (contoh: dari <em>kg</em> ke <em>gram</em> atau <em>potong</em> / <em>porsi</em>).
                </p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-slate-900 dark:text-white">Status Otomatis:</strong> Kritis jika stok &le; batas kritis, Menipis jika &le; batas minimum.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2 rounded-xl bg-orange-600 text-white font-bold text-xs"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Produksi Ayam Modal                                                       */}
      {/* ========================================================================= */}
      {showProductionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleProductionSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-600" />
                <span>Produksi / Potong Ayam</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowProductionModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Ayam Mentah Dipotong (kg) - Tersedia: {formatNumber(rawChicken?.stock ?? 0)} kg
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(rawKg)}
                  onChange={e => setRawKg(parseNumberInput(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Hasil Ayam Siap Jual (potong)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(preparedPcs)}
                  onChange={e => setPreparedPcs(parseNumberInput(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Catatan Batch (opsional)
                </label>
                <input
                  type="text"
                  value={prodNotes}
                  onChange={e => setProdNotes(e.target.value)}
                  placeholder="Misal: Batch pagi 5 ekor"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingProd}
              className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs shadow-md"
            >
              {isSubmittingProd ? 'Menyimpan...' : 'Simpan Produksi'}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Barang Masuk Modal                                                        */}
      {/* ========================================================================= */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handlePurchaseSubmit}
            className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E8ECF2] space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E8ECF2] pb-3">
              <h3 className="font-bold text-sm text-[#172033] flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-[#12B76A]" />
                <span>Catat Barang Masuk</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="p-1 rounded-full text-[#98A2B3] hover:text-[#172033]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#172033] block mb-1">
                  Pilih Barang / Produk Masuk
                </label>
                <select
                  value={`${selectedItemType}:${selectedItemId}`}
                  onChange={e => {
                    const [type, id] = e.target.value.split(':') as ['INGREDIENT' | 'PRODUCT', string];
                    setSelectedItemId(id);
                    setSelectedItemType(type);
                    if (type === 'PRODUCT') {
                      const prod = products.find(p => p.id === id);
                      if (prod) {
                        setCostPerUnit((prod as any).costPerUnit || Math.round(prod.sellingPrice * 0.7));
                      }
                    } else {
                      const ing = ingredientsMap.get(id);
                      if (ing) {
                        setCostPerUnit(ing.costPerUnit || 0);
                      }
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                >
                  <optgroup label="⭐ Produk Siap Jual / Tanpa Resep (Stok Langsung Tersedia di Kasir)">
                    {products.map(p => {
                      const rec = p.recipeId ? recipesMap.get(p.recipeId) : undefined;
                      const hasRec = Boolean(
                        rec &&
                        ((rec.items && rec.items.length > 0) ||
                          (rec.batchItems && rec.batchItems.length > 0))
                      );
                      return (
                        <option key={`prod:${p.id}`} value={`PRODUCT:${p.id}`}>
                          {p.name} {hasRec ? '(Olahan Dapur)' : '⚡ (Tanpa Resep - Langsung Tersedia)'} - Stok: {p.stock ?? 0}
                        </option>
                      );
                    })}
                  </optgroup>
                  <optgroup label="🥬 Bahan Baku Dapur">
                    {rawMaterials.map(i => (
                      <option key={`ing:${i.id}`} value={`INGREDIENT:${i.id}`}>
                        {i.name} ({i.unit}) - Stok: {i.stock}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🛍️ Packaging">
                    {packagingMaterials.map(i => (
                      <option key={`pkg:${i.id}`} value={`INGREDIENT:${i.id}`}>
                        {i.name} ({i.unit}) - Stok: {i.stock}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {/* Notice for non-recipe products */}
                {selectedItemType === 'PRODUCT' && (
                  <div className="mt-2 p-2.5 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5]/60 text-[11px] text-[#12B76A] font-medium flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#12B76A]" />
                    <span>
                      <strong>Stok Langsung Tersedia:</strong> Produk siap jual ini akan langsung bertambah stoknya di etalase Kasir (POS) saat dicatat, tanpa perlu produksi dapur.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#172033] block mb-1">
                  Jumlah Masuk
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(purchaseQty)}
                  onChange={e => setPurchaseQty(parseNumberInput(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#172033] block mb-1">
                  Harga Beli / HPP per Satuan (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(costPerUnit)}
                  onChange={e => setCostPerUnit(parseNumberInput(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#172033] block mb-1">
                  Supplier (opsional)
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="Misal: Pasar Unggas / Agen / Titipan"
                  className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#172033] block mb-1">
                  Catatan / No. Nota (opsional)
                </label>
                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={e => setPurchaseNotes(e.target.value)}
                  placeholder="Misal: Nota #1234 atau Kemasan kardus"
                  className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#E8ECF2]">
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="w-1/2 py-2.5 rounded-xl border border-[#E8ECF2] text-[#667085] font-semibold text-xs hover:bg-[#F1F4F8] transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingPurchase}
                className="w-1/2 py-2.5 rounded-xl bg-[#12B76A] hover:bg-[#0E9355] text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
              >
                {isSubmittingPurchase ? 'Menyimpan...' : 'Simpan Masuk'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Stock Opname Modal                                                        */}
      {/* ========================================================================= */}
      {showOpnameModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleOpnameSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-orange-600" />
                <span>Stock Opname Fisik</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowOpnameModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Pilih Bahan
                </label>
                <select
                  value={opnameIngId}
                  onChange={e => {
                    setOpnameIngId(e.target.value);
                    const selected = ingredients.find(i => i.id === e.target.value);
                    if (selected) setPhysicalCount(selected.stock);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                >
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Tercatat: {formatNumber(i.stock)} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Stok Fisik Sebenarnya
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(physicalCount)}
                  onChange={e => setPhysicalCount(parseNumberInput(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Alasan Penyesuaian
                </label>
                <input
                  type="text"
                  value={opnameReason}
                  onChange={e => setOpnameReason(e.target.value)}
                  placeholder="Misal: Rusak, susut timbangan, atau selisih hitung"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingOpname}
              className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs shadow-md"
            >
              {isSubmittingOpname ? 'Menyimpan...' : 'Perbarui Stok Opname'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
