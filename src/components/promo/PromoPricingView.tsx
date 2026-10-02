import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  OrderType,
  Product,
  ProductChannelPricing,
  ChannelPriceConfig,
} from '../../types';
import {
  formatRupiah,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import {
  ORDER_TYPE_OPTIONS,
  resolveProductChannelPrice,
} from '../../utils/saleChannel';
import { isPosMenuProduct } from '../../services/stockEngine';
import { getProductImageUrl } from '../../utils/productImages';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import { SummaryBar } from '../common/SummaryBar';
import {
  Search,
  Tag,
  Edit3,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  RotateCcw,
  Copy,
  ShieldAlert,
  Store,
  Loader2,
} from 'lucide-react';

const CHANNELS: Array<{
  id: OrderType;
  title: string;
  shortLabel: string;
  normalLabel: string;
  promoLabel: string;
  headerBg: string;
  accentText: string;
  borderClass: string;
}> = [
  {
    id: 'OFFLINE',
    title: 'OFFLINE',
    shortLabel: 'Offline',
    normalLabel: 'Harga normal',
    promoLabel: 'Harga jual',
    headerBg: 'bg-slate-100 text-slate-800',
    accentText: 'text-slate-900',
    borderClass: 'border-slate-200',
  },
  {
    id: 'GOFOOD',
    title: 'GOFOOD',
    shortLabel: 'GoFood',
    normalLabel: 'Harga normal',
    promoLabel: 'Harga promo',
    headerBg: 'bg-red-50 text-red-700',
    accentText: 'text-red-600',
    borderClass: 'border-red-200',
  },
  {
    id: 'GRABFOOD',
    title: 'GRABFOOD',
    shortLabel: 'GrabFood',
    normalLabel: 'Harga normal',
    promoLabel: 'Harga promo',
    headerBg: 'bg-emerald-50 text-emerald-700',
    accentText: 'text-emerald-600',
    borderClass: 'border-emerald-200',
  },
  {
    id: 'SHOPEEFOOD',
    title: 'SHOPEEFOOD',
    shortLabel: 'ShopeeFood',
    normalLabel: 'Harga normal',
    promoLabel: 'Harga promo',
    headerBg: 'bg-orange-50 text-[#FF641F]',
    accentText: 'text-[#FF641F]',
    borderClass: 'border-orange-200',
  },
];

interface ChannelDraft {
  channelOriginalPrice: number;
  channelPrice: number;
}

export const PromoPricingView: React.FC = () => {
  const { products, recipes, assemblies, categories, updateProductChannelPricing } = useApp();
  const { currentRole } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [promoFilter, setPromoFilter] = useState<'ALL' | 'PROMO' | 'UNCONFIGURED'>('ALL');
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  // Modal state for EDIT HARGA PROMO
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [drafts, setDrafts] = useState<Record<OrderType, ChannelDraft>>({
    OFFLINE: { channelOriginalPrice: 0, channelPrice: 0 },
    GOFOOD: { channelOriginalPrice: 0, channelPrice: 0 },
    GRABFOOD: { channelOriginalPrice: 0, channelPrice: 0 },
    SHOPEEFOOD: { channelOriginalPrice: 0, channelPrice: 0 },
  });
  const [isSaving, setIsSaving] = useState(false);

  // Strict Role Check: Only OWNER and ADMIN can access Diskon & Harga Promo
  if (currentRole !== 'OWNER' && currentRole !== 'ADMIN') {
    return (
      <div className="p-8 max-w-md mx-auto my-12 bg-white rounded-3xl border border-rose-200 text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Akses Ditolak</h2>
        <p className="text-xs text-slate-500">
          Menu Diskon &amp; Harga Promo hanya dapat diakses oleh OWNER dan ADMIN. Kasir tidak diperkenankan mengubah konfigurasi harga promo.
        </p>
      </div>
    );
  }

  // Only show sellable POS menu products (exclude Produk Hasil Produksi)
  const sellableProducts = useMemo(() => {
    return products
      .filter(p => p.active !== false && isPosMenuProduct(p, recipes, assemblies))
      .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
  }, [products, recipes, assemblies]);

  const productHasAnyPromo = (product: Product): boolean => {
    return ORDER_TYPE_OPTIONS.some(
      opt => resolveProductChannelPrice(product, opt.id).hasPromo
    );
  };

  const productHasAnyCustomChannel = (product: Product): boolean => {
    return ORDER_TYPE_OPTIONS.some(
      opt => resolveProductChannelPrice(product, opt.id).isConfigured
    );
  };

  const filteredProducts = useMemo(() => {
    return sellableProducts.filter(p => {
      if (selectedCategory !== 'ALL' && p.categoryId !== selectedCategory) {
        return false;
      }
      if (promoFilter === 'PROMO' && !productHasAnyPromo(p)) {
        return false;
      }
      if (promoFilter === 'UNCONFIGURED' && productHasAnyCustomChannel(p)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku?.toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }
      return true;
    });
  }, [sellableProducts, selectedCategory, promoFilter, searchQuery]);

  // Summary counts
  const summaryStats = useMemo(() => {
    let promoProductsCount = 0;
    let gofoodCount = 0;
    let grabfoodCount = 0;
    let shopeefoodCount = 0;

    sellableProducts.forEach(p => {
      if (productHasAnyPromo(p)) promoProductsCount += 1;
      if (resolveProductChannelPrice(p, 'GOFOOD').hasPromo) gofoodCount += 1;
      if (resolveProductChannelPrice(p, 'GRABFOOD').hasPromo) grabfoodCount += 1;
      if (resolveProductChannelPrice(p, 'SHOPEEFOOD').hasPromo) shopeefoodCount += 1;
    });

    return {
      total: sellableProducts.length,
      promoProductsCount,
      gofoodCount,
      grabfoodCount,
      shopeefoodCount,
    };
  }, [sellableProducts]);

  const toggleExpandCard = (productId: string) => {
    setExpandedCardIds(prev => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const handleOpenEditModal = (product: Product) => {
    const nextDrafts: Record<OrderType, ChannelDraft> = {
      OFFLINE: {
        channelOriginalPrice: resolveProductChannelPrice(product, 'OFFLINE').channelOriginalPrice,
        channelPrice: resolveProductChannelPrice(product, 'OFFLINE').channelPrice,
      },
      GOFOOD: {
        channelOriginalPrice: resolveProductChannelPrice(product, 'GOFOOD').channelOriginalPrice,
        channelPrice: resolveProductChannelPrice(product, 'GOFOOD').channelPrice,
      },
      GRABFOOD: {
        channelOriginalPrice: resolveProductChannelPrice(product, 'GRABFOOD').channelOriginalPrice,
        channelPrice: resolveProductChannelPrice(product, 'GRABFOOD').channelPrice,
      },
      SHOPEEFOOD: {
        channelOriginalPrice: resolveProductChannelPrice(product, 'SHOPEEFOOD').channelOriginalPrice,
        channelPrice: resolveProductChannelPrice(product, 'SHOPEEFOOD').channelPrice,
      },
    };
    setDrafts(nextDrafts);
    setEditingProduct(product);
  };

  const handleDraftChange = (
    channel: OrderType,
    field: 'channelOriginalPrice' | 'channelPrice',
    rawValue: string
  ) => {
    const parsed = Math.max(0, parseNumberInput(rawValue));
    setDrafts(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [field]: parsed,
      },
    }));
  };

  const handleResetChannelToBase = (channel: OrderType) => {
    if (!editingProduct) return;
    const base = Math.max(0, Math.round(editingProduct.sellingPrice));
    setDrafts(prev => ({
      ...prev,
      [channel]: {
        channelOriginalPrice: base,
        channelPrice: base,
      },
    }));
  };

  const handleCopyGofoodToOnline = () => {
    const gf = drafts.GOFOOD;
    setDrafts(prev => ({
      ...prev,
      GRABFOOD: {
        channelOriginalPrice: gf.channelOriginalPrice,
        channelPrice: gf.channelPrice,
      },
      SHOPEEFOOD: {
        channelOriginalPrice: gf.channelOriginalPrice,
        channelPrice: gf.channelPrice,
      },
    }));
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const basePrice = Math.max(0, Math.round(editingProduct.sellingPrice));
    const finalChannelPricing: ProductChannelPricing = {};

    for (const ch of CHANNELS) {
      const d = drafts[ch.id];
      const rawPrice = Math.round(Number(d.channelPrice) || 0);
      const rawOrig = Math.round(Number(d.channelOriginalPrice) || 0);

      // If user left channelPrice <= 0, fall back to basePrice
      const resolvedPrice = rawPrice > 0 ? rawPrice : basePrice;
      const resolvedOrig = rawOrig > 0 ? rawOrig : resolvedPrice;

      if (resolvedOrig < resolvedPrice) {
        alert(
          `Pada channel ${ch.title}, ${ch.normalLabel} (${formatRupiah(resolvedOrig)}) tidak boleh lebih kecil dari ${ch.promoLabel} (${formatRupiah(resolvedPrice)}).`
        );
        return;
      }

      const configItem: ChannelPriceConfig = {
        channelOriginalPrice: resolvedOrig,
        channelPrice: resolvedPrice,
        isActive: true,
      };
      finalChannelPricing[ch.id] = configItem;
    }

    setIsSaving(true);
    try {
      await updateProductChannelPricing(editingProduct.id, finalChannelPricing);
      setEditingProduct(null);
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan konfigurasi harga promo.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderChannelPriceCell = (product: Product, channel: OrderType) => {
    const resolved = resolveProductChannelPrice(product, channel);
    return (
      <div className="space-y-0.5 tabular-nums">
        {resolved.hasPromo ? (
          <>
            <div className="text-[11px] text-[#98A2B3] line-through font-medium leading-tight">
              {formatRupiah(resolved.channelOriginalPrice)}
            </div>
            <div className="text-xs font-extrabold text-[#FF641F] leading-tight">
              {formatRupiah(resolved.channelPrice)}
            </div>
          </>
        ) : (
          <div className="text-xs font-bold text-[#172033] leading-tight">
            {formatRupiah(resolved.channelPrice)}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageContainer className="pb-24">
      {/* PageHeader */}
      <PageHeader
        title="Diskon & Harga Promo"
        description="Atur harga normal & harga coret untuk Offline, GoFood, GrabFood, dan ShopeeFood. Kasir otomatis mengikuti harga channel."
      />

      {/* SummaryBar */}
      <SummaryBar
        items={[
          {
            label: 'Total Produk',
            value: `${summaryStats.total} Menu`,
          },
          {
            label: 'Promo GoFood',
            value: `${summaryStats.gofoodCount} Menu`,
            valueClassName: 'text-[#16A34A]',
          },
          {
            label: 'Promo GrabFood',
            value: `${summaryStats.grabfoodCount} Menu`,
            valueClassName: 'text-[#16A34A]',
          },
          {
            label: 'Promo ShopeeFood',
            value: `${summaryStats.shopeefoodCount} Menu`,
            valueClassName: 'text-[#FF5A1F]',
          },
        ]}
      />

      {/* Main Content */}
      <div className="space-y-4">
        {/* Search & Filter Controls */}
        <div className="bg-white rounded-2xl border border-[#E8ECF2] p-3.5 space-y-3 shadow-[0_1px_3px_rgba(23,32,51,0.02)]">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#98A2B3] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama produk (contoh: Ayam Geprek)..."
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#E8ECF2] text-xs font-medium text-[#172033] placeholder-[#98A2B3] focus:outline-none focus:border-[#FF641F] focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#F1F4F8] p-1 rounded-xl border border-[#E8ECF2] overflow-x-auto">
              {[
                { id: 'ALL' as const, label: 'Semua Produk' },
                { id: 'PROMO' as const, label: 'Harga Coret Aktif' },
                { id: 'UNCONFIGURED' as const, label: 'Belum Diatur' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPromoFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    promoFilter === tab.id
                      ? 'bg-white text-[#172033] shadow-2xs'
                      : 'text-[#667085] hover:text-[#172033]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter Tabs */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#172033] text-white'
                    : 'bg-[#F7F8FA] text-[#667085] hover:text-[#172033] border border-[#E8ECF2]'
                }`}
              >
                Semua Kategori
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#172033] text-white'
                      : 'bg-[#F7F8FA] text-[#667085] hover:text-[#172033] border border-[#E8ECF2]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* DESKTOP TABLE VIEW                                           */}
        {/* ============================================================ */}
        <div className="hidden lg:block bg-white rounded-2xl border border-[#E8ECF2] overflow-hidden shadow-[0_1px_3px_rgba(23,32,51,0.02)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8ECF2] bg-[#F8FAFC] text-[11px] font-extrabold text-[#667085] uppercase tracking-wider">
                  <th className="py-3.5 px-4">PRODUK</th>
                  <th className="py-3.5 px-4">Offline</th>
                  <th className="py-3.5 px-4">GoFood</th>
                  <th className="py-3.5 px-4">GrabFood</th>
                  <th className="py-3.5 px-4">ShopeeFood</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8ECF2] text-xs">
                {filteredProducts.map(product => (
                  <tr
                    key={product.id}
                    className="hover:bg-[#F8FAFC] transition cursor-pointer"
                    onClick={() => handleOpenEditModal(product)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={getProductImageUrl(product.name)}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-xl object-cover bg-[#F1F4F8] border border-[#E8ECF2] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-[#172033] truncate">
                            {product.name}
                          </div>
                          <div className="text-[11px] text-[#667085] mt-0.5 tabular-nums">
                            Harga dasar: {formatRupiah(product.sellingPrice)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {renderChannelPriceCell(product, 'OFFLINE')}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderChannelPriceCell(product, 'GOFOOD')}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderChannelPriceCell(product, 'GRABFOOD')}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderChannelPriceCell(product, 'SHOPEEFOOD')}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenEditModal(product);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#FFF6F0] hover:bg-[#FFEADA] border border-[#FF641F]/30 text-[#FF641F] font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Harga Promo</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="p-10 text-center text-xs text-[#667085]">
              Tidak ada produk yang sesuai dengan pencarian.
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* MOBILE EXPANDABLE CARD VIEW                                  */}
        {/* ============================================================ */}
        <div className="lg:hidden space-y-2.5">
          {filteredProducts.map(product => {
            const isExpanded = Boolean(expandedCardIds[product.id]);
            const offlineRes = resolveProductChannelPrice(product, 'OFFLINE');
            const gofoodRes = resolveProductChannelPrice(product, 'GOFOOD');
            const grabfoodRes = resolveProductChannelPrice(product, 'GRABFOOD');
            const shopeefoodRes = resolveProductChannelPrice(product, 'SHOPEEFOOD');
            const hasPromo = productHasAnyPromo(product);

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-[#E8ECF2] overflow-hidden shadow-[0_1px_3px_rgba(23,32,51,0.02)]"
              >
                {/* Card Header (Tap to Expand) */}
                <button
                  type="button"
                  onClick={() => toggleExpandCard(product.id)}
                  className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F8FAFC] transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={getProductImageUrl(product.name)}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover bg-[#F1F4F8] border border-[#E8ECF2] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold text-[#172033] truncate">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-[#667085] mt-0.5 tabular-nums">
                        <span>Offline: {formatRupiah(offlineRes.channelPrice)}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span className={hasPromo ? 'text-[#FF641F] font-semibold' : ''}>
                          {hasPromo ? 'Promo Aktif' : 'Harga Normal'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#667085]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#667085]" />
                    )}
                  </div>
                </button>

                {/* Expandable Channel Pricing Details */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-[#F1F4F8] space-y-3 bg-[#F8FAFC]/60">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Offline', res: offlineRes },
                        { label: 'GoFood', res: gofoodRes },
                        { label: 'GrabFood', res: grabfoodRes },
                        { label: 'ShopeeFood', res: shopeefoodRes },
                      ].map(ch => (
                        <div
                          key={ch.label}
                          className="p-2.5 rounded-xl bg-white border border-[#E8ECF2] space-y-1"
                        >
                          <span className="text-[10px] font-bold text-[#667085] block">
                            {ch.label}
                          </span>
                          <div className="tabular-nums">
                            {ch.res.hasPromo ? (
                              <>
                                <span className="text-[11px] text-[#98A2B3] line-through block leading-tight">
                                  {formatRupiah(ch.res.channelOriginalPrice)}
                                </span>
                                <span className="text-xs font-extrabold text-[#FF641F] block leading-tight">
                                  {formatRupiah(ch.res.channelPrice)}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs font-bold text-[#172033] block">
                                {formatRupiah(ch.res.channelPrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(product)}
                      className="w-full py-2.5 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>EDIT HARGA PROMO</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="p-8 bg-white rounded-2xl border border-[#E8ECF2] text-center text-xs text-[#667085]">
              Tidak ada produk yang ditemukan.
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: EDIT HARGA PROMO                                      */}
      {/* ============================================================ */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => !isSaving && setEditingProduct(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#E8ECF2] flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E8ECF2] flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-extrabold text-[#172033] uppercase tracking-tight">
                  EDIT HARGA PROMO
                </h2>
                <p className="text-xs text-[#667085] mt-0.5">
                  Nama Produk:{' '}
                  <strong className="text-[#172033]">{editingProduct.name}</strong>
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-full text-[#98A2B3] hover:text-[#172033] hover:bg-[#F1F4F8] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSavePromo}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {/* Base Price Info Banner */}
              <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E8ECF2] flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-[#172033] block">
                    Harga Dasar Produk Utama (basePrice)
                  </span>
                  <span className="text-[11px] text-[#667085]">
                    Harga dasar tidak berubah ketika membuat promo channel
                  </span>
                </div>
                <span className="text-sm font-black text-[#172033] tabular-nums">
                  {formatRupiah(editingProduct.sellingPrice)}
                </span>
              </div>

              {/* Channel Configuration Blocks */}
              {CHANNELS.map(ch => {
                const draft = drafts[ch.id];
                const previewOrig =
                  draft.channelOriginalPrice > 0
                    ? draft.channelOriginalPrice
                    : draft.channelPrice > 0
                    ? draft.channelPrice
                    : editingProduct.sellingPrice;
                const previewSell =
                  draft.channelPrice > 0
                    ? draft.channelPrice
                    : editingProduct.sellingPrice;
                const hasValidPromo = previewOrig > previewSell;
                const isInvalidOrder =
                  draft.channelOriginalPrice > 0 &&
                  draft.channelPrice > 0 &&
                  draft.channelOriginalPrice < draft.channelPrice;

                return (
                  <div
                    key={ch.id}
                    className={`rounded-2xl border ${ch.borderClass} bg-white p-4 space-y-3`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${ch.headerBg}`}
                      >
                        {ch.title}
                      </span>

                      <div className="flex items-center gap-2">
                        {ch.id === 'GOFOOD' && (
                          <button
                            type="button"
                            onClick={handleCopyGofoodToOnline}
                            className="text-[11px] font-semibold text-[#FF641F] hover:underline flex items-center gap-1 cursor-pointer"
                            title="Salin harga GoFood ke GrabFood & ShopeeFood"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Salin ke Grab &amp; Shopee</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleResetChannelToBase(ch.id)}
                          className="text-[11px] font-semibold text-[#667085] hover:text-[#172033] flex items-center gap-1 cursor-pointer"
                          title="Samakan dengan harga dasar produk"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Harga Dasar</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-[#475467] block mb-1">
                          {ch.normalLabel}:
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#98A2B3]">
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatNumberInput(draft.channelOriginalPrice)}
                            onChange={e =>
                              handleDraftChange(
                                ch.id,
                                'channelOriginalPrice',
                                e.target.value
                              )
                            }
                            placeholder={formatNumberInput(editingProduct.sellingPrice)}
                            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#D0D5DD] bg-[#F8FAFC] focus:bg-white focus:border-[#FF641F] focus:outline-none text-xs font-bold text-[#172033] tabular-nums"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-[#475467] block mb-1">
                          {ch.promoLabel}:
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#98A2B3]">
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatNumberInput(draft.channelPrice)}
                            onChange={e =>
                              handleDraftChange(ch.id, 'channelPrice', e.target.value)
                            }
                            placeholder={formatNumberInput(editingProduct.sellingPrice)}
                            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#D0D5DD] bg-[#F8FAFC] focus:bg-white focus:border-[#FF641F] focus:outline-none text-xs font-bold text-[#FF641F] tabular-nums"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preview Bar */}
                    <div className="pt-2 border-t border-[#F1F4F8] flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-[#667085]">
                        Preview:
                      </span>
                      {isInvalidOrder ? (
                        <span className="text-[11px] font-bold text-rose-600">
                          Harga normal harus &ge; {ch.promoLabel.toLowerCase()}
                        </span>
                      ) : hasValidPromo ? (
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-xs text-[#98A2B3] line-through font-medium">
                            {formatRupiah(previewOrig)}
                          </span>
                          <span className="text-xs font-extrabold text-[#FF641F]">
                            {formatRupiah(previewSell)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-[#172033] tabular-nums">
                          {formatRupiah(previewSell)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Modal Footer Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-3 rounded-xl border border-[#D0D5DD] text-[#344054] font-bold text-xs hover:bg-[#F8FAFC] transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-2 py-3 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-extrabold text-xs shadow-md shadow-[#FF641F]/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>SIMPAN</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
