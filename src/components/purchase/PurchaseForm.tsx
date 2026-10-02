import React, { useState, useMemo, useEffect } from 'react';
import { Purchase, PurchaseItem, Vendor } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getCachedVendors } from '../../services/offlineDatabase';
import {
  formatRupiah,
  formatNumber,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  ShoppingBag,
  Calendar,
  FileText,
  Search,
  ChevronDown,
  X,
  AlertCircle,
  Save,
  CheckCircle2,
  DollarSign,
  HelpCircle,
  Clock,
} from 'lucide-react';

interface PurchaseFormProps {
  initialPurchase?: Purchase | null;
  onCancel: () => void;
  onSaved: (purchaseId: string) => void;
  isDesktopWide?: boolean;
}

interface FormRowItem {
  keyId: string;
  targetId: string;
  targetName: string;
  description: string;
  entityType: 'INGREDIENT' | 'PRODUCT';
  itemType: 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
  quantity: number;
  unit: string;
  purchaseUnit: string;
  stockUnit: string;
  conversionFactor: number;
  costPerUnit: number;
  discount: number;
  tax: number;
  total: number;
  stock: number;
}

export const PurchaseForm: React.FC<PurchaseFormProps> = ({
  initialPurchase,
  onCancel,
  onSaved,
  isDesktopWide = false,
}) => {
  const {
    vendors,
    ingredients,
    products,
    createPurchase,
    updatePurchase,
    addVendor,
    isOnline,
  } = useApp();
  const { currentRole } = useAuth();

  const [idbVendors, setIdbVendors] = useState<Vendor[]>([]);
  useEffect(() => {
    if (!vendors || vendors.length === 0) {
      getCachedVendors().then(cached => {
        if (cached && cached.length > 0) {
          setIdbVendors(cached);
        }
      }).catch(() => {});
    }
  }, [vendors]);

  const effectiveVendors = useMemo(() => {
    if (vendors && vendors.length > 0) return vendors;
    return idbVendors;
  }, [vendors, idbVendors]);

  const isEditMode = Boolean(initialPurchase && initialPurchase.id);

  // Form Header State
  const [vendorId, setVendorId] = useState<string>(initialPurchase?.vendorId || '');
  const [vendorName, setVendorName] = useState<string>(
    initialPurchase?.vendorName || initialPurchase?.supplier || ''
  );
  const [date, setDate] = useState<string>(
    initialPurchase?.date || new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState<string>(initialPurchase?.dueDate || '');
  const [invoiceNo, setInvoiceNo] = useState<string>(initialPurchase?.invoiceNo || '');
  const [purchaseNo, setPurchaseNo] = useState<string>(initialPurchase?.purchaseNo || '');
  const [reference, setReference] = useState<string>(initialPurchase?.reference || '');
  const [notes, setNotes] = useState<string>(initialPurchase?.notes || '');

  // Financial Extra Fees State
  const [discountInvoice, setDiscountInvoice] = useState<number>(
    initialPurchase?.discount || 0
  );
  const [taxInvoice, setTaxInvoice] = useState<number>(initialPurchase?.tax || 0);
  const [shippingCost, setShippingCost] = useState<number>(
    initialPurchase?.shippingCost || 0
  );
  const [transactionCost, setTransactionCost] = useState<number>(
    initialPurchase?.transactionCost || 0
  );

  // Initial Payment (Only available when creating new purchase)
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<number>(
    initialPurchase?.paidAmount || 0
  );
  const [initialPaymentSource, setInitialPaymentSource] = useState<string>(
    initialPurchase?.paymentSource || 'KAS_KASIR'
  );

  // Quick New Vendor Inline Modal
  const [showNewVendorModal, setShowNewVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorContact, setNewVendorContact] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');

  // Searchable Items Available in System
  const availableItems = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      unit: string;
      stockUnit: string;
      purchaseUnit: string;
      conversionFactor: number;
      cost: number;
      entityType: 'INGREDIENT' | 'PRODUCT';
      itemType: 'BAHAN_BAKU' | 'KEMASAN' | 'BARANG_SIAP_JUAL';
      stock: number;
    }> = [];
    const seenIds = new Set<string>();

    ingredients.forEach(ing => {
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
        entityType: 'INGREDIENT',
        itemType: isPkg ? 'KEMASAN' : 'BAHAN_BAKU',
        stock: ing.stock || 0,
      });
    });

    products.forEach(p => {
      if (!p.id || seenIds.has(p.id)) return;
      const isReadyToSell =
        p.stockSource === 'READY_TO_SELL' ||
        (p.productType !== 'PACKAGE' && !p.isProduction && !p.recipeId);

      if (isReadyToSell) {
        seenIds.add(p.id);
        const sUnit = p.stockUnit || 'pcs';
        const pUnit = p.purchaseUnit || sUnit;
        const cFactor = p.conversionFactor || 1;
        const pPrice =
          p.purchasePrice || (p.costPerUnit ? Math.round(p.costPerUnit * cFactor) : 0);

        list.push({
          id: p.id,
          name: p.name,
          unit: pUnit,
          stockUnit: sUnit,
          purchaseUnit: pUnit,
          conversionFactor: cFactor,
          cost: pPrice,
          entityType: 'PRODUCT',
          itemType: 'BARANG_SIAP_JUAL',
          stock: p.stock || 0,
        });
      }
    });

    return list.sort((a, b) =>
      a.name.trim().localeCompare(b.name.trim(), 'id', { sensitivity: 'base' })
    );
  }, [ingredients, products]);

  // Form Row Items State
  const [rows, setRows] = useState<FormRowItem[]>(() => {
    if (initialPurchase?.items && initialPurchase.items.length > 0) {
      return initialPurchase.items.map((it, index) => {
        const qty = it.quantity || 1;
        const unitPrice = it.costPerUnit || 0;
        const disc = it.discount || 0;
        const tax = it.tax || 0;
        const rowTotal = it.subtotal || it.total || Math.max(0, qty * unitPrice - disc + tax);
        const matched = availableItems.find(a => a.id === it.targetId);

        return {
          keyId: `row_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 5)}`,
          targetId: it.targetId,
          targetName: it.targetName,
          description: it.description || '',
          entityType: it.entityType || 'INGREDIENT',
          itemType: it.itemType || 'BAHAN_BAKU',
          quantity: qty,
          unit: it.unit || it.purchaseUnit || matched?.unit || 'pcs',
          purchaseUnit: it.purchaseUnit || it.unit || matched?.purchaseUnit || 'pcs',
          stockUnit: it.stockUnit || matched?.stockUnit || 'pcs',
          conversionFactor: it.conversionFactor || matched?.conversionFactor || 1,
          costPerUnit: unitPrice,
          discount: disc,
          tax: tax,
          total: rowTotal,
          stock: matched?.stock || 0,
        };
      });
    }

    // Default empty row
    return [
      {
        keyId: `row_${Date.now()}_1`,
        targetId: '',
        targetName: '',
        description: '',
        entityType: 'INGREDIENT',
        itemType: 'BAHAN_BAKU',
        quantity: 1,
        unit: 'pcs',
        purchaseUnit: 'pcs',
        stockUnit: 'pcs',
        conversionFactor: 1,
        costPerUnit: 0,
        discount: 0,
        tax: 0,
        total: 0,
        stock: 0,
      },
    ];
  });

  // Active Dropdown state per row
  const [activePickerRowIndex, setActivePickerRowIndex] = useState<number | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-generate purchase number if empty and creating
  useEffect(() => {
    if (!isEditMode && !purchaseNo) {
      const dateFormatted = date.replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      setPurchaseNo(`PB-${dateFormatted}-${randomSuffix}`);
    }
  }, [date, isEditMode, purchaseNo]);

  // Click outside to close active product combobox
  useEffect(() => {
    if (activePickerRowIndex === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.product-combobox-container')) {
        setActivePickerRowIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activePickerRowIndex]);

  // Filter items in dropdown
  const filteredPickerItems = useMemo(() => {
    const q = pickerSearchQuery.trim().toLowerCase();
    if (!q) return availableItems;
    return availableItems.filter(
      i => i.name.toLowerCase().includes(q) || i.unit.toLowerCase().includes(q)
    );
  }, [availableItems, pickerSearchQuery]);

  // Group items by letter A-Z
  const groupedPickerItems = useMemo(() => {
    const groups: Array<{ letter: string; items: typeof availableItems }> = [];
    const map = new Map<string, typeof availableItems>();
    filteredPickerItems.forEach(item => {
      const firstChar = (item.name.trim()[0] || '#').toUpperCase();
      const letter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';
      if (!map.has(letter)) {
        const arr: typeof availableItems = [];
        map.set(letter, arr);
        groups.push({ letter, items: arr });
      }
      map.get(letter)!.push(item);
    });
    return groups;
  }, [filteredPickerItems]);

  // Calculations
  const itemsSubtotal = useMemo(() => {
    return rows.filter(r => r.targetId).reduce((sum, r) => sum + (r.total || 0), 0);
  }, [rows]);

  const grandTotal = useMemo(() => {
    const calculated =
      itemsSubtotal -
      Math.max(0, discountInvoice || 0) +
      Math.max(0, taxInvoice || 0) +
      Math.max(0, shippingCost || 0) +
      Math.max(0, transactionCost || 0);
    return Math.max(0, calculated);
  }, [itemsSubtotal, discountInvoice, taxInvoice, shippingCost, transactionCost]);

  // Row Manipulation Handlers
  const handleAddRow = () => {
    setRows(prev => [
      ...prev,
      {
        keyId: `row_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        targetId: '',
        targetName: '',
        description: '',
        entityType: 'INGREDIENT',
        itemType: 'BAHAN_BAKU',
        quantity: 1,
        unit: 'pcs',
        purchaseUnit: 'pcs',
        stockUnit: 'pcs',
        conversionFactor: 1,
        costPerUnit: 0,
        discount: 0,
        tax: 0,
        total: 0,
        stock: 0,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      // Clear instead of remove if only 1 row left
      setRows([
        {
          keyId: `row_${Date.now()}_1`,
          targetId: '',
          targetName: '',
          description: '',
          entityType: 'INGREDIENT',
          itemType: 'BAHAN_BAKU',
          quantity: 1,
          unit: 'pcs',
          purchaseUnit: 'pcs',
          stockUnit: 'pcs',
          conversionFactor: 1,
          costPerUnit: 0,
          discount: 0,
          tax: 0,
          total: 0,
          stock: 0,
        },
      ]);
      return;
    }
    setRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSelectProduct = (index: number, item: (typeof availableItems)[0]) => {
    setRows(prev => {
      const updated = [...prev];
      const cur = updated[index];
      const defaultQty = cur.quantity > 0 ? cur.quantity : 1;
      const defaultCost = item.cost || 0;
      const defaultTotal = Math.max(0, defaultQty * defaultCost - (cur.discount || 0) + (cur.tax || 0));

      updated[index] = {
        ...cur,
        targetId: item.id,
        targetName: item.name,
        entityType: item.entityType,
        itemType: item.itemType,
        unit: item.unit,
        purchaseUnit: item.purchaseUnit,
        stockUnit: item.stockUnit,
        conversionFactor: item.conversionFactor,
        costPerUnit: defaultCost,
        total: defaultTotal,
        stock: item.stock,
      };
      return updated;
    });

    setActivePickerRowIndex(null);
    setPickerSearchQuery('');
  };

  // BIDIRECTIONAL ROW INPUT LOGIC:
  // 1. Edit Quantity -> Recalculate Total
  const handleQuantityChange = (index: number, newQty: number) => {
    setRows(prev => {
      const updated = [...prev];
      const row = updated[index];
      const qty = Math.max(0, newQty);
      const newTotal = Math.max(0, Math.round(qty * row.costPerUnit - (row.discount || 0) + (row.tax || 0)));
      updated[index] = { ...row, quantity: qty, total: newTotal };
      return updated;
    });
  };

  // 2. Edit Unit Price (Harga Satuan) -> Recalculate Total
  const handleUnitPriceChange = (index: number, newUnitPrice: number) => {
    setRows(prev => {
      const updated = [...prev];
      const row = updated[index];
      const unitPrice = Math.max(0, newUnitPrice);
      const newTotal = Math.max(0, Math.round(row.quantity * unitPrice - (row.discount || 0) + (row.tax || 0)));
      updated[index] = { ...row, costPerUnit: unitPrice, total: newTotal };
      return updated;
    });
  };

  // 3. Edit Total -> Recalculate Unit Price (Harga Satuan)
  const handleTotalChange = (index: number, newTotal: number) => {
    setRows(prev => {
      const updated = [...prev];
      const row = updated[index];
      const total = Math.max(0, newTotal);
      const effectiveBase = total + (row.discount || 0) - (row.tax || 0);
      const newUnitPrice = row.quantity > 0 ? Math.max(0, Math.round((effectiveBase / row.quantity) * 100) / 100) : 0;
      updated[index] = { ...row, total, costPerUnit: newUnitPrice };
      return updated;
    });
  };

  // 4. Edit Row Discount -> Recalculate Total
  const handleRowDiscountChange = (index: number, discountVal: number) => {
    setRows(prev => {
      const updated = [...prev];
      const row = updated[index];
      const disc = Math.max(0, discountVal);
      const newTotal = Math.max(0, Math.round(row.quantity * row.costPerUnit - disc + (row.tax || 0)));
      updated[index] = { ...row, discount: disc, total: newTotal };
      return updated;
    });
  };

  // 5. Edit Row Tax -> Recalculate Total
  const handleRowTaxChange = (index: number, taxVal: number) => {
    setRows(prev => {
      const updated = [...prev];
      const row = updated[index];
      const tax = Math.max(0, taxVal);
      const newTotal = Math.max(0, Math.round(row.quantity * row.costPerUnit - (row.discount || 0) + tax));
      updated[index] = { ...row, tax, total: newTotal };
      return updated;
    });
  };

  // Handle Quick Create Vendor
  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;
    try {
      const created = await addVendor({
        name: newVendorName.trim(),
        contactName: newVendorContact.trim(),
        phone: newVendorPhone.trim(),
        active: true,
      });
      setVendorId(created.id);
      setVendorName(created.name);
      setShowNewVendorModal(false);
      setNewVendorName('');
      setNewVendorContact('');
      setNewVendorPhone('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menambah supplier');
    }
  };

  // Form Submit (Save Purchase)
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!vendorName.trim()) {
      setErrorMessage('Pilih atau isi nama Supplier/Vendor terlebih dahulu.');
      return;
    }

    if (!date) {
      setErrorMessage('Tanggal transaksi wajib diisi.');
      return;
    }

    const validItems = rows.filter(r => r.targetId && r.quantity > 0);
    if (validItems.length === 0) {
      setErrorMessage('Tambahkan minimal 1 barang dengan jumlah lebih dari 0.');
      return;
    }

    // Convert rows to PurchaseItem[]
    const purchaseItems: PurchaseItem[] = validItems.map(row => {
      const cFactor = row.conversionFactor || 1;
      const stockAdded = row.quantity * cFactor;
      const costPerStockUnit =
        cFactor > 0 ? Math.round((row.costPerUnit / cFactor) * 100) / 100 : row.costPerUnit;

      return {
        targetId: row.targetId,
        targetName: row.targetName,
        description: row.description?.trim() || '',
        entityType: row.entityType,
        itemType: row.itemType,
        quantity: row.quantity,
        unit: row.unit || row.purchaseUnit,
        purchaseUnit: row.purchaseUnit || row.unit,
        stockUnit: row.stockUnit || 'pcs',
        conversionFactor: cFactor,
        costPerUnit: row.costPerUnit,
        costPerStockUnit: costPerStockUnit,
        stockQuantityAdded: stockAdded,
        discount: row.discount || 0,
        tax: row.tax || 0,
        subtotal: row.total,
        total: row.total,
      };
    });

    setIsSubmitting(true);
    try {
      if (isEditMode && initialPurchase) {
        const updated = await updatePurchase(initialPurchase.id, {
          purchaseNo: purchaseNo.trim() || initialPurchase.purchaseNo,
          vendorId,
          vendorName: vendorName.trim(),
          invoiceNo: invoiceNo.trim(),
          reference: reference.trim(),
          dueDate,
          date,
          items: purchaseItems,
          subtotal: itemsSubtotal,
          discount: discountInvoice,
          tax: taxInvoice,
          shippingCost,
          transactionCost,
          totalAmount: grandTotal,
          notes: notes.trim(),
        });
        onSaved(updated.id);
      } else {
        const created = await createPurchase({
          purchaseNo: purchaseNo.trim(),
          vendorId,
          vendorName: vendorName.trim(),
          invoiceNo: invoiceNo.trim(),
          reference: reference.trim(),
          dueDate,
          date,
          items: purchaseItems,
          subtotal: itemsSubtotal,
          discount: discountInvoice,
          tax: taxInvoice,
          shippingCost,
          transactionCost,
          totalAmount: grandTotal,
          paidAmount: initialPaymentAmount,
          paymentSource: initialPaymentSource,
          notes: notes.trim(),
        });
        onSaved(created.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan transaksi pembelian';
      setErrorMessage(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8ECF2]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl border border-[#E8ECF2] bg-white text-[#667085] hover:text-[#172033] hover:bg-[#F7F8FA] transition cursor-pointer"
            title="Kembali ke Riwayat"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#667085]">
              <span>Pembelian</span>
              <span>&rsaquo;</span>
              <span className="text-[#FF641F]">
                {isEditMode ? `Edit ${initialPurchase?.purchaseNo}` : 'Tambah Pembelian'}
              </span>
            </div>
            <h1 className="text-lg font-extrabold text-[#172033] mt-0.5">
              {isEditMode ? `Edit Pembelian ${purchaseNo}` : 'Tambah Pembelian Baru'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-[#E8ECF2] bg-white text-xs font-bold text-[#667085] hover:bg-[#F7F8FA] hover:text-[#172033] transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmitPurchase}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-[#FF641F] hover:bg-[#E04F16] disabled:bg-[#CBD5E1] text-white text-xs font-extrabold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-[#FEF3F2] border border-[#FECDCA] text-xs font-bold text-[#D92D20] flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Offline Mode Alert */}
      {!isOnline && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-2.5 shadow-2xs">
          <Clock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Mode Offline Aktif: Transaksi pembelian akan langsung menambah stok lokal di IndexedDB dan disinkronkan otomatis saat kembali online.
          </span>
        </div>
      )}

      {/* FORM CONTAINER */}
      <form onSubmit={handleSubmitPurchase} className="space-y-5">
        {/* CARD 1: INFORMASI VENDOR & TRANSAKSI */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8ECF2] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E8ECF2]">
            <span className="flex items-center gap-2 text-xs font-extrabold text-[#172033] uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-[#FF641F]" />
              <span>Informasi Vendor &amp; Pembelian</span>
            </span>
            <button
              type="button"
              onClick={() => setShowNewVendorModal(true)}
              className="text-xs font-bold text-[#FF641F] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Supplier Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Vendor */}
            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5">
                Vendor / Supplier <span className="text-red-500">*</span>
              </label>
              <select
                value={vendorId}
                onChange={e => {
                  const val = e.target.value;
                  setVendorId(val);
                  const v = effectiveVendors.find(item => item.id === val);
                  if (v) {
                    setVendorName(v.name);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition cursor-pointer"
              >
                <option value="">-- Pilih Supplier Terdaftar --</option>
                {effectiveVendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.contactName ? `(${v.contactName})` : ''}
                  </option>
                ))}
              </select>

              {!vendorId && (
                <input
                  type="text"
                  placeholder="Atau ketik nama supplier..."
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                  className="mt-2 w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-white text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              )}
            </div>

            {/* Tanggal Transaksi */}
            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5">
                Tanggal Transaksi <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>

            {/* Tanggal Jatuh Tempo */}
            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5">
                Tanggal Jatuh Tempo (Opsional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>

            {/* Nomor Pembelian */}
            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5">
                Nomor Pembelian (PO/PB) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: PB-00001"
                value={purchaseNo}
                onChange={e => setPurchaseNo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>

            {/* Nomor Invoice Vendor */}
            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5">
                Nomor Nota / Invoice Supplier
              </label>
              <input
                type="text"
                placeholder="Contoh: INV-2026/09/88"
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>

            {/* Referensi */}
            <div>
              <label className="block text-xs font-bold text-[#172033] mb-1.5">
                Referensi (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: No Surat Jalan / PO Customer"
                value={reference}
                onChange={e => setReference(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>
          </div>
        </div>

          {/* CARD 2: TABEL INPUT BARANG (KLEDO STYLE) */}
        <div className="bg-white p-5 rounded-2xl border border-[#E8ECF2] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E8ECF2]">
            <div>
              <span className="flex items-center gap-2 text-xs font-extrabold text-[#172033] uppercase tracking-wider">
                <ShoppingBag className="w-4 h-4 text-[#FF641F]" />
                <span>Daftar Barang Yang Dibeli</span>
              </span>
              <p className="text-[11px] text-[#667085] mt-0.5">
                Ketik <strong>Kuantitas</strong> &times; <strong>Harga</strong> &rarr; Jumlah otomatis, atau ketik <strong>Jumlah</strong> &rarr; Harga otomatis terhitung.
              </p>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="overflow-x-auto overflow-y-visible border border-[#E8ECF2] rounded-xl pb-32">
            <table className="w-full text-left text-xs border-collapse min-w-[920px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E8ECF2] text-[#667085] font-bold text-[11px] uppercase tracking-wider">
                  <th className="p-3 w-64">Produk</th>
                  <th className="p-3 w-40">Deskripsi</th>
                  <th className="p-3 w-24 text-right">Kuantitas</th>
                  <th className="p-3 w-28 text-center">Satuan</th>
                  <th className="p-3 w-28 text-right">Discount</th>
                  <th className="p-3 w-36 text-right">Harga</th>
                  <th className="p-3 w-28 text-center">Pajak</th>
                  <th className="p-3 w-36 text-right">Jumlah</th>
                  <th className="p-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8ECF2] bg-white">
                {rows.map((row, index) => {
                  const isRowActive = activePickerRowIndex === index;
                  return (
                    <tr
                      key={row.keyId}
                      className="hover:bg-slate-50/40 transition"
                      style={{ position: 'relative', zIndex: isRowActive ? 40 : rows.length - index }}
                    >
                      {/* Produk Inline Attached Combobox */}
                      <td className="p-2.5 relative">
                        <div className="relative product-combobox-container">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              placeholder="Pilih Produk"
                              value={
                                isRowActive
                                  ? pickerSearchQuery
                                  : row.targetName || ''
                              }
                              onFocus={() => {
                                setActivePickerRowIndex(index);
                                setPickerSearchQuery(row.targetName || '');
                              }}
                              onChange={e => {
                                setPickerSearchQuery(e.target.value);
                                if (activePickerRowIndex !== index) {
                                  setActivePickerRowIndex(index);
                                }
                              }}
                              className="w-full pl-3 pr-7 py-2 rounded-xl border border-[#E8ECF2] bg-white text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:ring-1 focus:ring-[#FF641F]"
                            />
                            <Search className="w-3.5 h-3.5 text-[#98A2B3] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {/* Attached Dropdown Menu (Directly Below the Input) */}
                          {isRowActive && (
                            <div
                              className="absolute left-0 top-full mt-1 w-full min-w-[280px] bg-white rounded-xl border border-[#E8ECF2] shadow-xl py-1 z-50 max-h-60 overflow-y-auto"
                              onMouseDown={e => e.preventDefault()}
                            >
                              {filteredPickerItems.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-[#667085] text-center">
                                  Produk &quot;{pickerSearchQuery}&quot; tidak ditemukan.
                                </div>
                              ) : (
                                filteredPickerItems.map(item => {
                                  const isSelected = item.id === row.targetId;
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => handleSelectProduct(index, item)}
                                      className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 hover:bg-[#F2F4F7] transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#F8F9FC] font-bold text-[#FF641F]'
                                          : 'text-[#172033]'
                                      }`}
                                    >
                                      <div className="truncate">
                                        <span className="font-semibold">{item.name}</span>
                                        <span className="text-[10px] text-[#667085] ml-1.5 font-normal">
                                          ({item.unit})
                                        </span>
                                      </div>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F2F4F7] text-[#475467] shrink-0 font-medium">
                                        Stok: {formatNumber(item.stock)}
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Deskripsi */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          placeholder="Deskripsi..."
                          value={row.description}
                          onChange={e => {
                            const val = e.target.value;
                            setRows(prev => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], description: val };
                              return updated;
                            });
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-[#E8ECF2] bg-white text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F]"
                        />
                      </td>

                      {/* Kuantitas */}
                      <td className="p-2.5">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={row.quantity || ''}
                          onChange={e => handleQuantityChange(index, Number(e.target.value))}
                          className="w-full px-2.5 py-2 rounded-xl border border-[#E8ECF2] bg-white text-xs font-bold text-right text-[#172033] focus:outline-none focus:border-[#FF641F]"
                        />
                      </td>

                      {/* Satuan Select */}
                      <td className="p-2.5">
                        <select
                          value={row.unit || 'pcs'}
                          onChange={e => {
                            const val = e.target.value;
                            setRows(prev => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], unit: val, purchaseUnit: val };
                              return updated;
                            });
                          }}
                          className="w-full px-2 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-center text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer"
                        >
                          {/* Selected product unit or standard units */}
                          {row.unit && !['kg', 'gram', 'liter', 'ml', 'pcs', 'box', 'pack', 'botol', 'dus', 'ikat', 'porsi'].includes(row.unit) && (
                            <option value={row.unit}>{row.unit}</option>
                          )}
                          <option value="kg">kg</option>
                          <option value="gram">gram</option>
                          <option value="liter">liter</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                          <option value="box">box</option>
                          <option value="pack">pack</option>
                          <option value="botol">botol</option>
                          <option value="dus">dus</option>
                          <option value="ikat">ikat</option>
                          <option value="porsi">porsi</option>
                        </select>
                      </td>

                      {/* Discount Row */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={row.discount ? formatNumberInput(row.discount) : ''}
                          onChange={e => handleRowDiscountChange(index, parseNumberInput(e.target.value))}
                          className="w-full px-2.5 py-2 rounded-xl border border-[#E8ECF2] bg-white text-xs font-semibold text-right text-[#667085] focus:outline-none focus:border-[#FF641F]"
                        />
                      </td>

                      {/* Harga Satuan (EDITABLE) */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={row.costPerUnit ? formatNumberInput(row.costPerUnit) : ''}
                          onChange={e => handleUnitPriceChange(index, parseNumberInput(e.target.value))}
                          className="w-full px-2.5 py-2 rounded-xl border border-[#E8ECF2] bg-white text-xs font-bold text-right text-[#172033] focus:outline-none focus:border-[#FF641F]"
                        />
                      </td>

                      {/* Pajak Select */}
                      <td className="p-2.5">
                        <select
                          value={row.tax > 0 ? 'PPN11' : 'NONE'}
                          onChange={e => {
                            const val = e.target.value;
                            const taxAmt = val === 'PPN11' ? Math.round(row.quantity * row.costPerUnit * 0.11) : 0;
                            handleRowTaxChange(index, taxAmt);
                          }}
                          className="w-full px-2 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-center text-[#172033] focus:outline-none focus:border-[#FF641F] cursor-pointer"
                        >
                          <option value="NONE">0%</option>
                          <option value="PPN11">PPN 11%</option>
                        </select>
                      </td>

                      {/* Jumlah Total Row (EDITABLE) */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={row.total ? formatNumberInput(row.total) : ''}
                          onChange={e => handleTotalChange(index, parseNumberInput(e.target.value))}
                          className="w-full px-2.5 py-2 rounded-xl border border-[#E8ECF2] bg-[#F8FAFC] text-xs font-extrabold text-right text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white"
                        />
                      </td>

                      {/* Aksi Delete Row */}
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          className="p-2 rounded-xl text-[#667085] hover:text-[#D92D20] hover:bg-[#FEF3F2] transition cursor-pointer"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SINGLE KLEDO-STYLE '+ Tambah baris' BUTTON */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-4 py-2 rounded-xl border border-[#E8ECF2] bg-white hover:bg-[#F8FAFC] hover:border-[#172033]/30 text-xs font-bold text-[#172033] flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#667085]" />
              <span>+ Tambah baris</span>
            </button>
          </div>
        </div>

        {/* CARD 3: CATATAN & RINGKASAN TOTAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Notes & Optional Initial Payment */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E8ECF2] shadow-xs space-y-3">
              <label className="block text-xs font-bold text-[#172033]">
                Catatan Transaksi (Opsional)
              </label>
              <textarea
                rows={3}
                placeholder="Catatan tambahan mengenai pembelian atau termin pembayaran..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-medium text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>

            {/* In create mode: Option to record initial payment right away */}
            {!isEditMode && (
              <div className="bg-white p-5 rounded-2xl border border-[#E8ECF2] shadow-xs space-y-3">
                <span className="block text-xs font-extrabold text-[#172033] uppercase tracking-wider">
                  Pembayaran Langsung Saat Buat (Opsional)
                </span>
                <p className="text-[11px] text-[#667085]">
                  Kosongkan jika transaksi ini adalah <strong>Hutang / Belum Dibayar</strong>. Pembayaran dapat dicatat kapan saja di halaman Detail.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">
                      Jumlah Dibayar (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={initialPaymentAmount ? formatNumberInput(initialPaymentAmount) : ''}
                        onChange={e => {
                          const val = parseNumberInput(e.target.value);
                          setInitialPaymentAmount(val);
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#172033] mb-1">
                      Dibayar Dari
                    </label>
                    <select
                      value={initialPaymentSource}
                      onChange={e => setInitialPaymentSource(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-[#172033] focus:outline-none focus:border-[#FF641F] focus:bg-white cursor-pointer"
                    >
                      <option value="KAS_KASIR">Kas Kasir</option>
                      <option value="KAS_QRIS">Kas QRIS</option>
                      <option value="KAS_OWNER">Kas Owner</option>
                      {currentRole !== 'KASIR' && (
                        <>
                          <option value="BANK_BCA">Bank BCA</option>
                          <option value="BANK_JAGO">Bank Jago</option>
                          <option value="BANK_MANDIRI">Bank Mandiri</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Financial Calculation Summary Box */}
          <div className="lg:col-span-6">
            <div className="bg-white p-5 rounded-2xl border border-[#E8ECF2] shadow-xs space-y-3.5">
              <span className="block text-xs font-extrabold text-[#172033] uppercase tracking-wider pb-2 border-b border-[#E8ECF2]">
                Ringkasan Total Pembelian
              </span>

              <div className="space-y-2.5 text-xs">
                {/* Subtotal */}
                <div className="flex items-center justify-between">
                  <span className="text-[#667085] font-semibold">Subtotal Barang:</span>
                  <span className="font-extrabold text-[#172033]">
                    {formatRupiah(itemsSubtotal)}
                  </span>
                </div>

                {/* Diskon Faktur */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#667085] font-semibold">Diskon Faktur (Rp):</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={discountInvoice ? formatNumberInput(discountInvoice) : ''}
                    onChange={e => setDiscountInvoice(parseNumberInput(e.target.value))}
                    className="w-36 px-2.5 py-1.5 rounded-lg border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-right text-[#D92D20] focus:outline-none focus:border-[#FF641F]"
                  />
                </div>

                {/* Pajak Faktur */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#667085] font-semibold">Pajak (Rp):</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={taxInvoice ? formatNumberInput(taxInvoice) : ''}
                    onChange={e => setTaxInvoice(parseNumberInput(e.target.value))}
                    className="w-36 px-2.5 py-1.5 rounded-lg border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-right text-[#172033] focus:outline-none focus:border-[#FF641F]"
                  />
                </div>

                {/* Biaya Pengiriman */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#667085] font-semibold">Biaya Pengiriman (Rp):</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={shippingCost ? formatNumberInput(shippingCost) : ''}
                    onChange={e => setShippingCost(parseNumberInput(e.target.value))}
                    className="w-36 px-2.5 py-1.5 rounded-lg border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-right text-[#172033] focus:outline-none focus:border-[#FF641F]"
                  />
                </div>

                {/* Biaya Transaksi */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#667085] font-semibold">Biaya Transaksi / Admin (Rp):</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={transactionCost ? formatNumberInput(transactionCost) : ''}
                    onChange={e => setTransactionCost(parseNumberInput(e.target.value))}
                    className="w-36 px-2.5 py-1.5 rounded-lg border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-bold text-right text-[#172033] focus:outline-none focus:border-[#FF641F]"
                  />
                </div>

                {/* Grand Total */}
                <div className="pt-3 border-t-2 border-[#172033] flex items-baseline justify-between">
                  <span className="text-sm font-black text-[#172033]">TOTAL PEMBELIAN:</span>
                  <span className="text-xl font-black text-[#FF641F]">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-xl border border-[#E8ECF2] bg-white text-xs font-bold text-[#667085] hover:bg-[#F7F8FA] hover:text-[#172033] transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 py-3 rounded-xl bg-[#FF641F] hover:bg-[#E04F16] disabled:bg-[#CBD5E1] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi Pembelian'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* QUICK NEW VENDOR MODAL */}
      {showNewVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateVendor}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#E8ECF2]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E8ECF2]">
              <h3 className="text-sm font-extrabold text-[#172033]">Tambah Supplier Baru</h3>
              <button
                type="button"
                onClick={() => setShowNewVendorModal(false)}
                className="p-1 rounded-full text-[#667085] hover:bg-[#F7F8FA] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">
                  Nama Supplier <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: CV Sumber Ayam Segar"
                  value={newVendorName}
                  onChange={e => setNewVendorName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">
                  Nama Kontak (PIC)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pak H. Asep"
                  value={newVendorContact}
                  onChange={e => setNewVendorContact(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={newVendorPhone}
                  onChange={e => setNewVendorPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E8ECF2] bg-[#F7F8FA] text-xs font-semibold text-[#172033] focus:outline-none focus:border-[#FF641F]"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowNewVendorModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E8ECF2] text-xs font-bold text-[#667085] hover:bg-[#F7F8FA]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#172033] hover:bg-[#232F48] text-white text-xs font-bold"
              >
                Simpan Supplier
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
