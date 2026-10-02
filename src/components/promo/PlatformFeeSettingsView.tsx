import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PlatformFeeSetting } from '../../types';
import { formatRupiah, formatNumberInput, parseNumberInput } from '../../utils/formatters';
import {
  calculatePlatformFeeBreakdown,
  DEFAULT_PLATFORM_FEE_SETTINGS,
} from '../../utils/saleChannel';
import { PageContainer } from '../common/PageContainer';
import { PageHeader } from '../common/PageHeader';
import {
  Percent,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  RotateCcw,
  Calculator,
} from 'lucide-react';

interface PlatformFeeSettingsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const PlatformFeeSettingsView: React.FC<PlatformFeeSettingsViewProps> = () => {
  const {
    platformFeeSettings,
    savePlatformFeeSetting,
    addPlatformFeeSetting,
    deletePlatformFeeSetting,
  } = useApp();
  const { currentRole } = useAuth();

  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN';

  // Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    id: string;
    platform: string;
    platformName: string;
    percentageFee: number;
    fixedFee: number;
    shippingDiscount: number;
    active: boolean;
    notes: string;
  }>({
    id: '',
    platform: '',
    platformName: '',
    percentageFee: 20,
    fixedFee: 0,
    shippingDiscount: 0,
    active: true,
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Simulation test amount (inside Edit Modal)
  const [simTotalBelanja, setSimTotalBelanja] = useState<number>(50000);
  const [simDiskon, setSimDiskon] = useState<number>(10000);

  const platformsList = Object.values(platformFeeSettings || {});

  const handleOpenEdit = (setting: PlatformFeeSetting) => {
    setEditingPlatformId(setting.id);
    setFormData({
      id: setting.id,
      platform: setting.platform || setting.id,
      platformName: setting.platformName || setting.id,
      percentageFee: setting.percentageFee ?? 0,
      fixedFee: setting.fixedFee ?? 0,
      shippingDiscount: setting.shippingDiscount ?? 0,
      active: setting.active !== false,
      notes: setting.notes || '',
    });
    setShowEditModal(true);
  };

  const handleOpenAdd = () => {
    const newId = `PLATFORM_${Date.now()}`;
    setEditingPlatformId(null);
    setFormData({
      id: newId,
      platform: '',
      platformName: '',
      percentageFee: 20,
      fixedFee: 0,
      shippingDiscount: 0,
      active: true,
      notes: '',
    });
    setShowEditModal(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      alert('Akses Ditolak: Hanya OWNER atau ADMIN yang dapat mengubah biaya platform.');
      return;
    }

    if (!formData.platformName.trim()) {
      alert('Nama platform tidak boleh kosong.');
      return;
    }

    if (formData.percentageFee < 0) {
      alert('Persentase biaya admin tidak boleh negatif.');
      return;
    }

    if (formData.fixedFee < 0) {
      alert('Biaya admin tetap tidak boleh negatif.');
      return;
    }

    if (formData.shippingDiscount < 0) {
      alert('Diskon ongkir tidak boleh negatif.');
      return;
    }

    setIsSaving(true);
    try {
      const code = (formData.platform || formData.platformName)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');
      const targetId = editingPlatformId || code;

      const payload: PlatformFeeSetting = {
        id: targetId,
        platform: code,
        platformName: formData.platformName.trim(),
        percentageFee: Number(formData.percentageFee) || 0,
        fixedFee: Math.round(Number(formData.fixedFee) || 0),
        shippingDiscount: Math.round(Number(formData.shippingDiscount) || 0),
        active: formData.active,
        notes: formData.notes.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (editingPlatformId) {
        await savePlatformFeeSetting(editingPlatformId, payload);
      } else {
        await addPlatformFeeSetting(payload);
      }

      setShowEditModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan platform';
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (setting: PlatformFeeSetting) => {
    if (!canEdit) {
      alert('Akses Ditolak: Hanya OWNER atau ADMIN yang dapat mengubah status platform.');
      return;
    }
    try {
      await savePlatformFeeSetting(setting.id, {
        active: !setting.active,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status platform';
      alert(msg);
    }
  };

  const handleDelete = async (settingId: string, platformName: string) => {
    if (!canEdit) {
      alert('Akses Ditolak: Hanya OWNER atau ADMIN yang dapat menghapus platform.');
      return;
    }
    const isStandard = ['GOFOOD', 'GRABFOOD', 'SHOPEEFOOD'].includes(settingId.toUpperCase());
    const promptText = isStandard
      ? `Nonaktifkan atau hapus platform ${platformName}? (Disarankan menonaktifkan ketimbang menghapus platform bawaan)`
      : `Yakin ingin menghapus konfigurasi platform ${platformName}?`;

    if (!confirm(promptText)) return;

    try {
      await deletePlatformFeeSetting(settingId);
      setShowEditModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus konfigurasi platform';
      alert(msg);
    }
  };

  const handleResetDefaults = async () => {
    if (!canEdit) {
      alert('Akses Ditolak: Hanya OWNER yang dapat mereset konfigurasi.');
      return;
    }
    if (
      !confirm(
        'Reset semua biaya admin platform ke nilai standar? (GoFood: 20% + Rp1.000, GrabFood: 20%, ShopeeFood: 25% + Rp1.000 Ongkir)'
      )
    ) {
      return;
    }

    try {
      for (const [key, defaultSetting] of Object.entries(DEFAULT_PLATFORM_FEE_SETTINGS)) {
        await savePlatformFeeSetting(key, defaultSetting);
      }
      alert('Berhasil mereset pengaturan biaya admin platform ke standar.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mereset konfigurasi';
      alert(msg);
    }
  };

  // Preview simulation for current modal form
  const modalSimulation = calculatePlatformFeeBreakdown({
    platform: formData.platform || 'GOFOOD',
    grossAmount: simTotalBelanja,
    discountAmount: simDiskon,
    setting: {
      id: formData.id,
      platform: formData.platform,
      platformName: formData.platformName,
      percentageFee: formData.percentageFee,
      fixedFee: formData.fixedFee,
      shippingDiscount: formData.shippingDiscount,
      active: formData.active,
    },
  });

  const getPlatformDotColor = (id: string) => {
    const upper = id.toUpperCase();
    if (upper.includes('GOFOOD')) return 'bg-emerald-500';
    if (upper.includes('GRABFOOD')) return 'bg-purple-600';
    if (upper.includes('SHOPEEFOOD')) return 'bg-[#FF641F]';
    return 'bg-slate-500';
  };

  return (
    <PageContainer className="pb-28">
      {/* PageHeader */}
      <PageHeader
        title="Biaya Admin Platform"
        description="Atur biaya dan potongan untuk setiap platform online."
        actions={
          canEdit ? (
            <>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="h-9 px-3.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F8FAFC] text-[#344054] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Kembalikan ke persentase default"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#667085]" />
                <span>Reset Standar</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="h-9 px-3.5 rounded-lg bg-[#FF5A1F] hover:bg-[#E04F16] text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Tambah Platform</span>
              </button>
            </>
          ) : undefined
        }
      />

      {/* Compact Information Banner: Cara Perhitungan */}
      <div className="bg-white rounded-2xl border border-[#E8ECF2] px-3.5 py-3 sm:px-4 sm:py-3.5 shadow-2xs flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-[#FFF6F0] border border-[#FF6B22]/20 text-[#FF6B22] flex items-center justify-center shrink-0 mt-0.5">
          <Calculator className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold text-[#172033]">
            Cara Perhitungan
          </div>
          <p className="text-xs text-[#667085] mt-0.5 leading-relaxed">
            Nilai setelah diskon <span className="text-[#98A2B3] font-bold">&rarr;</span> biaya admin <span className="text-[#98A2B3] font-bold">&rarr;</span> potongan ongkir <span className="text-[#98A2B3] font-bold">&rarr;</span> <span className="font-semibold text-[#172033]">dana bersih masuk wallet</span>
          </p>
        </div>
      </div>

      {/* Platform List / Table */}
      <div className="bg-white rounded-2xl border border-[#E8ECF2] shadow-2xs overflow-hidden">
        {platformsList.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#667085]">
            Belum ada platform yang dikonfigurasi.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E8ECF2] text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                    <th className="py-3 px-4">Platform</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Admin</th>
                    <th className="py-3 px-4">Biaya Tetap</th>
                    <th className="py-3 px-4">Ongkir</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8ECF2] text-xs">
                  {platformsList.map(setting => {
                    const dotColor = getPlatformDotColor(setting.id);
                    return (
                      <tr
                        key={setting.id}
                        className={`hover:bg-[#F8FAFC] transition ${
                          setting.active ? '' : 'opacity-65'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                            <span className="font-extrabold text-sm text-[#172033]">
                              {setting.platformName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => handleToggleActive(setting)}
                            className={`inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                              setting.active
                                ? 'text-[#12B76A]'
                                : 'text-[#667085]'
                            }`}
                            title={canEdit ? 'Klik untuk ubah status' : undefined}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                setting.active ? 'bg-[#12B76A]' : 'bg-[#98A2B3]'
                              }`}
                            />
                            <span>{setting.active ? 'Aktif' : 'Nonaktif'}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#172033] tabular-nums">
                          {setting.percentageFee}%
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#344054] tabular-nums">
                          {formatRupiah(setting.fixedFee)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#344054] tabular-nums">
                          {formatRupiah(setting.shippingDiscount)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => handleOpenEdit(setting)}
                            className="px-3 py-1.5 rounded-lg border border-[#D0D5DD] bg-white hover:bg-[#F8FAFC] text-[#172033] font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#FF6B22]" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Compact List */}
            <div className="md:hidden divide-y divide-[#E8ECF2]">
              {platformsList.map(setting => {
                const dotColor = getPlatformDotColor(setting.id);
                return (
                  <div
                    key={setting.id}
                    className={`p-3.5 flex items-center justify-between gap-3 ${
                      setting.active ? '' : 'opacity-65'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <span className="font-extrabold text-sm text-[#172033] truncate">
                          {setting.platformName}
                        </span>
                        <span className="text-[#CBD5E1]">&bull;</span>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleToggleActive(setting)}
                          className={`text-[11px] font-bold cursor-pointer ${
                            setting.active ? 'text-[#12B76A]' : 'text-[#667085]'
                          }`}
                        >
                          {setting.active ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </div>

                      <div className="text-xs text-[#667085] flex items-center flex-wrap gap-x-2 gap-y-0.5 tabular-nums">
                        <span>
                          Admin <strong className="text-[#172033]">{setting.percentageFee}%</strong>
                        </span>
                        <span className="text-[#CBD5E1]">&bull;</span>
                        <span>
                          Tetap <strong className="text-[#172033]">{formatRupiah(setting.fixedFee)}</strong>
                        </span>
                        <span className="text-[#CBD5E1]">&bull;</span>
                        <span>
                          Ongkir <strong className="text-[#172033]">{formatRupiah(setting.shippingDiscount)}</strong>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleOpenEdit(setting)}
                      className="px-3 py-1.5 rounded-xl border border-[#D0D5DD] bg-white hover:bg-[#F8FAFC] text-[#172033] font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#FF6B22]" />
                      <span>Edit</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Edit / Add Modal ("DETAIL SAAT EDIT") */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-[#E8ECF2] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3.5 border-b border-[#E8ECF2] flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#172033]">
                  {editingPlatformId ? `Edit Biaya ${formData.platformName}` : 'Tambah Platform Baru'}
                </h3>
                <p className="text-[11px] text-[#667085]">
                  Atur komisi admin, biaya tetap, dan potongan ongkir
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-lg bg-[#F2F4F7] text-[#667085] hover:text-[#172033] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal}>
              <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
                {/* Nama Platform & Status Toggle */}
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-[#344054] block mb-1">
                      Nama Platform <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: GoFood, GrabFood"
                      value={formData.platformName}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          platformName: e.target.value,
                          platform: prev.platform || e.target.value.toUpperCase().replace(/\s+/g, '_'),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#D0D5DD] bg-white text-xs font-bold text-[#172033] focus:outline-hidden focus:border-[#FF6B22]"
                    />
                  </div>

                  <div className="pb-0.5">
                    <label className="text-[11px] font-bold text-[#667085] block mb-1">
                      Status
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        formData.active
                          ? 'bg-[#ECFDF3] border-[#ABEFC6] text-[#067647]'
                          : 'bg-[#F2F4F7] border-[#D0D5DD] text-[#667085]'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          formData.active ? 'bg-[#12B76A]' : 'bg-[#98A2B3]'
                        }`}
                      />
                      <span>{formData.active ? 'Aktif' : 'Nonaktif'}</span>
                    </button>
                  </div>
                </div>

                {/* 3 Numerical Config Inputs */}
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Persentase Biaya Admin */}
                  <div>
                    <label className="text-[11px] font-bold text-[#344054] block mb-1">
                      Biaya Admin (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        required
                        value={formData.percentageFee}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            percentageFee: Math.max(0, parseFloat(e.target.value) || 0),
                          }))
                        }
                        className="w-full pl-3 pr-6 py-2 rounded-xl border border-[#D0D5DD] bg-white text-xs font-bold text-[#172033] tabular-nums focus:outline-hidden focus:border-[#FF6B22]"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Biaya Admin Tetap */}
                  <div>
                    <label className="text-[11px] font-bold text-[#344054] block mb-1">
                      Biaya Tetap
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#667085]">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(formData.fixedFee)}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            fixedFee: Math.max(0, parseNumberInput(e.target.value)),
                          }))
                        }
                        className="w-full pl-7 pr-2.5 py-2 rounded-xl border border-[#D0D5DD] bg-white text-xs font-bold text-[#172033] tabular-nums focus:outline-hidden focus:border-[#FF6B22]"
                      />
                    </div>
                  </div>

                  {/* Diskon Ongkir */}
                  <div>
                    <label className="text-[11px] font-bold text-[#344054] block mb-1">
                      Ongkir
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#667085]">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(formData.shippingDiscount)}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            shippingDiscount: Math.max(0, parseNumberInput(e.target.value)),
                          }))
                        }
                        className="w-full pl-7 pr-2.5 py-2 rounded-xl border border-[#D0D5DD] bg-white text-xs font-bold text-[#172033] tabular-nums focus:outline-hidden focus:border-[#FF6B22]"
                      />
                    </div>
                  </div>
                </div>

                {/* Catatan Opsional */}
                <div>
                  <label className="text-[11px] font-bold text-[#344054] block mb-1">
                    Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Komisi standar merchant reguler"
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D0D5DD] bg-white text-xs font-medium text-[#172033] focus:outline-hidden focus:border-[#FF6B22]"
                  />
                </div>

                {/* Compact Live Simulation Preview inside Edit Modal */}
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E8ECF2] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-[#172033]">
                      Simulasi Perhitungan
                    </span>
                    <span className="text-[10px] font-semibold text-[#667085]">
                      WALLET_{formData.platform || formData.id}
                    </span>
                  </div>

                  {/* Adjustable test inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-[#667085] block mb-0.5">
                        Total Belanja
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#667085]">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberInput(simTotalBelanja)}
                          onChange={e =>
                            setSimTotalBelanja(Math.max(0, parseNumberInput(e.target.value)))
                          }
                          className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-xs font-bold text-[#172033] tabular-nums"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#667085] block mb-0.5">
                        Diskon Voucher
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#667085]">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberInput(simDiskon)}
                          onChange={e =>
                            setSimDiskon(
                              Math.min(simTotalBelanja, Math.max(0, parseNumberInput(e.target.value)))
                            )
                          }
                          className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-xs font-bold text-[#172033] tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Breakdown lines */}
                  <div className="space-y-1 text-xs pt-1 border-t border-[#E8ECF2] tabular-nums">
                    <div className="flex justify-between text-[#667085]">
                      <span>Nilai Setelah Diskon</span>
                      <span className="font-bold text-[#172033]">
                        {formatRupiah(modalSimulation.netOrderAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#F04438]">
                      <span>Biaya Admin ({formData.percentageFee}%)</span>
                      <span className="font-semibold">
                        -{formatRupiah(modalSimulation.percentageFeeAmount)}
                      </span>
                    </div>
                    {formData.fixedFee > 0 && (
                      <div className="flex justify-between text-[#F04438]">
                        <span>Biaya Tetap</span>
                        <span className="font-semibold">
                          -{formatRupiah(modalSimulation.fixedFee)}
                        </span>
                      </div>
                    )}
                    {formData.shippingDiscount > 0 && (
                      <div className="flex justify-between text-[#F04438]">
                        <span>Potongan Ongkir</span>
                        <span className="font-semibold">
                          -{formatRupiah(modalSimulation.shippingDiscount)}
                        </span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-[#E8ECF2] flex justify-between items-baseline font-extrabold">
                      <span className="text-[#172033]">Dana Bersih Masuk Wallet</span>
                      <span className="text-sm text-[#12B76A]">
                        {formatRupiah(modalSimulation.walletAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-4 py-3 bg-[#F8FAFC] border-t border-[#E8ECF2] flex items-center justify-between gap-2">
                {editingPlatformId ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(formData.id, formData.platformName)}
                    className="p-2 rounded-xl text-[#F04438] hover:bg-rose-50 transition cursor-pointer"
                    title="Hapus Platform"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-[#D0D5DD] bg-white text-[#344054] font-bold text-xs hover:bg-[#F8FAFC] transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl bg-[#FF6B22] hover:bg-[#F45116] text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
