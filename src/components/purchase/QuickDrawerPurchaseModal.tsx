import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  formatRupiah,
  formatNumber,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import {
  ShoppingBag,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  PackagePlus,
  ChevronDown,
} from 'lucide-react';

interface QuickDrawerPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  stockUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
  cost: number;
  stock: number;
  entityType: 'INGREDIENT' | 'PRODUCT';
  itemType: 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
}

export const QuickDrawerPurchaseModal: React.FC<QuickDrawerPurchaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { ingredients, products, cashMutations, createPurchase } = useApp();
  const { currentEmployee } = useAuth();

  const [itemName, setItemName] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customUnit, setCustomUnit] = useState<string>('pcs');
  const [useStockUnitMode, setUseStockUnitMode] = useState<boolean>(false);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [vendorName, setVendorName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);

  // Master Catalog of Ingredients + Ready-to-Sell Products (exact same structure as PurchaseForm)
  const availableItems = useMemo<CatalogItem[]>(() => {
    const list: CatalogItem[] = [];
    const seenIds = new Set<string>();

    ingredients.forEach((ing) => {
      if (!ing.id || seenIds.has(ing.id)) return;
      seenIds.add(ing.id);

      const isPkg =
        ing.type === 'PACKAGING' ||
        ing.categoryId === 'cat_ing_packaging' ||
        ing.name.toLowerCase().includes('cup') ||
        ing.name.toLowerCase().includes('seal') ||
        ing.name.toLowerCase().includes('plastik') ||
        ing.name.toLowerCase().includes('box');

      const sUnit = ing.stockUnit || ing.unit || 'pcs';
      const pUnit = ing.purchaseUnit || sUnit;
      const cFactor = ing.conversionFactor || 1;
      const pPrice =
        ing.purchasePrice || (ing.costPerUnit ? Math.round(ing.costPerUnit * cFactor) : 0);

      list.push({
        id: ing.id,
        name: ing.name,
        unit: pUnit,
        stockUnit: sUnit,
        purchaseUnit: pUnit,
        conversionFactor: cFactor,
        cost: pPrice,
        stock: ing.stock || 0,
        entityType: 'INGREDIENT',
        itemType: isPkg ? 'KEMASAN' : 'BAHAN_BAKU',
      });
    });

    products.forEach((prod) => {
      if (!prod.id || seenIds.has(prod.id)) return;
      const isReadyToSell =
        prod.stockSource === 'READY_TO_SELL' ||
        (prod.productType !== 'PACKAGE' && !prod.isProduction && !prod.recipeId);

      if (
        isReadyToSell &&
        !list.some((i) => i.name.trim().toLowerCase() === prod.name.trim().toLowerCase())
      ) {
        seenIds.add(prod.id);
        const sUnit = prod.stockUnit || 'pcs';
        const pUnit = prod.purchaseUnit || sUnit;
        const cFactor = prod.conversionFactor || 1;
        const pPrice =
          prod.purchasePrice || (prod.costPerUnit ? Math.round(prod.costPerUnit * cFactor) : 0);

        list.push({
          id: prod.id,
          name: prod.name,
          unit: pUnit,
          stockUnit: sUnit,
          purchaseUnit: pUnit,
          conversionFactor: cFactor,
          cost: pPrice,
          stock: prod.stock || 0,
          entityType: 'PRODUCT',
          itemType: 'BARANG_SIAP_JUAL',
        });
      }
    });

    return list.sort((a, b) =>
      a.name.trim().localeCompare(b.name.trim(), 'id', { sensitivity: 'base' })
    );
  }, [ingredients, products]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setItemName('');
      setSelectedEntityId('');
      setQuantity(1);
      setCustomUnit('pcs');
      setUseStockUnitMode(false);
      setTotalAmount(0);
      setVendorName('');
      setNotes('');
      setErrorMsg(null);
      setShowItemSuggestions(false);
    }
  }, [isOpen]);

  // Automatically resolve matched catalog item by ID or exact name
  const matchedItem = useMemo<CatalogItem | null>(() => {
    if (selectedEntityId) {
      const byId = availableItems.find((i) => i.id === selectedEntityId);
      if (byId) return byId;
    }
    if (itemName.trim()) {
      const byName = availableItems.find(
        (i) => i.name.trim().toLowerCase() === itemName.trim().toLowerCase()
      );
      if (byName) return byName;
    }
    return null;
  }, [availableItems, selectedEntityId, itemName]);

  // Filtered Item Suggestions
  const filteredSuggestions = useMemo(() => {
    if (!itemName.trim()) return availableItems;
    const q = itemName.toLowerCase();
    return availableItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [availableItems, itemName]);

  // Current Cash Drawer Balance
  const currentCashInDrawer = useMemo(() => {
    return cashMutations
      .filter((m) => m.account === 'KAS_KASIR')
      .reduce((sum, m) => sum + (m.flow === 'IN' ? m.amount : -m.amount), 0);
  }, [cashMutations]);

  if (!isOpen) return null;

  // Derived Unit & Conversion Calculation synced with matchedItem
  const hasDualUnits =
    matchedItem &&
    matchedItem.purchaseUnit.toLowerCase() !== matchedItem.stockUnit.toLowerCase() &&
    matchedItem.conversionFactor > 1;

  const activeUnit = matchedItem
    ? useStockUnitMode
      ? matchedItem.stockUnit
      : matchedItem.purchaseUnit
    : customUnit;

  const activeConversionFactor = matchedItem
    ? useStockUnitMode
      ? 1
      : matchedItem.conversionFactor || 1
    : 1;

  const stockToBeAdded = Math.round((quantity || 0) * activeConversionFactor * 100) / 100;
  const targetStockUnit = matchedItem ? matchedItem.stockUnit : customUnit.trim() || 'pcs';

  const handleSelectItem = (item: CatalogItem) => {
    setItemName(item.name);
    setSelectedEntityId(item.id);
    setCustomUnit(item.purchaseUnit);
    setUseStockUnitMode(false);
    if (item.cost > 0) {
      setTotalAmount(item.cost * (quantity || 1));
    }
    setShowItemSuggestions(false);
    setErrorMsg(null);
  };

  const handleQuantityChange = (newQty: number) => {
    setQuantity(newQty);
    if (matchedItem && matchedItem.cost > 0 && !useStockUnitMode) {
      setTotalAmount(Math.round(matchedItem.cost * newQty));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!itemName.trim()) {
      setErrorMsg('Pilih atau ketik nama bahan/barang terlebih dahulu.');
      return;
    }

    if (quantity <= 0) {
      setErrorMsg('Jumlah barang (Qty) harus lebih dari 0.');
      return;
    }

    if (totalAmount <= 0) {
      setErrorMsg('Total uang keluar harus lebih dari Rp 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowStr = new Date().toISOString().split('T')[0];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const purchaseNo = `PB-TUNAI-${nowStr.replace(/-/g, '')}-${randomSuffix}`;

      const finalUnit = activeUnit.trim() || 'pcs';
      const finalStockUnit = targetStockUnit;
      const costPerUnit = Math.round(totalAmount / (quantity || 1));
      const costPerStockUnit =
        stockToBeAdded > 0 ? Math.round((totalAmount / stockToBeAdded) * 100) / 100 : costPerUnit;

      const targetId = matchedItem ? matchedItem.id : `new_ing_${Date.now()}`;
      const entityType = matchedItem ? matchedItem.entityType : 'INGREDIENT';
      const itemType = matchedItem ? matchedItem.itemType : 'BAHAN_BAKU';

      await createPurchase({
        purchaseNo,
        date: nowStr,
        vendorName: vendorName.trim() || 'Belanja Tunai Kasir / Pasar',
        items: [
          {
            entityType,
            targetId,
            targetName: matchedItem ? matchedItem.name : itemName.trim(),
            itemType,
            quantity,
            unit: finalUnit,
            purchaseUnit: finalUnit,
            stockUnit: finalStockUnit,
            conversionFactor: activeConversionFactor,
            costPerUnit,
            costPerStockUnit,
            subtotal: totalAmount,
            total: totalAmount,
            stockQuantityAdded: stockToBeAdded,
          },
        ],
        subtotal: totalAmount,
        totalAmount,
        paidAmount: totalAmount,
        paymentSource: 'KAS_KASIR',
        notes: notes.trim()
          ? `${notes.trim()} (Belanja Tunai Laci oleh ${currentEmployee?.name || 'Kasir'})`
          : `Belanja Tunai Laci Kasir oleh ${currentEmployee?.name || 'Kasir'}`,
      });

      onClose();
    } catch (err: unknown) {
      console.error('Error recording quick cash purchase:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mencatat belanja tunai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#E8ECF2] space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E8ECF2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF4ED] border border-[#FF641F]/20 text-[#FF641F] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#172033] leading-tight">
                Belanja Bahan Tunai Laci
              </h3>
              <p className="text-[11px] text-[#667085] mt-0.5">
                Otomatis menambah stok barang &amp; potong Kas Kasir.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full text-[#667085] hover:text-[#172033] hover:bg-[#F7F8FA] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Balance Banner */}
        <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E8ECF2] flex items-center justify-between text-xs">
          <span className="font-semibold text-[#667085]">Kas di Laci Saat Ini:</span>
          <span className="font-black text-[#172033]">
            {formatRupiah(currentCashInDrawer)}
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* 1. Pilih Nama Bahan / Barang */}
          <div className="space-y-1 relative">
            <label className="font-bold text-[#172033] flex items-center justify-between">
              <span>
                Nama Bahan / Barang <span className="text-red-500">*</span>
              </span>
              {matchedItem && (
                <span className="text-[10px] font-bold text-[#027A48] bg-[#ECFDF3] px-2 py-0.5 rounded-md border border-[#A6F4C5]">
                  Stok saat ini: {formatNumber(matchedItem.stock)} {matchedItem.stockUnit}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Pilih atau ketik nama bahan baku / barang..."
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  setSelectedEntityId('');
                  setShowItemSuggestions(true);
                  setErrorMsg(null);
                }}
                onFocus={() => setShowItemSuggestions(true)}
                onBlur={() => setTimeout(() => setShowItemSuggestions(false), 180)}
                className="w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F]"
              />
              <button
                type="button"
                onClick={() => setShowItemSuggestions((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#667085] hover:text-[#172033] cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Suggestions Dropdown */}
            {showItemSuggestions && filteredSuggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-[#E8ECF2] shadow-xl py-1 z-30 max-h-52 overflow-y-auto divide-y divide-[#F2F4F7]"
                onMouseDown={(e) => e.preventDefault()}
              >
                {filteredSuggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="w-full px-3.5 py-2.5 text-left text-xs flex items-center justify-between hover:bg-[#FFF4ED] transition cursor-pointer"
                  >
                    <div>
                      <span className="font-extrabold text-[#172033] block">{item.name}</span>
                      <span className="text-[10px] text-[#667085]">
                        Stok: {formatNumber(item.stock)} {item.stockUnit}
                        {item.conversionFactor > 1
                          ? ` (1 ${item.purchaseUnit} = ${item.conversionFactor} ${item.stockUnit})`
                          : ''}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-[#F2F4F7] text-[#344054] font-bold text-[10px]">
                        {item.purchaseUnit}
                      </span>
                      {item.cost > 0 && (
                        <span className="block text-[10px] font-semibold text-[#FF641F] mt-0.5">
                          {formatRupiah(item.cost)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Jumlah (Qty) & Satuan (Otomatis Mengikuti Barang) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="font-bold text-[#172033] block">Jumlah Beli (Qty)</label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={quantity || ''}
                onChange={(e) => {
                  const q = parseFloat(e.target.value) || 0;
                  handleQuantityChange(q);
                }}
                placeholder="1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-xs font-extrabold text-[#172033] focus:outline-none focus:border-[#FF641F]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#172033] flex items-center justify-between">
                <span>Satuan Barang</span>
                {matchedItem && (
                  <span className="text-[10px] font-semibold text-[#FF641F]">Otomatis</span>
                )}
              </label>

              {matchedItem ? (
                hasDualUnits ? (
                  <select
                    value={useStockUnitMode ? 'STOCK' : 'PURCHASE'}
                    onChange={(e) => setUseStockUnitMode(e.target.value === 'STOCK')}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#FFD9C2] bg-[#FFF4ED] text-xs font-extrabold text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer"
                  >
                    <option value="PURCHASE">
                      {matchedItem.purchaseUnit} (1 {matchedItem.purchaseUnit} ={' '}
                      {matchedItem.conversionFactor} {matchedItem.stockUnit})
                    </option>
                    <option value="STOCK">{matchedItem.stockUnit} (Satuan Stok)</option>
                  </select>
                ) : (
                  <div className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F8FAFC] text-xs font-extrabold text-[#172033] flex items-center justify-between">
                    <span>{matchedItem.purchaseUnit}</span>
                    <span className="text-[10px] font-semibold text-[#667085]">
                      Sesuai Barang
                    </span>
                  </div>
                )
              ) : (
                <input
                  type="text"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="pcs / kg / liter / ikat"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              )}
            </div>
          </div>

          {/* Info Penambahan Stok Otomatis */}
          {itemName.trim() && quantity > 0 && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5] flex items-center justify-between text-[11px] text-[#027A48]">
              <div className="flex items-center gap-2 font-bold">
                <PackagePlus className="w-4 h-4 shrink-0 text-[#12B76A]" />
                <span>
                  {matchedItem
                    ? `Stok ${matchedItem.name} bertambah:`
                    : `Bahan baru "${itemName.trim()}" masuk stok:`}
                </span>
              </div>
              <span className="font-black">
                +{formatNumber(stockToBeAdded)} {targetStockUnit}
                {matchedItem
                  ? ` (Total: ${formatNumber((matchedItem.stock || 0) + stockToBeAdded)} ${targetStockUnit})`
                  : ''}
              </span>
            </div>
          )}

          {/* 3. Total Uang Keluar / Harga Belanja */}
          <div className="space-y-1">
            <label className="font-bold text-[#172033] block">
              Total Uang Keluar (Rp) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-[#667085]">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                required
                value={totalAmount ? formatNumberInput(totalAmount) : ''}
                onChange={(e) => {
                  const val = parseNumberInput(e.target.value);
                  setTotalAmount(val);
                  setErrorMsg(null);
                }}
                placeholder="0"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-white text-sm font-black text-[#172033] focus:outline-none focus:border-[#FF641F]"
              />
            </div>

            {/* Quick nominal buttons */}
            <div className="grid grid-cols-5 gap-1 pt-1">
              {[10000, 20000, 50000, 100000, 150000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setTotalAmount(preset);
                    setErrorMsg(null);
                  }}
                  className={`py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                    totalAmount === preset
                      ? 'bg-[#FF641F] text-white border-[#FF641F]'
                      : 'bg-[#F8FAFC] text-[#667085] border-[#E8ECF2] hover:border-[#FF641F]'
                  }`}
                >
                  {preset / 1000}rb
                </button>
              ))}
            </div>
          </div>

          {/* 4. Toko / Tempat Belanja & Catatan (Opsional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="font-semibold text-[#667085] block">Toko / Pasar</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Pasar Pagi / Warung"
                className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-white text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#667085] block">Catatan</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ket. tambahan..."
                className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-white text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl border border-[#E8ECF2] text-xs font-bold text-[#667085] hover:bg-[#F7F8FA]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || totalAmount <= 0 || !itemName.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#FF641F] hover:bg-[#E04F16] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Simpan &amp; Tambah Stok</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
