import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, AssemblyItem } from '../../types';
import { formatRupiah, formatNumber, getProductRecipeHpp } from '../../utils/formatters';
import {
  calculateProductAvailability,
  getProductComposition,
  isPosMenuProduct,
  isProductionOutputProduct,
  resolveProductReference,
  resolveIngredientReference,
} from '../../services/stockEngine';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import { SummaryBar } from '../common/SummaryBar';
import {
  Boxes as BoxesIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Edit2 as Edit2Icon,
  Trash2 as Trash2Icon,
  CheckCircle2 as CheckCircle2Icon,
  AlertTriangle as AlertTriangleIcon,
  Layers as LayersIcon,
  X as XIcon,
  TrendingUp as TrendingUpIcon,
  ShoppingBag as ShoppingBagIcon,
  Package as PackageIcon,
  HelpCircle as HelpCircleIcon,
  Check as CheckIcon,
  MoreHorizontal as MoreHorizontalIcon,
  Eye as EyeIcon,
} from 'lucide-react';

export const AssemblyView: React.FC = () => {
  const {
    products,
    productsMap,
    recipes,
    recipesMap,
    ingredientsMap,
    assemblies,
    assembliesMap,
    categories,
    saveProductComposition,
    deleteProductComposition,
  } = useApp();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'WITH_COMPOSITION' | 'WITHOUT_COMPOSITION' | 'PACKAGE'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Modals & Drawer
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [drawerProductId, setDrawerProductId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Delete Confirm
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Form State
  const [formProductId, setFormProductId] = useState('');
  const [formName, setFormName] = useState('');
  const [formResultUnit, setFormResultUnit] = useState('porsi');
  const [formComponents, setFormComponents] = useState<AssemblyItem[]>([
    { sourceType: 'PRODUCT', sourceId: '', sourceName: '', quantity: 1, unit: 'pcs', costPerUnit: 0, subtotalCost: 0 },
  ]);
  const [formNotes, setFormNotes] = useState('');

  // Products availability map
  const productAvailabilityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const rec = p.recipeId ? recipesMap.get(p.recipeId) : undefined;
      const avail = calculateProductAvailability(p, rec, ingredientsMap, productsMap, assembliesMap);
      map.set(p.id, avail);
    }
    return map;
  }, [products, recipesMap, ingredientsMap, productsMap, assembliesMap]);

  // Only include actual Menu POS items as target cards (exclude Produk Hasil Produksi like Ayam Crispy, Sambal, Nasi, Teh Manis Mentah)
  const menuPosProducts = useMemo(() => {
    return products.filter(p => isPosMenuProduct(p, recipes, assemblies));
  }, [products, recipes, assemblies]);

  // Selectable component products (Produk Hasil Produksi first, plus non-package single items if needed)
  const selectableComponentProducts = useMemo(() => {
    return products
      .filter(p => p.id !== formProductId && p.productType !== 'PACKAGE')
      .sort((a, b) => {
        const aProd = isProductionOutputProduct(a, recipes) ? 0 : 1;
        const bProd = isProductionOutputProduct(b, recipes) ? 0 : 1;
        if (aProd !== bProd) return aProd - bProd;
        return a.name.localeCompare(b.name);
      });
  }, [products, recipes, formProductId]);

  // Statistics (based strictly on Menu POS)
  const totalMenuPos = menuPosProducts.length;
  const productsWithComposition = useMemo(() => {
    return menuPosProducts.filter(p => {
      const comp = getProductComposition(p, assembliesMap);
      return Boolean(comp && comp.length > 0);
    }).length;
  }, [menuPosProducts, assembliesMap]);

  const readyToSellCount = useMemo(() => {
    let count = 0;
    for (const p of menuPosProducts) {
      if ((productAvailabilityMap.get(p.id) ?? 0) > 0) count++;
    }
    return count;
  }, [menuPosProducts, productAvailabilityMap]);

  const avgHpp = useMemo(() => {
    if (menuPosProducts.length === 0) return 0;
    const sum = menuPosProducts.reduce((acc, p) => {
      const comp = getProductComposition(p, assembliesMap);
      if (comp && comp.length > 0) {
        const compHpp = comp.reduce((cSum, it) => cSum + (it.quantity || 1) * (it.costPerUnit || 0), 0);
        return acc + compHpp;
      }
      return acc + (p.costPerUnit || 0);
    }, 0);
    return Math.round(sum / menuPosProducts.length);
  }, [menuPosProducts, assembliesMap]);

  // Filtered List of MENU POS
  const filteredProducts = useMemo(() => {
    return menuPosProducts.filter(p => {
      const hasComp = Boolean(getProductComposition(p, assembliesMap)?.length);
      const isPkg = p.productType === 'PACKAGE' || Boolean(p.packageItems && p.packageItems.length > 0);

      // 1. Tab filter
      if (filterTab === 'WITH_COMPOSITION' && !hasComp) return false;
      if (filterTab === 'WITHOUT_COMPOSITION' && (hasComp || isPkg)) return false;
      if (filterTab === 'PACKAGE' && !isPkg) return false;

      // 2. Category filter
      if (filterCategory !== 'ALL' && p.categoryId !== filterCategory) return false;

      // 3. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = p.sku?.toLowerCase().includes(q);

        // Match by component names
        const comp = getProductComposition(p, assembliesMap);
        const compMatch = comp?.some(c => c.sourceName.toLowerCase().includes(q));

        // Match by package items
        const pkgMatch = p.packageItems?.some(pkg => pkg.productName?.toLowerCase().includes(q));

        if (!nameMatch && !skuMatch && !compMatch && !pkgMatch) return false;
      }

      return true;
    });
  }, [menuPosProducts, filterTab, filterCategory, searchQuery, assembliesMap]);

  const drawerProduct = useMemo(() => {
    if (!drawerProductId) return null;
    return productsMap.get(drawerProductId) || menuPosProducts.find(p => p.id === drawerProductId) || null;
  }, [drawerProductId, productsMap, menuPosProducts]);

  // Open Create / Add modal for a specific product
  const handleOpenConfigure = (p: Product) => {
    setSelectedProductForModal(p);
    setFormProductId(p.id);
    setFormName(`Komposisi ${p.name}`);
    setFormResultUnit(p.stockUnit || 'porsi');
    setFormNotes(p.notes || '');

    const existingComp = getProductComposition(p, assembliesMap);
    if (existingComp && existingComp.length > 0) {
      setFormComponents(
        existingComp.map(c => {
          let cost = c.costPerUnit || 0;
          if (c.sourceType === 'PRODUCT') {
            const resolvedProd = resolveProductReference(c.sourceId, c.sourceName, productsMap);
            const targetId = resolvedProd?.id || c.sourceId;
            cost = getProductRecipeHpp(targetId, productsMap, recipesMap, ingredientsMap);
            return {
              ...c,
              sourceId: targetId,
              sourceName: resolvedProd?.name || c.sourceName,
              costPerUnit: cost,
              subtotalCost: (c.quantity || 1) * cost,
            };
          } else {
            const ing = resolveIngredientReference(c.sourceId, c.sourceName, ingredientsMap);
            cost = ing?.costPerUnit || cost;
            return {
              ...c,
              sourceId: ing?.id || c.sourceId,
              sourceName: ing?.name || c.sourceName,
              costPerUnit: cost,
              subtotalCost: (c.quantity || 1) * cost,
            };
          }
        })
      );
    } else {
      // Default blank 2 components
      setFormComponents([
        { sourceType: 'PRODUCT', sourceId: '', sourceName: '', quantity: 1, unit: 'pcs', costPerUnit: 0, subtotalCost: 0 },
        { sourceType: 'INGREDIENT', sourceId: '', sourceName: '', quantity: 1, unit: 'pcs', costPerUnit: 0, subtotalCost: 0 },
      ]);
    }
    setShowFormModal(true);
  };

  // Open General Create Form (Select product from dropdown)
  const handleOpenGeneralCreate = () => {
    const firstWithoutComp = menuPosProducts.find(p => !getProductComposition(p, assembliesMap)?.length) || menuPosProducts[0];
    if (firstWithoutComp) {
      handleOpenConfigure(firstWithoutComp);
    } else {
      setFormProductId('');
      setFormName('');
      setFormResultUnit('porsi');
      setFormComponents([
        { sourceType: 'PRODUCT', sourceId: '', sourceName: '', quantity: 1, unit: 'pcs', costPerUnit: 0, subtotalCost: 0 },
      ]);
      setFormNotes('');
      setShowFormModal(true);
    }
  };

  // Handle Product Selection in Form Header
  const handleSelectTargetProduct = (prodId: string) => {
    setFormProductId(prodId);
    const prod = productsMap.get(prodId);
    if (prod) {
      setSelectedProductForModal(prod);
      setFormName(`Komposisi ${prod.name}`);
      if (prod.stockUnit) {
        setFormResultUnit(prod.stockUnit);
      }
      const existingComp = getProductComposition(prod, assembliesMap);
      if (existingComp && existingComp.length > 0) {
        setFormComponents(
          existingComp.map(c => {
            let cost = c.costPerUnit || 0;
            if (c.sourceType === 'PRODUCT') {
              cost = getProductRecipeHpp(c.sourceId, productsMap, recipesMap, ingredientsMap);
            } else {
              const ing = ingredientsMap.get(c.sourceId);
              cost = ing?.costPerUnit || cost;
            }
            return {
              ...c,
              costPerUnit: cost,
              subtotalCost: (c.quantity || 1) * cost,
            };
          })
        );
      }
    }
  };

  // Update Component Item in Form
  const handleUpdateComponent = (index: number, fields: Partial<AssemblyItem>) => {
    setFormComponents(prev => {
      const next = [...prev];
      const current = { ...next[index], ...fields };

      // Recalculate name, unit, and cost if item or type changed
      if (fields.sourceType !== undefined || fields.sourceId !== undefined) {
        if (current.sourceType === 'PRODUCT') {
          const prod = productsMap.get(current.sourceId);
          if (prod) {
            current.sourceName = prod.name;
            current.unit = prod.stockUnit || 'pcs';
            const recHpp = getProductRecipeHpp(prod.id, productsMap, recipesMap, ingredientsMap);
            current.costPerUnit = recHpp > 0 ? recHpp : (prod.costPerUnit || 0);
          } else {
            current.sourceName = '';
            current.costPerUnit = 0;
          }
        } else {
          const ing = ingredientsMap.get(current.sourceId);
          if (ing) {
            current.sourceName = ing.name;
            current.unit = ing.unit || ing.stockUnit || 'pcs';
            current.costPerUnit = ing.costPerUnit || 0;
          } else {
            current.sourceName = '';
            current.costPerUnit = 0;
          }
        }
      }

      const qty = typeof current.quantity === 'number' ? Math.max(0, current.quantity) : 0;
      current.subtotalCost = qty * (current.costPerUnit || 0);

      next[index] = current;
      return next;
    });
  };

  const handleAddComponentRow = () => {
    setFormComponents(prev => [
      ...prev,
      { sourceType: 'PRODUCT', sourceId: '', sourceName: '', quantity: 1, unit: 'pcs', costPerUnit: 0, subtotalCost: 0 },
    ]);
  };

  const handleRemoveComponentRow = (index: number) => {
    if (formComponents.length <= 1) {
      alert('Komposisi menu harus memiliki minimal 1 komponen.');
      return;
    }
    setFormComponents(prev => prev.filter((_, idx) => idx !== index));
  };

  // Calculated Total HPP for Form
  const formCalculatedHpp = useMemo(() => {
    return formComponents.reduce((sum, item) => {
      const qty = item.quantity || 0;
      let cost = item.costPerUnit || 0;
      if (item.sourceType === 'PRODUCT') {
        cost = getProductRecipeHpp(item.sourceId, productsMap, recipesMap, ingredientsMap);
      } else {
        const ing = ingredientsMap.get(item.sourceId);
        if (ing && ing.costPerUnit) cost = ing.costPerUnit;
      }
      return sum + qty * cost;
    }, 0);
  }, [formComponents, productsMap, recipesMap, ingredientsMap]);

  // Form estimated yield based on current components
  const formEstimatedAvailability = useMemo(() => {
    let minAvail = Infinity;
    for (const comp of formComponents) {
      if (!comp.sourceId) continue;
      const req = comp.quantity || 1;
      let stock = 0;
      if (comp.sourceType === 'PRODUCT') {
        const p = resolveProductReference(comp.sourceId, comp.sourceName, productsMap);
        stock = p ? (productAvailabilityMap.get(p.id) ?? 0) : 0;
      } else {
        const ing = resolveIngredientReference(comp.sourceId, comp.sourceName, ingredientsMap);
        stock = ing && typeof ing.stock === 'number' ? ing.stock : 0;
      }
      const yieldForComp = Math.floor(stock / req);
      if (yieldForComp < minAvail) minAvail = yieldForComp;
    }
    return minAvail === Infinity ? 0 : minAvail;
  }, [formComponents, productsMap, ingredientsMap, productAvailabilityMap]);

  // Save Komposisi Menu POS
  const handleSaveComposition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductId) {
      alert('Silakan pilih Menu POS Target terlebih dahulu.');
      return;
    }
    if (formComponents.some(c => !c.sourceId)) {
      alert('Semua komponen komposisi menu harus dipilih itemnya.');
      return;
    }

    const cleanComponents: AssemblyItem[] = formComponents.map(c => {
      let cost = c.costPerUnit || 0;
      let name = c.sourceName;
      if (c.sourceType === 'PRODUCT') {
        const p = productsMap.get(c.sourceId);
        if (p) {
          name = p.name;
          cost = getProductRecipeHpp(p.id, productsMap, recipesMap, ingredientsMap);
        }
      } else {
        const ing = ingredientsMap.get(c.sourceId);
        if (ing) {
          name = ing.name;
          cost = ing.costPerUnit || cost;
        }
      }
      return {
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        sourceName: name,
        quantity: c.quantity || 1,
        unit: c.unit || 'pcs',
        costPerUnit: Math.round(cost),
        subtotalCost: Math.round((c.quantity || 1) * cost),
      };
    });

    setIsSubmitting(true);
    try {
      await saveProductComposition(
        formProductId,
        cleanComponents,
        formResultUnit || 'porsi',
        formNotes
      );
      setShowFormModal(false);
    } catch (err: any) {
      alert(`Gagal menyimpan komposisi menu: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Komposisi
  const handleDeleteComposition = async (prodId: string) => {
    try {
      await deleteProductComposition(prodId);
      setDeletingProductId(null);
    } catch (err: any) {
      alert(`Gagal menghapus komposisi menu: ${err.message || err}`);
    }
  };

  const getProductCompositionMetrics = (prod: Product) => {
    const isPackage = prod.productType === 'PACKAGE' || Boolean(prod.packageItems && prod.packageItems.length > 0);
    const composition = getProductComposition(prod, assembliesMap);
    const hasComposition = Boolean(composition && composition.length > 0);
    const liveAvail = productAvailabilityMap.get(prod.id) ?? 0;

    let hpp = prod.costPerUnit || 0;
    if (hasComposition && composition) {
      hpp = composition.reduce((sum, item) => {
        let cCost = item.costPerUnit || 0;
        if (item.sourceType === 'PRODUCT') {
          cCost = getProductRecipeHpp(item.sourceId, productsMap, recipesMap, ingredientsMap);
        } else {
          const ing = ingredientsMap.get(item.sourceId);
          if (ing) cCost = ing.costPerUnit || cCost;
        }
        return sum + (item.quantity || 1) * cCost;
      }, 0);
    } else if (isPackage && prod.packageItems) {
      hpp = prod.packageItems.reduce((sum, it) => {
        const subP = productsMap.get(it.productId);
        const subCost = subP ? (subP.costPerUnit || 0) : 0;
        return sum + (it.quantity || 1) * subCost;
      }, 0);
    }

    const selling = prod.sellingPrice || 0;
    const profit = selling - hpp;
    const margin = selling > 0 ? Math.round(((profit / selling) * 100) * 10) / 10 : 0;
    const compCount = hasComposition && composition
      ? composition.length
      : isPackage && prod.packageItems
      ? prod.packageItems.length
      : 0;

    let limitingComp = '';
    if (hasComposition && composition) {
      let minCompYield = Infinity;
      composition.forEach(c => {
        const req = c.quantity || 1;
        let cStock = 0;
        let cName = c.sourceName;
        if (c.sourceType === 'PRODUCT') {
          const p = resolveProductReference(c.sourceId, c.sourceName, productsMap);
          cStock = p ? (productAvailabilityMap.get(p.id) ?? 0) : 0;
          if (p) cName = p.name;
        } else {
          const ing = resolveIngredientReference(c.sourceId, c.sourceName, ingredientsMap);
          cStock = ing && typeof ing.stock === 'number' ? ing.stock : 0;
          if (ing) cName = ing.name;
        }
        const yieldForComp = Math.floor(cStock / req);
        if (yieldForComp < minCompYield) {
          minCompYield = yieldForComp;
          limitingComp = `${cName} (${cStock} ${c.unit})`;
        }
      });
    }

    return {
      isPackage,
      composition,
      hasComposition,
      liveAvail,
      hpp,
      selling,
      profit,
      margin,
      compCount,
      limitingComp,
    };
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
        title="Komposisi Menu POS"
        description="Tentukan produk hasil produksi & bahan kemasan yang berkurang otomatis ketika Menu POS terjual di kasir."
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="h-9 px-3.5 rounded-lg bg-white hover:bg-[#F7F8FA] text-[#344054] text-xs font-semibold flex items-center gap-1.5 border border-[#E5E7EB] transition cursor-pointer"
            >
              <HelpCircleIcon className="w-3.5 h-3.5 text-[#FF5A1F]" />
              <span>Cara Kerja</span>
            </button>

            <button
              type="button"
              onClick={handleOpenGeneralCreate}
              className="h-9 px-3.5 rounded-lg bg-[#FF5A1F] hover:bg-[#E04F16] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Atur Komposisi</span>
            </button>
          </>
        }
      />

      {/* Compact SummaryBar */}
      <SummaryBar
        items={[
          {
            label: 'Total Menu POS',
            value: `${totalMenuPos} Menu`,
          },
          {
            label: 'Berkomposisi',
            value: `${productsWithComposition} Menu`,
            valueClassName: 'text-[#FF5A1F]',
          },
          {
            label: 'Siap Jual (Ready)',
            value: `${readyToSellCount} Menu`,
            valueClassName: 'text-[#16A34A]',
          },
          {
            label: 'Rata-rata HPP',
            value: formatRupiah(avgHpp),
          },
        ]}
      />

      {/* Compact Filter & Search Bar */}
      <div className="bg-white rounded-xl p-2.5 border border-[#E8ECF2] shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="w-3.5 h-3.5 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari menu POS atau nama komponen stok..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#F7F8FA] border border-[#E8ECF2] text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL', label: 'Semua Menu POS' },
            { id: 'WITH_COMPOSITION', label: 'Ada Komposisi' },
            { id: 'WITHOUT_COMPOSITION', label: 'Belum Ada Komposisi' },
            { id: 'PACKAGE', label: 'Menu Paket' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-[#172033] text-white shadow-xs'
                  : 'bg-[#F7F8FA] text-[#667085] hover:bg-[#E8ECF2]'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#F7F8FA] border border-[#E8ECF2] text-[11px] font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Compact List of MENU POS */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-[#E8ECF2] shadow-xs space-y-2.5">
          <div className="w-12 h-12 rounded-xl bg-[#FFFAFA] text-[#FF641F] flex items-center justify-center mx-auto border border-[#FFE4D6]">
            <BoxesIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-[#172033]">Tidak Ada Menu POS Yang Sesuai Filter</h3>
          <p className="text-xs text-[#667085] max-w-md mx-auto">
            Coba ubah kata kunci pencarian atau ganti filter status untuk menemukan Menu POS yang diinginkan.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterTab('ALL');
              setFilterCategory('ALL');
            }}
            className="px-3.5 py-1.5 rounded-lg bg-[#172033] text-white text-xs font-bold hover:bg-[#2B384E] transition cursor-pointer"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP COMPACT TABLE-LIST */}
          <div className="hidden md:block bg-white rounded-xl border border-[#E8ECF2] shadow-xs overflow-visible">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8ECF2] bg-[#F8FAFC] text-[11px] font-extrabold text-[#667085] uppercase tracking-wider">
                  <th className="py-2.5 pl-4 pr-3">Menu</th>
                  <th className="py-2.5 px-3 text-right">Harga</th>
                  <th className="py-2.5 px-3 text-right">HPP</th>
                  <th className="py-2.5 px-3 text-right">Margin</th>
                  <th className="py-2.5 px-3">Komponen</th>
                  <th className="py-2.5 px-3">Tersedia</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8ECF2] text-xs">
                {filteredProducts.map(prod => {
                  const {
                    isPackage,
                    composition,
                    hasComposition,
                    liveAvail,
                    hpp,
                    selling,
                    margin,
                    compCount,
                    limitingComp,
                  } = getProductCompositionMetrics(prod);

                  const compPreview = hasComposition && composition
                    ? composition
                        .slice(0, 2)
                        .map(c => c.sourceName)
                        .join(', ') + (composition.length > 2 ? ` +${composition.length - 2}` : '')
                    : isPackage && prod.packageItems
                    ? prod.packageItems
                        .slice(0, 2)
                        .map(pk => pk.productName || 'Item')
                        .join(', ') + (prod.packageItems.length > 2 ? ` +${prod.packageItems.length - 2}` : '')
                    : 'Belum diatur';

                  return (
                    <tr
                      key={prod.id}
                      onClick={() => setDrawerProductId(prod.id)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                    >
                      {/* Menu Info + Badges */}
                      <td className="py-2.5 pl-4 pr-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {prod.image ? (
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="w-9 h-9 rounded-lg object-cover border border-[#E8ECF2] shrink-0 bg-[#F8FAFC]"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-[#FFF9F5] text-[#FF641F] border border-[#FFE4D6] flex items-center justify-center shrink-0">
                              {isPackage ? <PackageIcon className="w-4 h-4" /> : <ShoppingBagIcon className="w-4 h-4" />}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-[#172033] group-hover:text-[#FF641F] transition-colors truncate">
                                {prod.name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[#EFF8FF] text-[#1570EF] text-[9px] font-extrabold border border-[#D1E9FF] uppercase">
                                Menu POS
                              </span>
                              {isPackage && (
                                <span className="px-1.5 py-0.5 rounded bg-[#FAF5FF] text-[#7E22CE] text-[9px] font-extrabold border border-[#E9D5FF] uppercase">
                                  Menu Paket
                                </span>
                              )}
                              {hasComposition && (
                                <span className="px-1.5 py-0.5 rounded bg-[#FFF9F5] text-[#FF641F] text-[9px] font-extrabold border border-[#FFE4D6] uppercase">
                                  Komposisi Aktif
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#667085] truncate">
                              {prod.sku || 'Tanpa SKU'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Harga Jual */}
                      <td className="py-2.5 px-3 text-right font-bold text-[#172033] whitespace-nowrap">
                        {formatRupiah(selling)}
                      </td>

                      {/* HPP */}
                      <td className="py-2.5 px-3 text-right font-bold text-[#FF641F] whitespace-nowrap">
                        {formatNumber(Math.round(hpp))}
                      </td>

                      {/* Margin */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            margin >= 30
                              ? 'bg-[#ECFDF3] text-[#12B76A]'
                              : margin > 0
                              ? 'bg-[#FFFAEB] text-[#B54708]'
                              : 'bg-[#FEF3F2] text-[#D92D20]'
                          }`}
                        >
                          {margin.toFixed(1).replace('.', ',')}%
                        </span>
                      </td>

                      {/* Jumlah Komponen */}
                      <td className="py-2.5 px-3">
                        <div className="min-w-0">
                          <span className="font-extrabold text-[#172033]">
                            {compCount} komponen
                          </span>
                          <p className="text-[10px] text-[#667085] truncate max-w-[170px]" title={compPreview}>
                            {compPreview}
                          </p>
                        </div>
                      </td>

                      {/* Tersedia */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div>
                          <span className={`font-extrabold ${liveAvail > 0 ? 'text-[#12B76A]' : 'text-[#D92D20]'}`}>
                            {formatNumber(liveAvail)} {prod.stockUnit || 'porsi'}
                          </span>
                          {liveAvail <= 5 && limitingComp && (
                            <p className="text-[10px] text-[#D92D20] truncate max-w-[140px]" title={`Dibatasi: ${limitingComp}`}>
                              Limit: {limitingComp}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {prod.active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ECFDF3] text-[#12B76A] border border-[#ABEFC6] text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
                            Aktif Kasir
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F2F4F7] text-[#667085] text-[10px] font-bold">
                            Non-Aktif
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td
                        className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap relative"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenConfigure(prod)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F8FAFC] text-[#172033] border border-[#E8ECF2] text-[11px] font-bold transition cursor-pointer shadow-2xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionMenuId(prev => (prev === prod.id ? null : prod.id))
                            }
                            className="p-1.5 rounded-lg hover:bg-[#F2F4F7] text-[#667085] hover:text-[#172033] transition cursor-pointer"
                            title="Aksi Lainnya"
                          >
                            <MoreHorizontalIcon className="w-4 h-4" />
                          </button>
                        </div>

                        {openActionMenuId === prod.id && (
                          <div className="absolute right-4 top-10 z-30 w-44 rounded-xl bg-white border border-[#E8ECF2] shadow-lg py-1 text-left text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenuId(null);
                                setDrawerProductId(prod.id);
                              }}
                              className="w-full px-3 py-2 hover:bg-[#F8FAFC] flex items-center gap-2 font-semibold text-[#172033] cursor-pointer"
                            >
                              <EyeIcon className="w-3.5 h-3.5 text-[#667085]" />
                              <span>Detail Komposisi</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenuId(null);
                                handleOpenConfigure(prod);
                              }}
                              className="w-full px-3 py-2 hover:bg-[#F8FAFC] flex items-center gap-2 font-semibold text-[#172033] cursor-pointer"
                            >
                              <Edit2Icon className="w-3.5 h-3.5 text-[#FF641F]" />
                              <span>{hasComposition ? 'Edit Komposisi' : 'Atur Komposisi'}</span>
                            </button>
                            {hasComposition && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setDeletingProductId(prod.id);
                                }}
                                className="w-full px-3 py-2 hover:bg-[#FEF3F2] flex items-center gap-2 font-semibold text-[#D92D20] cursor-pointer"
                              >
                                <Trash2Icon className="w-3.5 h-3.5" />
                                <span>Hapus Komposisi</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE COMPACT VERTICAL LIST */}
          <div className="md:hidden divide-y divide-[#E8ECF2] bg-white rounded-xl border border-[#E8ECF2] shadow-xs overflow-hidden">
            {filteredProducts.map(prod => {
              const {
                isPackage,
                hasComposition,
                liveAvail,
                hpp,
                selling,
                margin,
                compCount,
              } = getProductCompositionMetrics(prod);

              return (
                <div
                  key={prod.id}
                  onClick={() => setDrawerProductId(prod.id)}
                  className="p-3.5 hover:bg-[#F8FAFC] active:bg-[#F1F5F9] transition cursor-pointer flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {prod.image ? (
                        <img
                          src={prod.image}
                          alt={prod.name}
                          className="w-10 h-10 rounded-lg object-cover border border-[#E8ECF2] shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#FFF9F5] text-[#FF641F] border border-[#FFE4D6] flex items-center justify-center shrink-0">
                          {isPackage ? <PackageIcon className="w-4 h-4" /> : <ShoppingBagIcon className="w-4 h-4" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-[#EFF8FF] text-[#1570EF] text-[9px] font-extrabold border border-[#D1E9FF] uppercase">
                            Menu POS
                          </span>
                          {isPackage && (
                            <span className="px-1.5 py-0.5 rounded bg-[#FAF5FF] text-[#7E22CE] text-[9px] font-extrabold border border-[#E9D5FF] uppercase">
                              Paket
                            </span>
                          )}
                          {hasComposition && (
                            <span className="px-1.5 py-0.5 rounded bg-[#FFF9F5] text-[#FF641F] text-[9px] font-extrabold border border-[#FFE4D6] uppercase">
                              Komposisi Aktif
                            </span>
                          )}
                        </div>
                        <h3 className="text-xs font-black text-[#172033] truncate mt-0.5">
                          {prod.name}
                        </h3>
                        <p className="text-[10px] text-[#667085]">{prod.sku || 'Tanpa SKU'}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-[#172033]">{formatRupiah(selling)}</p>
                      <p className="text-[10px] font-bold text-[#FF641F]">HPP {formatRupiah(hpp)}</p>
                      <p className="text-[10px] font-semibold text-[#12B76A]">
                        Margin {margin.toFixed(1).replace('.', ',')}%
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between pt-2 border-t border-[#F1F5F9] text-[11px]"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 text-[#475467]">
                      <span className="font-bold text-[#172033]">{compCount} komponen</span>
                      <span>•</span>
                      <span className={`font-bold ${liveAvail > 0 ? 'text-[#12B76A]' : 'text-[#D92D20]'}`}>
                        {formatNumber(liveAvail)} {prod.stockUnit || 'porsi'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenConfigure(prod)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#F8FAFC] text-[#172033] border border-[#E8ECF2] text-[11px] font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                      {hasComposition && (
                        <button
                          type="button"
                          onClick={() => setDeletingProductId(prod.id)}
                          className="p-1 rounded-lg text-[#D92D20] hover:bg-[#FEF3F2] cursor-pointer"
                          title="Hapus Komposisi"
                        >
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Slide-over Detail Komposisi Drawer */}
      {drawerProduct && (() => {
        const {
          isPackage,
          composition,
          hasComposition,
          liveAvail,
          hpp,
          selling,
          profit,
          margin,
          limitingComp,
        } = getProductCompositionMetrics(drawerProduct);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end"
            onClick={() => setDrawerProductId(null)}
          >
            <div
              className="bg-white w-full max-w-md h-full shadow-2xl border-l border-[#E8ECF2] flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="px-5 py-4 bg-[#172033] text-white flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {drawerProduct.image ? (
                    <img
                      src={drawerProduct.image}
                      alt={drawerProduct.name}
                      className="w-11 h-11 rounded-xl object-cover border border-white/15 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-[#FF641F]/20 text-[#FF641F] border border-[#FF641F]/30 flex items-center justify-center shrink-0">
                      <LayersIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-orange-300 text-[9px] font-extrabold uppercase tracking-wider">
                        Menu POS
                      </span>
                      {isPackage && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 text-[9px] font-extrabold uppercase">
                          Menu Paket
                        </span>
                      )}
                      {hasComposition && (
                        <span className="px-1.5 py-0.5 rounded bg-[#FF641F] text-white text-[9px] font-extrabold uppercase">
                          Komposisi Aktif
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black truncate mt-0.5">{drawerProduct.name}</h3>
                    <p className="text-[11px] text-slate-300">{drawerProduct.sku || 'Tanpa SKU'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerProductId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-5">
                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E8ECF2] text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-[#667085] uppercase block">Harga Jual</span>
                    <span className="text-sm font-black text-[#172033]">{formatRupiah(selling)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#667085] uppercase block">HPP</span>
                    <span className="text-sm font-black text-[#FF641F]">{formatRupiah(hpp)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#667085] uppercase block">Ketersediaan</span>
                    <span className={`text-sm font-black ${liveAvail > 0 ? 'text-[#12B76A]' : 'text-[#D92D20]'}`}>
                      {formatNumber(liveAvail)} {drawerProduct.stockUnit || 'porsi'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-[#667085] font-medium">Estimasi Margin / Laba Kotor:</span>
                  <span className={`font-extrabold ${profit >= 0 ? 'text-[#12B76A]' : 'text-[#D92D20]'}`}>
                    {formatRupiah(profit)} ({margin.toFixed(1).replace('.', ',')}%)
                  </span>
                </div>

                {liveAvail <= 5 && limitingComp && (
                  <div className="px-3 py-2 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-[11px] text-[#D92D20] font-semibold">
                    Ketersediaan dibatasi oleh stok: <strong>{limitingComp}</strong>
                  </div>
                )}

                {/* Komposisi Pengurangan Stok */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#E8ECF2] pb-2">
                    <h4 className="text-xs font-extrabold text-[#172033] uppercase tracking-wider">
                      Komposisi Pengurangan Stok
                    </h4>
                    <span className="text-[10px] font-semibold text-[#667085]">
                      Terpotong otomatis saat terjual
                    </span>
                  </div>

                  {hasComposition && composition ? (
                    <div className="divide-y divide-[#E8ECF2] rounded-xl border border-[#E8ECF2] bg-white overflow-hidden">
                      {composition.map((comp, idx) => {
                        let currentCompStock = 0;
                        let compCost = comp.costPerUnit || 0;
                        let resolvedName = comp.sourceName;

                        if (comp.sourceType === 'PRODUCT') {
                          const p = resolveProductReference(comp.sourceId, comp.sourceName, productsMap);
                          currentCompStock = p ? (productAvailabilityMap.get(p.id) ?? 0) : 0;
                          if (p) {
                            resolvedName = p.name;
                            compCost = getProductRecipeHpp(p.id, productsMap, recipesMap, ingredientsMap);
                          }
                        } else {
                          const ing = resolveIngredientReference(comp.sourceId, comp.sourceName, ingredientsMap);
                          currentCompStock = ing && typeof ing.stock === 'number' ? ing.stock : 0;
                          if (ing) {
                            resolvedName = ing.name;
                            compCost = ing.costPerUnit || compCost;
                          }
                        }

                        const isLow = currentCompStock < comp.quantity;

                        return (
                          <div
                            key={idx}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-[#F8FAFC]"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    comp.sourceType === 'PRODUCT'
                                      ? 'bg-[#EFF8FF] text-[#1570EF]'
                                      : 'bg-[#F0FDF4] text-[#166534]'
                                  }`}
                                >
                                  {comp.sourceType === 'PRODUCT' ? 'Produk Stok' : 'Bahan/Kemasan'}
                                </span>
                                <span className="font-bold text-[#172033] truncate">{resolvedName}</span>
                              </div>
                              <p className="text-[10px] text-[#667085] mt-0.5">
                                HPP: {formatRupiah(compCost * (comp.quantity || 1))} • Stok sisa:{' '}
                                <strong className={isLow ? 'text-[#D92D20]' : 'text-[#344054]'}>
                                  {formatNumber(currentCompStock)} {comp.unit}
                                </strong>
                              </p>
                            </div>
                            <div className="text-right shrink-0 font-black text-[#172033]">
                              {comp.quantity} {comp.unit}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : isPackage && drawerProduct.packageItems ? (
                    <div className="divide-y divide-[#E8ECF2] rounded-xl border border-[#E8ECF2] bg-white overflow-hidden">
                      {drawerProduct.packageItems.map((pkg, idx) => {
                        const subP = resolveProductReference(pkg.productId, pkg.productName, productsMap);
                        const subAvail = subP ? (productAvailabilityMap.get(subP.id) ?? 0) : 0;
                        return (
                          <div
                            key={idx}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-[#172033] block truncate">
                                {subP?.name || pkg.productName || pkg.productId}
                              </span>
                              <span className="text-[10px] text-[#667085]">
                                Tersedia: {formatNumber(subAvail)} {subP?.stockUnit || 'porsi'}
                              </span>
                            </div>
                            <span className="font-black text-[#581C87] shrink-0">
                              {pkg.quantity} {subP?.stockUnit || 'porsi'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center space-y-2">
                      <p className="text-xs text-[#667085]">
                        Menu POS ini belum memiliki daftar komponen pemotongan stok.
                      </p>
                    </div>
                  )}
                </div>

                {drawerProduct.notes && (
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E8ECF2] text-xs space-y-1">
                    <span className="text-[10px] font-bold text-[#667085] uppercase block">Catatan Komposisi</span>
                    <p className="text-[#344054]">{drawerProduct.notes}</p>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 bg-[#F8FAFC] border-t border-[#E8ECF2] flex items-center justify-between gap-2">
                {hasComposition && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = drawerProduct.id;
                      setDrawerProductId(null);
                      setDeletingProductId(targetId);
                    }}
                    className="px-3 py-2 rounded-xl text-[#D92D20] hover:bg-[#FEF3F2] border border-[#FECDCA] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2Icon className="w-4 h-4" />
                    <span>Hapus</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const target = drawerProduct;
                    setDrawerProductId(null);
                    handleOpenConfigure(target);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Edit2Icon className="w-3.5 h-3.5" />
                  <span>EDIT KOMPOSISI</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Form: Atur / Edit Komposisi Menu POS */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-[#E8ECF2] overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#172033] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FF641F]/20 text-[#FF641F] flex items-center justify-center border border-[#FF641F]/30">
                  <LayersIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    Atur Komposisi Menu POS
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Tentukan stok produk hasil produksi dan kemasan yang berkurang saat menu POS ini terjual
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveComposition} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Target Menu Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#172033] flex items-center justify-between">
                  <span>1. Pilih Menu POS Target</span>
                  <span className="text-[10px] text-[#FF641F] font-semibold">* Wajib Diisi</span>
                </label>
                <select
                  value={formProductId}
                  onChange={e => handleSelectTargetProduct(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E8ECF2] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] transition cursor-pointer"
                  required
                >
                  <option value="">-- Pilih Menu Siap Jual dari Daftar Menu POS --</option>
                  {menuPosProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatRupiah(p.sellingPrice)}) - {p.stockUnit || 'porsi'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Satuan Penjualan Menu */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#172033]">Satuan Penjualan Menu POS</label>
                <input
                  type="text"
                  value={formResultUnit}
                  onChange={e => setFormResultUnit(e.target.value)}
                  placeholder="porsi / cup / pcs / botol / box"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E8ECF2] text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F] transition"
                  required
                />
                <div className="flex items-center gap-1.5 pt-1">
                  {['porsi', 'pcs', 'cup', 'gelas', 'botol', 'box'].map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setFormResultUnit(u)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        formResultUnit.toLowerCase() === u
                          ? 'bg-[#FF641F] text-white'
                          : 'bg-[#F2F4F7] text-[#667085] hover:bg-[#E8ECF2]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Component Items Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-[#E8ECF2] pb-2">
                  <div>
                    <p className="text-xs font-extrabold text-[#172033]">2. Komponen Pengurangan Stok</p>
                    <p className="text-[10px] text-[#667085]">
                      Pilih produk hasil produksi (Ayam Crispy, Sambal, Nasi) atau bahan kemasan yang akan berkurang saat menu ini terjual
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddComponentRow}
                    className="px-2.5 py-1 rounded-lg bg-[#EFF8FF] text-[#1570EF] hover:bg-[#D1E9FF] text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>+ Tambah Komponen</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formComponents.map((comp, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5 relative group"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        {/* Source Type Selector */}
                        <div className="sm:col-span-4">
                          <label className="text-[10px] font-bold text-[#667085] block mb-0.5">Tipe Sumber</label>
                          <select
                            value={comp.sourceType}
                            onChange={e =>
                              handleUpdateComponent(idx, {
                                sourceType: e.target.value as 'PRODUCT' | 'INGREDIENT',
                                sourceId: '',
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#CBD5E1] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                          >
                            <option value="PRODUCT">Produk Hasil Produksi / Stok</option>
                            <option value="INGREDIENT">Bahan Baku & Kemasan</option>
                          </select>
                        </div>

                        {/* Source Item Picker */}
                        <div className="sm:col-span-5">
                          <label className="text-[10px] font-bold text-[#667085] block mb-0.5">Pilih Item</label>
                          <select
                            value={comp.sourceId}
                            onChange={e => handleUpdateComponent(idx, { sourceId: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#CBD5E1] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                            required
                          >
                            <option value="">-- Pilih Item --</option>
                            {comp.sourceType === 'PRODUCT'
                              ? selectableComponentProducts.map(p => {
                                  const hpp = getProductRecipeHpp(p.id, productsMap, recipesMap, ingredientsMap);
                                  const avail = productAvailabilityMap.get(p.id) ?? 0;
                                  const tag = isProductionOutputProduct(p, recipes) ? 'PRODUK PRODUKSI' : 'MENU POS';
                                  return (
                                    <option key={p.id} value={p.id}>
                                      [{tag}] {p.name} (Stok: {avail} {p.stockUnit || 'pcs'} | HPP: {formatRupiah(hpp)})
                                    </option>
                                  );
                                })
                              : Array.from(ingredientsMap.values()).map(ing => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.name} (Stok: {ing.stock || 0} {ing.unit} | HPP: {formatRupiah(ing.costPerUnit)})
                                  </option>
                                ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="sm:col-span-3 flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-[#667085] block mb-0.5">
                              Jumlah ({comp.unit || 'pcs'})
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={comp.quantity}
                              onChange={e =>
                                handleUpdateComponent(idx, {
                                  quantity: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#CBD5E1] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                              required
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveComponentRow(idx)}
                            className="p-1.5 mt-4 rounded-lg text-[#94A3B8] hover:text-[#D92D20] hover:bg-[#FEF3F2] transition cursor-pointer"
                            title="Hapus baris komponen"
                          >
                            <Trash2Icon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Item subtotal hint */}
                      {comp.sourceId && (
                        <div className="flex items-center justify-between text-[11px] text-[#667085] px-1">
                          <span>
                            Biaya Satuan: <strong className="text-[#172033]">{formatRupiah(comp.costPerUnit || 0)}</strong> / {comp.unit}
                          </span>
                          <span>
                            Subtotal HPP: <strong className="text-[#FF641F]">{formatRupiah(comp.subtotalCost || 0)}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 rounded-2xl bg-[#FFF9F5] border border-[#FFE4D6] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#172033]">Estimasi Total HPP Komposisi:</span>
                  <span className="text-base font-black text-[#FF641F]">{formatRupiah(formCalculatedHpp)}</span>
                </div>
                {selectedProductForModal && (
                  <div className="flex items-center justify-between text-xs text-[#667085]">
                    <span>Harga Jual Menu POS:</span>
                    <span className="font-bold text-[#172033]">{formatRupiah(selectedProductForModal.sellingPrice)}</span>
                  </div>
                )}
                {selectedProductForModal && selectedProductForModal.sellingPrice > 0 && (
                  <div className="flex items-center justify-between text-xs text-[#667085]">
                    <span>Estimasi Laba Bersih:</span>
                    <span className="font-bold text-[#12B76A]">
                      {formatRupiah(selectedProductForModal.sellingPrice - formCalculatedHpp)} (
                      {Math.round(((selectedProductForModal.sellingPrice - formCalculatedHpp) / selectedProductForModal.sellingPrice) * 100)}%)
                    </span>
                  </div>
                )}
                <div className="pt-1 border-t border-[#FFE4D6] flex items-center justify-between text-xs">
                  <span className="text-[#667085] font-semibold">Estimasi Porsi Siap Jual Sekarang:</span>
                  <span className={`font-black ${formEstimatedAvailability > 0 ? 'text-[#12B76A]' : 'text-[#D92D20]'}`}>
                    {formEstimatedAvailability} {formResultUnit}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#172033]">Catatan Khusus (Opsional)</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Contoh: Sambal menggunakan porsi sendok takar 30 gram..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F8FA] border border-[#E8ECF2] text-xs text-[#172033] focus:outline-none focus:border-[#FF641F] transition resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8ECF2]">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#F2F4F7] text-[#344054] text-xs font-bold hover:bg-[#E4E7EC] transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <CheckIcon className="w-4 h-4" />
                      <span>Simpan Komposisi Menu POS</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-[#E8ECF2]">
            <div className="w-12 h-12 rounded-2xl bg-[#FEF3F2] text-[#D92D20] flex items-center justify-center mx-auto border border-[#FECDCA]">
              <AlertTriangleIcon className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-[#172033]">Hapus Komposisi Menu?</h3>
              <p className="text-xs text-[#667085]">
                Menu POS akan kembali ke mode standar tanpa aturan pemotongan komponen stok. Menu POS tidak akan dihapus.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProductId(null)}
                className="flex-1 py-2 rounded-xl bg-[#F2F4F7] text-[#344054] text-xs font-bold hover:bg-[#E4E7EC] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteComposition(deletingProductId)}
                className="flex-1 py-2 rounded-xl bg-[#D92D20] text-white text-xs font-bold hover:bg-[#B42318] transition cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* How it Works Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#E8ECF2]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FF641F]/10 text-[#FF641F] flex items-center justify-center">
                  <HelpCircleIcon className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-[#172033]">Prinsip Komposisi Menu POS</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#475467] leading-relaxed">
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="font-extrabold text-[#172033] mb-1">1. Produksi Dapur (Produk Stok)</p>
                <p>
                  Membuat stok produk setengah jadi atau pelengkap. Contoh: Memasak <strong>Ayam Crispy</strong> 100 pcs dan <strong>Sambal</strong> 50 cup.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="font-extrabold text-[#172033] mb-1">2. Menu POS (Menu Siap Jual)</p>
                <p>
                  Menu yang tampil di kasir (contoh: <strong>Ayam Geprek</strong>). Menu POS <em>tidak memiliki stok fisik tersendiri</em>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FFF9F5] border border-[#FFE4D6]">
                <p className="font-extrabold text-[#FF641F] mb-1">3. Komposisi Menu & Penjualan POS</p>
                <p>
                  Menentukan komponen apa yang berkurang saat Menu POS terjual di kasir. Misalnya jual 1 Ayam Geprek:
                </p>
                <ul className="list-disc pl-5 mt-1 font-semibold text-[#172033] space-y-0.5">
                  <li>Ayam Crispy berkurang: 100 &rarr; 99</li>
                  <li>Sambal berkurang: 50 &rarr; 49</li>
                  <li>Paper Bowl & Kantong Plastik terpotong otomatis</li>
                  <li>Tanpa menambah atau mengubah stok Ayam Geprek</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#ABEFC6]">
                <p className="font-extrabold text-[#12B76A] mb-1">4. Ketersediaan (Availability)</p>
                <p>
                  Ketersediaan Menu POS dihitung dinamis dari sisa stok komponen terendah. Jika Sambal habis (0), maka Ayam Geprek otomatis tidak tersedia di kasir.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#172033] text-white text-xs font-bold hover:bg-[#2B384E] transition cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
