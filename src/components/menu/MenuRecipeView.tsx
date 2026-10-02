import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Product } from '../../types';
import {
  calculateProductAvailability,
  getProductComposition,
  isPosMenuProduct,
  isProductionOutputProduct,
  resolveProductReference,
  resolveIngredientReference,
} from '../../services/stockEngine';
import {
  formatRupiah,
  formatNumberInput,
  parseNumberInput,
  getMenuHpp,
  getProductRecipeHpp,
} from '../../utils/formatters';
import { getProductImageUrl } from '../../utils/productImages';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import { SummaryBar } from '../common/SummaryBar';
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Search,
  Package,
  Layers,
  HelpCircle,
  ShoppingBag,
  Zap,
  CheckCircle2,
  UtensilsCrossed,
  MoreHorizontal,
} from 'lucide-react';

export const MenuRecipeView: React.FC = () => {
  const {
    products,
    productsMap,
    assemblies,
    assembliesMap,
    categories,
    recipes,
    recipesMap,
    ingredients,
    ingredientsMap,
    addProduct,
    updateProduct,
    deleteProduct,
    addProductCategory,
    saveProductComposition,
    submitPurchase,
  } = useApp();
  const { currentRole } = useAuth();

  const [mainTab, setMainTab] = useState<'ALL' | 'SATUAN' | 'PAKET' | 'RETAIL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Quick Purchase modal for direct retail products (Air Mineral, Snack, etc.)
  const [quickPurchaseProduct, setQuickPurchaseProduct] = useState<Product | null>(null);
  const [quickPurchaseQty, setQuickPurchaseQty] = useState<number>(10);
  const [quickPurchaseCost, setQuickPurchaseCost] = useState<number>(1500);
  const [quickPurchaseSupplier, setQuickPurchaseSupplier] = useState<string>('Supplier Retail');
  const [isSubmittingQuickPurchase, setIsSubmittingQuickPurchase] = useState<boolean>(false);

  // ==========================================
  // MODAL STATE: TAMBAH MENU POS BARU
  // ==========================================
  const [showAddModal, setShowAddModal] = useState(false);
  const [addItemType, setAddItemType] = useState<'MENU_POS' | 'FROM_STOCK' | 'RETAIL'>('MENU_POS');
  const [selectedStockType, setSelectedStockType, ] = useState<'PRODUCT' | 'INGREDIENT'>('PRODUCT');
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [addName, setAddName] = useState('');
  const [addSku, setAddSku] = useState('');
  const [addCategoryId, setAddCategoryId] = useState('cat_ayam');
  const [isAddingNewCatInline, setIsAddingNewCatInline] = useState(false);
  const [inlineNewCatName, setInlineNewCatName] = useState('');
  const [addSellingPrice, setAddSellingPrice] = useState<number>(15000);
  const [addOriginalPrice, setAddOriginalPrice] = useState<number>(0);
  const [addCostPerUnit, setAddCostPerUnit] = useState<number>(1500);
  const [addInitialStock, setAddInitialStock] = useState<number>(0);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // ==========================================
  // MODAL STATE: EDIT MENU POS
  // ==========================================
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('cat_ayam');
  const [isEditAddingNewCatInline, setIsEditAddingNewCatInline] = useState(false);
  const [editInlineNewCatName, setEditInlineNewCatName] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState<number>(0);
  const [editOriginalPrice, setEditOriginalPrice] = useState<number>(0);
  const [editCostPerUnit, setEditCostPerUnit] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editActive, setEditActive] = useState<boolean>(true);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // ==========================================
  // MODAL STATE: HAPUS MENU
  // ==========================================
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Only include actual Menu POS items (exclude Produk Hasil Produksi like Ayam Crispy, Sambal, Nasi, Teh Manis Mentah)
  const menuPosProducts = useMemo(() => {
    return products.filter(p => isPosMenuProduct(p, recipes, assemblies));
  }, [products, recipes, assemblies]);

  // Filter products by mainTab, category and search
  const filteredProducts = useMemo(() => {
    return menuPosProducts.filter(p => {
      const isPkg = p.productType === 'PACKAGE' || Boolean(p.packageItems && p.packageItems.length > 0);
      const isRetail = p.stockSource === 'READY_TO_SELL' && !isPkg && p.isProduction === false && p.stockTracked !== false;

      // 1. Tab filter
      if (mainTab === 'SATUAN') {
        if (isPkg || isRetail) return false;
      } else if (mainTab === 'PAKET') {
        if (!isPkg) return false;
      } else if (mainTab === 'RETAIL') {
        if (!isRetail) return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'ALL' && p.categoryId !== selectedCategory) {
        return false;
      }

      // 3. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku?.toLowerCase().includes(q);
        const comp = getProductComposition(p, assembliesMap);
        const matchComp = comp?.some(c => c.sourceName.toLowerCase().includes(q));
        if (!matchName && !matchSku && !matchComp) return false;
      }
      return true;
    });
  }, [menuPosProducts, mainTab, selectedCategory, searchQuery, assembliesMap]);

  // Total Statistics
  const totalMenu = menuPosProducts.length;
  const totalKomposisi = useMemo(() => {
    return menuPosProducts.filter(p => {
      const comp = getProductComposition(p, assembliesMap);
      return Boolean(comp && comp.length > 0);
    }).length;
  }, [menuPosProducts, assembliesMap]);

  const totalPaket = useMemo(() => {
    return menuPosProducts.filter(p => p.productType === 'PACKAGE' || (p.packageItems && p.packageItems.length > 0)).length;
  }, [menuPosProducts]);

  const readyMenuCount = useMemo(() => {
    return menuPosProducts.filter(p => {
      const avail = calculateProductAvailability(
        p,
        p.recipeId ? recipesMap.get(p.recipeId) : undefined,
        ingredientsMap,
        productsMap,
        assembliesMap
      );
      return avail > 0;
    }).length;
  }, [menuPosProducts, recipesMap, ingredientsMap, productsMap, assembliesMap]);

  const avgMenuHpp = useMemo(() => {
    if (menuPosProducts.length === 0) return 0;
    const sum = menuPosProducts.reduce((acc, p) => {
      return acc + getMenuHpp(p, productsMap, ingredientsMap, assembliesMap, recipesMap);
    }, 0);
    return Math.round(sum / menuPosProducts.length);
  }, [menuPosProducts, productsMap, ingredientsMap, assembliesMap, recipesMap]);

  // Open Add Modal
  const handleOpenAdd = () => {
    if (currentRole === 'KASIR') {
      alert('Hanya ADMIN atau OWNER yang berwenang menambah menu POS.');
      return;
    }
    setAddItemType('MENU_POS');
    setSelectedStockType('PRODUCT');
    setSelectedStockId('');
    setAddName('');
    setAddSku(`SKU-${Date.now().toString().slice(-4)}`);
    setAddCategoryId(categories[0]?.id || 'cat_ayam');
    setIsAddingNewCatInline(false);
    setInlineNewCatName('');
    setAddSellingPrice(15000);
    setAddOriginalPrice(0);
    setAddCostPerUnit(1500);
    setAddInitialStock(0);
    setShowAddModal(true);
  };

  // Selection handler when choosing stock item in FROM_STOCK mode
  const handleSelectStockItem = (type: 'PRODUCT' | 'INGREDIENT', id: string) => {
    setSelectedStockType(type);
    setSelectedStockId(id);

    if (!id) return;

    if (type === 'PRODUCT') {
      const prod = productsMap.get(id);
      if (prod) {
        setAddName(prod.name);
        const hpp = getProductRecipeHpp(prod.id, productsMap, recipesMap, ingredientsMap) || prod.costPerUnit || 0;
        setAddCostPerUnit(hpp);
        const suggested = hpp > 0 ? Math.max(15000, Math.ceil((hpp * 1.8) / 1000) * 1000) : 15000;
        setAddSellingPrice(suggested);
      }
    } else {
      const ing = ingredientsMap.get(id);
      if (ing) {
        setAddName(ing.name);
        const hpp = ing.costPerUnit || 0;
        setAddCostPerUnit(hpp);
        const suggested = hpp > 0 ? Math.max(10000, Math.ceil((hpp * 2.0) / 1000) * 1000) : 10000;
        setAddSellingPrice(suggested);
      }
    }
  };

  // Submit Add Form
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      alert('Nama menu POS wajib diisi.');
      return;
    }
    if (addSellingPrice <= 0) {
      alert('Harga jual kasir harus lebih dari Rp 0.');
      return;
    }
    if (addOriginalPrice > 0 && addOriginalPrice < addSellingPrice) {
      alert('Harga coret (harga normal) harus lebih besar atau sama dengan harga jual promo.');
      return;
    }

    if (addItemType === 'FROM_STOCK' && !selectedStockId) {
      alert('Silakan pilih produk stok terlebih dahulu.');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      let finalCatId = addCategoryId;
      if (isAddingNewCatInline && inlineNewCatName.trim()) {
        const newCat = await addProductCategory(inlineNewCatName.trim());
        finalCatId = newCat.id;
      }

      const resolvedAddOriginalPrice =
        addOriginalPrice > addSellingPrice ? addOriginalPrice : addSellingPrice;

      if (addItemType === 'RETAIL') {
        // DIRECT RETAIL PRODUCT (e.g. Aqua, Kerupuk)
        await addProduct(
          {
            name: addName.trim(),
            sku: addSku.trim(),
            categoryId: finalCatId,
            originalPrice: resolvedAddOriginalPrice,
            sellingPrice: addSellingPrice,
            active: true,
            stockTracked: true,
            costPerUnit: addCostPerUnit,
            stock: addInitialStock,
            isProduction: false,
            stockSource: 'READY_TO_SELL',
          },
          []
        );
        setShowAddModal(false);
        alert(`Barang Retail [${addName}] berhasil disimpan!`);
      } else if (addItemType === 'FROM_STOCK') {
        // CREATE POS MENU DIRECTLY LINKED TO A STOCK PRODUCT (1:1 Auto Composition)
        let stockName = '';
        let stockUnit = 'pcs';
        let stockCost = addCostPerUnit;

        if (selectedStockType === 'PRODUCT') {
          const p = productsMap.get(selectedStockId);
          if (p) {
            stockName = p.name;
            stockUnit = p.stockUnit || 'pcs';
            stockCost = getProductRecipeHpp(p.id, productsMap, recipesMap, ingredientsMap) || p.costPerUnit || stockCost;
          }
        } else {
          const ing = ingredientsMap.get(selectedStockId);
          if (ing) {
            stockName = ing.name;
            stockUnit = ing.unit || ing.stockUnit || 'pcs';
            stockCost = ing.costPerUnit || stockCost;
          }
        }

        const newPosMenu = await addProduct(
          {
            name: addName.trim(),
            sku: addSku.trim(),
            categoryId: finalCatId,
            originalPrice: resolvedAddOriginalPrice,
            sellingPrice: addSellingPrice,
            active: true,
            stockTracked: false,
            stock: 0,
            costPerUnit: Math.round(stockCost),
            isProduction: false,
            stockSource: 'COMPOSITION',
          },
          []
        );

        // Auto-save composition linking this POS Menu to 1x of the selected Stock Product
        await saveProductComposition(
          newPosMenu.id,
          [
            {
              sourceType: selectedStockType,
              sourceId: selectedStockId,
              sourceName: stockName || addName.trim(),
              quantity: 1,
              unit: stockUnit,
              costPerUnit: Math.round(stockCost),
              subtotalCost: Math.round(stockCost),
            },
          ],
          'porsi',
          `Otomatis terhubung 1:1 dari produk stok ${stockName}`
        );

        setShowAddModal(false);
        alert(`Menu POS [${addName}] berhasil dibuat dan terhubung ke produk stok [${stockName}]! Sedia dijual di Kasir POS.`);
      } else {
        // STANDARD BLANK MENU POS (Sellable menu on POS, composition added manually later)
        await addProduct(
          {
            name: addName.trim(),
            sku: addSku.trim(),
            categoryId: finalCatId,
            originalPrice: resolvedAddOriginalPrice,
            sellingPrice: addSellingPrice,
            active: true,
            stockTracked: false,
            stock: 0,
            isProduction: false,
            stockSource: 'COMPOSITION',
          },
          []
        );
        setShowAddModal(false);
        alert(`Menu POS [${addName}] berhasil ditambahkan! Silakan tentukan komponennya pada menu 'Komposisi Menu'.`);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menambahkan menu POS');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (p: Product) => {
    if (currentRole === 'KASIR') {
      alert('Hanya ADMIN atau OWNER yang berwenang mengubah menu POS.');
      return;
    }
    setEditingProduct(p);
    setEditName(p.name);
    setEditSku(p.sku || '');
    setEditCategoryId(p.categoryId || categories[0]?.id || 'cat_ayam');
    setIsEditAddingNewCatInline(false);
    setEditInlineNewCatName('');
    setEditSellingPrice(p.sellingPrice);
    setEditOriginalPrice(
      typeof p.originalPrice === 'number' && p.originalPrice > p.sellingPrice
        ? p.originalPrice
        : 0
    );
    setEditCostPerUnit(p.costPerUnit || 0);
    setEditStock(p.stock || 0);
    setEditActive(p.active !== false);
  };

  // Submit Edit Form
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editName.trim()) {
      alert('Nama menu wajib diisi.');
      return;
    }
    if (editSellingPrice <= 0) {
      alert('Harga jual kasir harus lebih dari Rp 0.');
      return;
    }
    if (editOriginalPrice > 0 && editOriginalPrice < editSellingPrice) {
      alert('Harga coret (harga normal) harus lebih besar atau sama dengan harga jual promo.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      let finalCatId = editCategoryId;
      if (isEditAddingNewCatInline && editInlineNewCatName.trim()) {
        const newCat = await addProductCategory(editInlineNewCatName.trim());
        finalCatId = newCat.id;
      }

      const isRetail = editingProduct.stockSource === 'READY_TO_SELL';
      const resolvedEditOriginalPrice =
        editOriginalPrice > editSellingPrice ? editOriginalPrice : editSellingPrice;

      await updateProduct(
        editingProduct.id,
        {
          name: editName.trim(),
          sku: editSku.trim(),
          categoryId: finalCatId,
          originalPrice: resolvedEditOriginalPrice,
          sellingPrice: editSellingPrice,
          active: editActive,
          costPerUnit: isRetail ? editCostPerUnit : editingProduct.costPerUnit,
          stock: isRetail ? editStock : 0,
        },
        []
      );

      setEditingProduct(null);
      alert(`Menu POS [${editName}] berhasil diperbarui!`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal mengubah menu');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete Product
  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setIsSubmittingDelete(true);
    try {
      await deleteProduct(deletingProduct.id);
      setDeletingProduct(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus menu');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Quick Purchase for Retail items
  const handleOpenQuickPurchase = (p: Product) => {
    setQuickPurchaseProduct(p);
    setQuickPurchaseQty(10);
    setQuickPurchaseCost(p.costPerUnit || 1500);
    setQuickPurchaseSupplier('Supplier Retail');
  };

  const handleSubmitQuickPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPurchaseProduct) return;
    if (quickPurchaseQty <= 0) {
      alert('Jumlah barang masuk minimal 1 pcs.');
      return;
    }

    setIsSubmittingQuickPurchase(true);
    try {
      await submitPurchase(
        quickPurchaseSupplier.trim() || 'Supplier Retail',
        quickPurchaseProduct.id,
        quickPurchaseQty,
        quickPurchaseCost,
        `Barang Masuk Retail (${quickPurchaseProduct.name})`,
        'PRODUCT'
      );
      setQuickPurchaseProduct(null);
      alert(`Stok [${quickPurchaseProduct.name}] berhasil ditambah +${quickPurchaseQty} pcs.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memproses barang masuk');
    } finally {
      setIsSubmittingQuickPurchase(false);
    }
  };

  return (
    <PageContainer
      className="pb-24"
      onClick={() => {
        if (openActionMenuId) setOpenActionMenuId(null);
      }}
    >
      {/* PageHeader */}
      <PageHeader
        title="Daftar Menu POS"
        description="Menu yang dijual di Kasir POS (HPP & ketersediaan dihitung otomatis dari Komposisi Menu)."
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowHowItWorksModal(true)}
              className="h-9 px-3.5 rounded-lg bg-white hover:bg-[#F7F8FA] text-[#344054] text-xs font-semibold flex items-center gap-1.5 border border-[#E5E7EB] transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#FF5A1F]" />
              <span>Cara Kerja</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="h-9 px-3.5 rounded-lg bg-[#FF5A1F] hover:bg-[#E04F16] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Tambah Menu POS</span>
            </button>
          </>
        }
      />

      {/* Compact SummaryBar */}
      <SummaryBar
        items={[
          {
            label: 'Total Menu POS',
            value: `${totalMenu} Menu`,
          },
          {
            label: 'Berkomposisi',
            value: `${totalKomposisi} Menu`,
            valueClassName: 'text-[#FF5A1F]',
          },
          {
            label: 'Ready di Kasir',
            value: `${readyMenuCount} Menu`,
            valueClassName: 'text-[#16A34A]',
          },
          {
            label: 'Menu Paket',
            value: `${totalPaket} Paket`,
          },
          {
            label: 'Rata-rata HPP',
            value: formatRupiah(avgMenuHpp),
          },
        ]}
      />

      {/* Compact Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-[#E8ECF2] p-3 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Main Subtabs */}
        <div className="flex items-center gap-1 p-1 bg-[#F7F8FA] border border-[#E8ECF2] rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setMainTab('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
              mainTab === 'ALL'
                ? 'bg-[#172033] text-white shadow-2xs'
                : 'text-[#667085] hover:text-[#172033]'
            }`}
          >
            Semua ({menuPosProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setMainTab('SATUAN')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
              mainTab === 'SATUAN'
                ? 'bg-[#172033] text-white shadow-2xs'
                : 'text-[#667085] hover:text-[#172033]'
            }`}
          >
            Satuan
          </button>
          <button
            type="button"
            onClick={() => setMainTab('PAKET')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
              mainTab === 'PAKET'
                ? 'bg-[#172033] text-white shadow-2xs'
                : 'text-[#667085] hover:text-[#172033]'
            }`}
          >
            Paket ({totalPaket})
          </button>
          <button
            type="button"
            onClick={() => setMainTab('RETAIL')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
              mainTab === 'RETAIL'
                ? 'bg-[#172033] text-white shadow-2xs'
                : 'text-[#667085] hover:text-[#172033]'
            }`}
          >
            Retail / Siap Jual
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari menu / SKU / komponen..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-medium text-[#172033] focus:outline-hidden focus:border-[#FF641F] focus:bg-white transition"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-hidden focus:border-[#FF641F] cursor-pointer"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map(c => {
              if (c.id === 'cat_semua') return null;
              return (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Compact List / Table-List */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8ECF2] p-10 text-center space-y-2">
          <UtensilsCrossed className="w-8 h-8 text-[#98A2B3] mx-auto" />
          <p className="text-sm font-bold text-[#172033]">Tidak ada Menu POS yang ditemukan</p>
          <p className="text-xs text-[#667085]">
            Coba sesuaikan filter pencarian atau tambahkan Menu POS baru.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs overflow-visible">
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8ECF2] bg-[#F8FAFC] text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                  <th className="py-2.5 pl-4 pr-3">Menu</th>
                  <th className="py-2.5 px-3">Jenis</th>
                  <th className="py-2.5 px-3 text-right">Harga</th>
                  <th className="py-2.5 px-3 text-right">HPP</th>
                  <th className="py-2.5 px-3 text-right">Margin</th>
                  <th className="py-2.5 px-3">Komponen &amp; Status</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8ECF2] text-xs">
                {filteredProducts.map(product => {
                  const isPkg =
                    product.productType === 'PACKAGE' ||
                    Boolean(product.packageItems && product.packageItems.length > 0);
                  const composition = getProductComposition(product, assembliesMap);
                  const hasComposition = Boolean(composition && composition.length > 0);
                  const isRetail =
                    product.stockSource === 'READY_TO_SELL' ||
                    (!hasComposition && !isPkg && product.isProduction === false && product.stockTracked !== false);

                  const hpp = getMenuHpp(product, productsMap, ingredientsMap, assembliesMap, recipesMap);
                  const marginRp = product.sellingPrice - hpp;
                  const marginPercent =
                    product.sellingPrice > 0
                      ? ((marginRp / product.sellingPrice) * 100).toFixed(1).replace('.', ',')
                      : '0';

                  const compCount = hasComposition
                    ? composition?.length || 0
                    : isPkg
                    ? product.packageItems?.length || 0
                    : 0;
                  const catName =
                    categories.find(c => c.id === product.categoryId)?.name || 'Umum';

                  return (
                    <tr
                      key={product.id}
                      onClick={() => setSelectedDetailProduct(product)}
                      className="hover:bg-[#F8FAFC] transition cursor-pointer group"
                    >
                      {/* MENU (Foto, Nama, SKU, Kategori) */}
                      <td className="py-2.5 pl-4 pr-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={getProductImageUrl(product.name)}
                            alt={product.name}
                            className="w-9 h-9 rounded-lg object-cover border border-[#E8ECF2] shrink-0"
                            loading="lazy"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#172033] group-hover:text-[#FF641F] transition truncate">
                                {product.name}
                              </span>
                              {product.active === false && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">
                                  Nonaktif
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#667085] flex items-center gap-1.5">
                              <span className="font-mono">{product.sku || '-'}</span>
                              <span>&bull;</span>
                              <span className="truncate">{catName}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* JENIS */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isPkg ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                            Paket
                          </span>
                        ) : isRetail ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-bold">
                            Retail
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F2F4F7] text-[#344054] border border-[#E4E7EC] text-[11px] font-bold">
                            Satuan
                          </span>
                        )}
                      </td>

                      {/* HARGA */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[#172033]">
                        {product.originalPrice && product.originalPrice > product.sellingPrice ? (
                          <div>
                            <span className="text-[10px] text-[#98A2B3] line-through block leading-none">
                              {formatRupiah(product.originalPrice)}
                            </span>
                            <span className="text-[#FF641F]">{formatRupiah(product.sellingPrice)}</span>
                          </div>
                        ) : (
                          formatRupiah(product.sellingPrice)
                        )}
                      </td>

                      {/* HPP */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-[#475467]">
                        {formatRupiah(hpp)}
                      </td>

                      {/* MARGIN */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            marginRp > 0 ? 'text-[#12B76A]' : 'text-[#F04438]'
                          }`}
                        >
                          {marginPercent}%
                        </span>
                      </td>

                      {/* KOMPONEN & STATUS KOMPOSISI */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isRetail ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            <span className="text-[11px] font-semibold text-sky-700">
                              Stok Retail ({product.stock ?? 0} pcs)
                            </span>
                          </div>
                        ) : hasComposition ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
                            <span className="text-[11px] font-semibold text-[#172033]">
                              {compCount} komponen
                            </span>
                            <span className="text-[10px] text-[#12B76A] font-bold">
                              &bull; Aktif
                            </span>
                          </div>
                        ) : isPkg && compCount > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span className="text-[11px] font-semibold text-[#172033]">
                              {compCount} item paket
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-semibold">
                            Belum diatur
                          </span>
                        )}
                      </td>

                      {/* AKSI */}
                      <td
                        className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1 relative">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(product)}
                            className="px-2.5 py-1 rounded-lg border border-[#E8ECF2] bg-white hover:bg-[#F8FAFC] text-[#172033] font-bold text-[11px] transition cursor-pointer"
                          >
                            Edit
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
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-[#E8ECF2] shadow-lg py-1 z-30 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setSelectedDetailProduct(product);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold text-[#172033] hover:bg-[#F8FAFC] flex items-center gap-2 cursor-pointer"
                              >
                                <Layers className="w-3.5 h-3.5 text-[#FF641F]" />
                                <span>Lihat Detail Menu</span>
                              </button>
                              {isRetail && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleOpenQuickPurchase(product);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Kulakan / Barang Masuk</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleOpenEdit(product);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold text-[#172033] hover:bg-[#F8FAFC] flex items-center gap-2 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#667085]" />
                                <span>Edit Menu POS</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setDeletingProduct(product);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-semibold text-[#F04438] hover:bg-[#FEF3F2] flex items-center gap-2 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus Menu</span>
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
            {filteredProducts.map(product => {
              const isPkg =
                product.productType === 'PACKAGE' ||
                Boolean(product.packageItems && product.packageItems.length > 0);
              const composition = getProductComposition(product, assembliesMap);
              const hasComposition = Boolean(composition && composition.length > 0);
              const isRetail =
                product.stockSource === 'READY_TO_SELL' ||
                (!hasComposition && !isPkg && product.isProduction === false && product.stockTracked !== false);

              const hpp = getMenuHpp(product, productsMap, ingredientsMap, assembliesMap, recipesMap);
              const marginRp = product.sellingPrice - hpp;
              const marginPercent =
                product.sellingPrice > 0
                  ? ((marginRp / product.sellingPrice) * 100).toFixed(1).replace('.', ',')
                  : '0';
              const compCount = hasComposition
                ? composition?.length || 0
                : isPkg
                ? product.packageItems?.length || 0
                : 0;

              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedDetailProduct(product)}
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
                        <span className="text-[10px] font-semibold text-[#667085]">
                          &bull; {isPkg ? 'Paket' : isRetail ? 'Retail' : 'Satuan'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#98A2B3] font-mono">
                        {product.sku || '-'}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="font-extrabold text-[#172033]">
                          {formatRupiah(product.sellingPrice)}
                        </span>
                        <span className="text-[#CBD5E1]">&bull;</span>
                        <span className="text-[#667085]">HPP {formatRupiah(hpp)}</span>
                        <span className="text-[#CBD5E1]">&bull;</span>
                        <span
                          className={`font-bold ${
                            marginRp > 0 ? 'text-[#12B76A]' : 'text-[#F04438]'
                          }`}
                        >
                          Margin {marginPercent}%
                        </span>
                      </div>

                      <div className="mt-0.5 text-[11px] text-[#667085]">
                        {isRetail
                          ? `Stok Retail: ${product.stock ?? 0} pcs`
                          : hasComposition
                          ? `${compCount} komponen`
                          : isPkg && compCount > 0
                          ? `${compCount} item paket`
                          : 'Belum ada komposisi'}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(product)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E8ECF2] bg-white text-[#172033] font-bold text-[11px]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingProduct(product)}
                      className="p-1.5 rounded-lg border border-[#E8ECF2] bg-white text-[#667085] hover:text-[#F04438]"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER DETAIL MENU POS (SAAT ROW DIKLIK)                                  */}
      {/* ========================================================================= */}
      {selectedDetailProduct && (() => {
        const product = productsMap.get(selectedDetailProduct.id) || selectedDetailProduct;
        const isPkg =
          product.productType === 'PACKAGE' ||
          Boolean(product.packageItems && product.packageItems.length > 0);
        const composition = getProductComposition(product, assembliesMap);
        const hasComposition = Boolean(composition && composition.length > 0);
        const isRetail =
          product.stockSource === 'READY_TO_SELL' ||
          (!hasComposition && !isPkg && product.isProduction === false && product.stockTracked !== false);
        const hpp = getMenuHpp(product, productsMap, ingredientsMap, assembliesMap, recipesMap);
        const marginRp = product.sellingPrice - hpp;
        const marginPercent =
          product.sellingPrice > 0
            ? ((marginRp / product.sellingPrice) * 100).toFixed(1).replace('.', ',')
            : '0';
        const avail = calculateProductAvailability(
          product,
          product.recipeId ? recipesMap.get(product.recipeId) : undefined,
          ingredientsMap,
          productsMap,
          assembliesMap
        );

        return (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex justify-end"
            onClick={() => setSelectedDetailProduct(null)}
          >
            <div
              className="bg-white w-full max-w-md h-full shadow-2xl border-l border-[#E8ECF2] flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 space-y-5">
                {/* Drawer Header */}
                <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#E8ECF2]">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={getProductImageUrl(product.name)}
                      alt={product.name}
                      className="w-12 h-12 rounded-xl object-cover border border-[#E8ECF2] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-[#EFF8FF] text-[#1570EF] text-[10px] font-extrabold">
                          {isPkg ? 'MENU PAKET' : isRetail ? 'BARANG RETAIL' : 'MENU SATUAN'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            product.active !== false
                              ? 'bg-[#ECFDF3] text-[#12B76A]'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {product.active !== false ? 'Aktif di Kasir' : 'Nonaktif'}
                        </span>
                      </div>
                      <h2 className="text-base font-extrabold text-[#172033] mt-1 truncate">
                        {product.name}
                      </h2>
                      <p className="text-xs text-[#667085] font-mono">
                        SKU: {product.sku || '-'} &bull;{' '}
                        {categories.find(c => c.id === product.categoryId)?.name || 'Umum'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDetailProduct(null)}
                    className="p-1.5 rounded-xl text-[#667085] hover:text-[#172033] hover:bg-[#F8FAFC] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Ringkasan Harga, HPP, Margin & Ketersediaan */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E8ECF2]">
                    <span className="text-[10px] font-bold text-[#667085] uppercase block">
                      Harga Jual
                    </span>
                    <span className="text-sm font-extrabold text-[#172033] mt-0.5 block">
                      {formatRupiah(product.sellingPrice)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E8ECF2]">
                    <span className="text-[10px] font-bold text-[#667085] uppercase block">
                      HPP Menu
                    </span>
                    <span className="text-sm font-extrabold text-[#FF641F] mt-0.5 block">
                      {formatRupiah(hpp)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E8ECF2]">
                    <span className="text-[10px] font-bold text-[#667085] uppercase block">
                      Margin Laba
                    </span>
                    <span className="text-sm font-extrabold text-[#12B76A] mt-0.5 block">
                      {formatRupiah(marginRp)} ({marginPercent}%)
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E8ECF2]">
                    <span className="text-[10px] font-bold text-[#667085] uppercase block">
                      Ketersediaan POS
                    </span>
                    <span
                      className={`text-sm font-extrabold mt-0.5 block ${
                        avail > 0 ? 'text-[#12B76A]' : 'text-[#F04438]'
                      }`}
                    >
                      {avail} {product.stockUnit || 'porsi'}
                    </span>
                  </div>
                </div>

                {/* Detail Komposisi / Isi Paket / Stok Retail */}
                {isRetail ? (
                  <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-sky-900">
                        Stok Fisik Barang Retail
                      </span>
                      <span className="text-xs font-extrabold text-sky-700">
                        {product.stock ?? 0} pcs
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-800">
                      Barang siap jual tanpa produksi dapur. Stok bertambah melalui input kulakan/barang masuk.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDetailProduct(null);
                        handleOpenQuickPurchase(product);
                      }}
                      className="w-full py-2 rounded-xl bg-white border border-sky-300 text-sky-700 font-bold text-xs hover:bg-sky-100/50 transition cursor-pointer"
                    >
                      + Kulakan / Barang Masuk
                    </button>
                  </div>
                ) : hasComposition && composition ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#172033] uppercase tracking-wider">
                        Komposisi Pemotongan Stok ({composition.length})
                      </span>
                      <span className="text-[11px] text-[#667085]">Per 1 porsi terjual</span>
                    </div>
                    <div className="rounded-xl border border-[#E8ECF2] divide-y divide-[#E8ECF2] overflow-hidden">
                      {composition.map((comp, idx) => {
                        let compName = comp.sourceName;
                        let cost = comp.costPerUnit || 0;
                        if (comp.sourceType === 'PRODUCT') {
                          const p = resolveProductReference(comp.sourceId, comp.sourceName, productsMap);
                          if (p) {
                            compName = p.name;
                            cost = getProductRecipeHpp(p.id, productsMap, recipesMap, ingredientsMap) || cost;
                          }
                        } else {
                          const ing = resolveIngredientReference(comp.sourceId, comp.sourceName, ingredientsMap);
                          if (ing) {
                            compName = ing.name;
                            cost = ing.costPerUnit || cost;
                          }
                        }
                        return (
                          <div
                            key={idx}
                            className="px-3 py-2.5 bg-white flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-[#172033] block">{compName}</span>
                              <span className="text-[11px] text-[#667085]">
                                {comp.quantity} {comp.unit} &times; {formatRupiah(cost)}
                              </span>
                            </div>
                            <span className="font-bold text-[#172033]">
                              {formatRupiah(cost * comp.quantity)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : isPkg && product.packageItems && product.packageItems.length > 0 ? (
                  <div className="space-y-2">
                    <span className="text-xs font-extrabold text-[#172033] uppercase tracking-wider block">
                      Isi Menu Paket ({product.packageItems.length})
                    </span>
                    <div className="rounded-xl border border-[#E8ECF2] divide-y divide-[#E8ECF2] overflow-hidden">
                      {product.packageItems.map((pkgItem, idx) => {
                        const compProd = resolveProductReference(
                          pkgItem.productId,
                          pkgItem.productName,
                          productsMap
                        );
                        return (
                          <div
                            key={idx}
                            className="px-3 py-2.5 bg-white flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-[#172033]">
                              {compProd?.name || pkgItem.productName || 'Item Menu'}
                            </span>
                            <span className="font-bold text-[#FF641F]">
                              {pkgItem.quantity}x
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800">
                    Menu ini belum memiliki pengaturan Komposisi Menu. Silakan atur komponen pemotongan stok di modul <strong>Komposisi Menu POS</strong>.
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-[#E8ECF2] bg-[#F8FAFC] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetailProduct(null);
                    handleOpenEdit(product);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Menu POS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetailProduct(null);
                    setDeletingProduct(product);
                  }}
                  className="p-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
                  title="Hapus Menu POS"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ========================================================================= */}
      {/* MODAL: BAGAIMANA STRUKTUR MENU POS BEKERJA                                 */}
      {/* ========================================================================= */}
      {showHowItWorksModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
                <UtensilsCrossed className="w-5 h-5 text-orange-500" />
                <span>Konsep Menu POS & Komposisi Penjualan</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHowItWorksModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-2xl border border-orange-200 dark:border-orange-800/60 space-y-1.5">
                <p className="font-bold text-orange-900 dark:text-orange-200">
                  1. Menu POS Adalah Barang Jualan
                </p>
                <p className="text-[11px]">
                  Menu POS (misal: <em>Ayam Geprek</em>, <em>Paket Mantul</em>) tidak memiliki resep dapur dan tidak memiliki stok fisik. Menu POS hanya memiliki nama, harga jual, dan foto.
                </p>
              </div>

              <div className="p-3 bg-sky-50 dark:bg-sky-950/30 rounded-2xl border border-sky-200 dark:border-sky-800/60 space-y-1.5">
                <p className="font-bold text-sky-950 dark:text-sky-200">
                  2. Komposisi Penjualan
                </p>
                <p className="text-[11px]">
                  Setiap menu POS dihubungkan dengan komponen Produk 1/2 Jadi (misal: <strong>Ayam Crispy x1, Sambal x1, Nasi x1, Kemasan x1</strong>). HPP Menu dihitung otomatis dari penjumlahan HPP komponen tersebut.
                </p>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                <p className="font-bold text-emerald-900 dark:text-emerald-200">
                  3. Transaksi di Kasir
                </p>
                <p className="text-[11px]">
                  Saat menu POS terjual di kasir, sistem langsung memotong stok Produk 1/2 Jadi komponennya secara otomatis tanpa memotong stok Menu POS.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowHowItWorksModal(false)}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH MENU POS BARU (SEDERHANA & BERSIH)                           */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitAdd}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Tambah Menu POS Baru
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Masukkan informasi menu untuk dijual kepada pelanggan di Kasir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pilihan Jenis Barang */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAddItemType('MENU_POS')}
                className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  addItemType === 'MENU_POS'
                    ? 'bg-orange-500/10 border-orange-500 text-orange-700 dark:text-orange-400 ring-2 ring-orange-500/20'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`p-1 rounded-xl ${addItemType === 'MENU_POS' ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-black text-[11px]">Menu POS Custom</span>
                </div>
                <p className="text-[9px] mt-1 opacity-80 leading-tight">
                  Buat menu POS kustom. Komposisi diatur terpisah.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAddItemType('FROM_STOCK')}
                className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  addItemType === 'FROM_STOCK'
                    ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-400 ring-2 ring-purple-500/20'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`p-1 rounded-xl ${addItemType === 'FROM_STOCK' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-black text-[11px]">Dari Produk Stok</span>
                </div>
                <p className="text-[9px] mt-1 opacity-80 leading-tight">
                  Pilih dari Produk Dapur / Stok untuk langsung dijual 1:1.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAddItemType('RETAIL')}
                className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  addItemType === 'RETAIL'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-400 ring-2 ring-sky-500/20'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`p-1 rounded-xl ${addItemType === 'RETAIL' ? 'bg-sky-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-black text-[11px]">Barang Retail</span>
                </div>
                <p className="text-[9px] mt-1 opacity-80 leading-tight">
                  Barang kulakan siap jual (Air Mineral, Kerupuk).
                </p>
              </button>
            </div>

            {/* FROM_STOCK Selection Box */}
            {addItemType === 'FROM_STOCK' && (
              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Pilih Produk Stok untuk Dijadikan Menu POS</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStockType('PRODUCT');
                      setSelectedStockId('');
                    }}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${
                      selectedStockType === 'PRODUCT'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Produk Dapur / Olahan ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStockType('INGREDIENT');
                      setSelectedStockId('');
                    }}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${
                      selectedStockType === 'INGREDIENT'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Bahan / Stok Barang ({ingredients.length})
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Pilih Item dari Stok <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedStockId}
                    onChange={e => handleSelectStockItem(selectedStockType, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-900 dark:text-white"
                    required
                  >
                    <option value="">-- Pilih Item dari Daftar Stok --</option>
                    {selectedStockType === 'PRODUCT'
                      ? products.map(p => {
                          const hpp = getProductRecipeHpp(p.id, productsMap, recipesMap, ingredientsMap) || p.costPerUnit || 0;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stok: {p.stock || 0} {p.stockUnit || 'pcs'} | HPP: {formatRupiah(hpp)})
                            </option>
                          );
                        })
                      : ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (Stok: {ing.stock || 0} {ing.unit} | HPP: {formatRupiah(ing.costPerUnit)})
                          </option>
                        ))}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Nama Menu */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nama Menu POS <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder={
                    addItemType === 'FROM_STOCK'
                      ? 'Pilih produk stok di atas atau ketik nama menu...'
                      : addItemType === 'MENU_POS'
                      ? 'Misal: Ayam Geprek Sambal Bawang'
                      : 'Misal: Air Mineral 600ml'
                  }
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                />
              </div>

              {/* Kategori & SKU */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCatInline(!isAddingNewCatInline)}
                      className="text-[10px] font-bold text-orange-600 hover:underline cursor-pointer"
                    >
                      {isAddingNewCatInline ? 'Pilih' : '+ Baru'}
                    </button>
                  </div>

                  {isAddingNewCatInline ? (
                    <input
                      type="text"
                      value={inlineNewCatName}
                      onChange={e => setInlineNewCatName(e.target.value)}
                      placeholder="Nama kategori..."
                      required
                      className="w-full px-3 py-2 rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/30 font-bold text-slate-900 dark:text-white"
                    />
                  ) : (
                    <select
                      value={addCategoryId}
                      onChange={e => setAddCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                    >
                      {categories.map(c => {
                        if (c.id === 'cat_semua') return null;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Kode SKU / Barcode
                  </label>
                  <input
                    type="text"
                    value={addSku}
                    onChange={e => setAddSku(e.target.value)}
                    placeholder="SKU-1001"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Harga Dasar Produk */}
              <div className="space-y-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Harga Dasar Produk / Normal (Rp) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberInput(addSellingPrice)}
                      onChange={e => setAddSellingPrice(parseNumberInput(e.target.value))}
                      required
                      className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Harga promo / harga coret per channel (Offline, GoFood, GrabFood, ShopeeFood) diatur melalui menu <strong>Diskon &amp; Harga Promo</strong>.
                  </p>
                </div>
              </div>

              {/* Form Khusus Barang Retail */}
              {addItemType === 'RETAIL' && (
                <div className="p-3 bg-sky-50 dark:bg-sky-950/30 rounded-2xl border border-sky-200 dark:border-sky-800/60 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Harga Modal Beli (Rp)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(addCostPerUnit)}
                        onChange={e => setAddCostPerUnit(parseNumberInput(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Stok Awal Toko (pcs)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={addInitialStock}
                        onChange={e => setAddInitialStock(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Info Banner untuk Menu POS */}
              {addItemType === 'MENU_POS' && (
                <div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-[11px] text-orange-800 dark:text-orange-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <span>
                    Setelah menu disimpan, tentukan Produk 1/2 Jadi apa saja yang digunakan (misal: <em>Ayam Crispy 1 pcs, Sambal 1 porsi, Nasi 1 porsi</em>) pada menu <strong>Komposisi Menu</strong>.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingAdd}
                className="px-5 py-2 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingAdd ? 'Menyimpan...' : 'Simpan Menu POS'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT MENU POS                                                       */}
      {/* ========================================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitEdit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Ubah Menu POS
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Perbarui nama, kategori, harga dasar produk, atau status aktif
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Nama Menu */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nama Menu POS <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                />
              </div>

              {/* Kategori & SKU */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsEditAddingNewCatInline(!isEditAddingNewCatInline)}
                      className="text-[10px] font-bold text-orange-600 hover:underline cursor-pointer"
                    >
                      {isEditAddingNewCatInline ? 'Pilih' : '+ Baru'}
                    </button>
                  </div>

                  {isEditAddingNewCatInline ? (
                    <input
                      type="text"
                      value={editInlineNewCatName}
                      onChange={e => setEditInlineNewCatName(e.target.value)}
                      placeholder="Nama kategori..."
                      required
                      className="w-full px-3 py-2 rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/30 font-bold text-slate-900 dark:text-white"
                    />
                  ) : (
                    <select
                      value={editCategoryId}
                      onChange={e => setEditCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                    >
                      {categories.map(c => {
                        if (c.id === 'cat_semua') return null;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Kode SKU / Barcode
                  </label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={e => setEditSku(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Harga Dasar Produk */}
              <div className="space-y-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Harga Dasar Produk / Normal (Rp) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberInput(editSellingPrice)}
                      onChange={e => setEditSellingPrice(parseNumberInput(e.target.value))}
                      required
                      className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Harga promo / harga coret per aplikasi (Offline, GoFood, GrabFood, ShopeeFood) diatur melalui menu <strong>Diskon &amp; Harga Promo</strong> tanpa mengubah harga dasar ini.
                  </p>
                </div>
              </div>

              {/* Status Aktif Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">Status Penjualan</span>
                  <span className="text-[10px] text-slate-400">Tampilkan menu ini di Kasir POS</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={e => setEditActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-orange-600" />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="px-5 py-2 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: HAPUS MENU                                                         */}
      {/* ========================================================================= */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Hapus Menu POS?
                </h3>
                <p className="text-[10px] text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Apakah Anda yakin ingin menghapus menu <strong>{deletingProduct.name}</strong> dari daftar penjualan Kasir?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmittingDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingDelete ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KULAKAN / BARANG MASUK RETAIL                                      */}
      {/* ========================================================================= */}
      {quickPurchaseProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitQuickPurchase}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Barang Masuk / Kulakan
                  </h3>
                  <p className="text-[10px] text-slate-400">{quickPurchaseProduct.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickPurchaseProduct(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Jumlah Barang Masuk (pcs) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quickPurchaseQty}
                  onChange={e => setQuickPurchaseQty(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Harga Beli per Satuan (Rp) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberInput(quickPurchaseCost)}
                    onChange={e => setQuickPurchaseCost(parseNumberInput(e.target.value))}
                    required
                    className="w-full pl-8 pr-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nama Supplier / Toko
                </label>
                <input
                  type="text"
                  value={quickPurchaseSupplier}
                  onChange={e => setQuickPurchaseSupplier(e.target.value)}
                  placeholder="Misal: Grosir Sumber Rejeki"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t dark:border-slate-800">
              <button
                type="button"
                onClick={() => setQuickPurchaseProduct(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingQuickPurchase}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingQuickPurchase ? 'Menyimpan...' : 'Tambah Stok Masuk'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageContainer>
  );
};
