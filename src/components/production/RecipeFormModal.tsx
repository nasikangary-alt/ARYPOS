import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Recipe, RecipeItem, OverheadItem, Product } from '../../types';
import {
  formatRupiah,
  formatNumberInput,
  parseNumberInput,
} from '../../utils/formatters';
import { ChefHat, Plus, Trash2, X, Flame } from 'lucide-react';

interface RecipeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRecipe?: Recipe | null;
  targetProduct?: Product | null;
  availableProducts: Product[];
  onSaved?: (message: string) => void;
}

export const RecipeFormModal: React.FC<RecipeFormModalProps> = ({
  isOpen,
  onClose,
  editingRecipe,
  targetProduct,
  availableProducts,
  onSaved,
}) => {
  const {
    productsMap,
    ingredients,
    ingredientsMap,
    saveRecipe,
    addProduct,
    updateProduct,
  } = useApp();

  const [formProductId, setFormProductId] = useState('');
  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [formYieldQty, setFormYieldQty] = useState<number>(8);
  const [formYieldUnit, setFormYieldUnit] = useState<string>('pcs');
  const [formPatokanIngredientId, setFormPatokanIngredientId] = useState<string>('');

  const [formBatchItems, setFormBatchItems] = useState<RecipeItem[]>([
    { ingredientId: '', ingredientName: '', quantity: 1, unit: 'kg', costPerUnit: 0 },
  ]);

  const [formGasCost, setFormGasCost] = useState<number>(0);
  const [formElectricityCost, setFormElectricityCost] = useState<number>(0);
  const [formOtherOverheadCost, setFormOtherOverheadCost] = useState<number>(0);
  const [formOverheadNotes, setFormOverheadNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingRecipe) {
      setIsCreatingNewProduct(false);
      setNewProductName('');
      setFormProductId(editingRecipe.productId || targetProduct?.id || '');
      setFormYieldQty(editingRecipe.yieldQty || 1);
      setFormYieldUnit(editingRecipe.yieldUnit || targetProduct?.stockUnit || 'pcs');
      setFormPatokanIngredientId(editingRecipe.patokanIngredientId || '');

      const items =
        editingRecipe.batchItems && editingRecipe.batchItems.length > 0
          ? editingRecipe.batchItems
          : editingRecipe.items && editingRecipe.items.length > 0
          ? editingRecipe.items
          : [];

      if (items.length > 0) {
        setFormBatchItems(
          items.map((it) => {
            const ing = ingredientsMap.get(it.ingredientId);
            return {
              ...it,
              ingredientName: ing?.name || it.ingredientName,
              costPerUnit: ing?.costPerUnit || it.costPerUnit || 0,
            };
          })
        );
      } else {
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
      }

      const gas =
        editingRecipe.overheadItems?.find((o) => o.name.toLowerCase().includes('gas'))?.cost || 0;
      const elect =
        editingRecipe.overheadItems?.find((o) => o.name.toLowerCase().includes('listrik'))?.cost || 0;
      const other =
        editingRecipe.overheadItems?.find(
          (o) => !o.name.toLowerCase().includes('gas') && !o.name.toLowerCase().includes('listrik')
        )?.cost || 0;

      setFormGasCost(gas);
      setFormElectricityCost(elect);
      setFormOtherOverheadCost(other);
      setFormOverheadNotes(editingRecipe.overheadNotes || '');
    } else {
      setIsCreatingNewProduct(!targetProduct && availableProducts.length === 0);
      setNewProductName('');
      setFormProductId(targetProduct?.id || availableProducts[0]?.id || '');
      setFormYieldQty(8);
      setFormYieldUnit(targetProduct?.stockUnit || 'pcs');
      setFormPatokanIngredientId('');

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
    }
  }, [isOpen, editingRecipe, targetProduct, availableProducts, ingredients, ingredientsMap]);

  const modalRawMaterialsCost = useMemo(() => {
    return formBatchItems.reduce((acc, item) => {
      if (!item.ingredientId) return acc;
      const ing = ingredientsMap.get(item.ingredientId);
      const unitCost =
        ing && typeof ing.costPerUnit === 'number' ? ing.costPerUnit : item.costPerUnit || 0;
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

  if (!isOpen) return null;

  const applyPresetTemplate = (preset: 'AYAM_CRISPY' | 'SAMBAL' | 'NASI' | 'TEH_MANIS') => {
    const ayam =
      ingredients.find(
        (i) => i.name.toLowerCase().includes('ayam') && i.name.toLowerCase().includes('mentah')
      ) || ingredients.find((i) => i.name.toLowerCase().includes('ayam'));
    const tepung = ingredients.find((i) => i.name.toLowerCase().includes('tepung'));
    const bumbu = ingredients.find(
      (i) => i.name.toLowerCase().includes('bumbu') || i.name.toLowerCase().includes('garam')
    );
    const minyak = ingredients.find((i) => i.name.toLowerCase().includes('minyak'));
    const cabe = ingredients.find(
      (i) => i.name.toLowerCase().includes('cabai') || i.name.toLowerCase().includes('cabe')
    );
    const bawang = ingredients.find((i) => i.name.toLowerCase().includes('bawang'));
    const beras = ingredients.find((i) => i.name.toLowerCase().includes('beras'));
    const gula = ingredients.find((i) => i.name.toLowerCase().includes('gula'));
    const teh = ingredients.find((i) => i.name.toLowerCase().includes('teh'));

    if (preset === 'AYAM_CRISPY') {
      setFormYieldQty(8);
      setFormYieldUnit('pcs');
      const list: RecipeItem[] = [];
      if (ayam)
        list.push({
          ingredientId: ayam.id,
          ingredientName: ayam.name,
          quantity: 1,
          unit: ayam.unit,
          costPerUnit: ayam.costPerUnit,
        });
      if (tepung)
        list.push({
          ingredientId: tepung.id,
          ingredientName: tepung.name,
          quantity: 0.2,
          unit: tepung.unit,
          costPerUnit: tepung.costPerUnit,
        });
      if (bumbu)
        list.push({
          ingredientId: bumbu.id,
          ingredientName: bumbu.name,
          quantity: 0.05,
          unit: bumbu.unit,
          costPerUnit: bumbu.costPerUnit,
        });
      if (minyak)
        list.push({
          ingredientId: minyak.id,
          ingredientName: minyak.name,
          quantity: 0.2,
          unit: minyak.unit,
          costPerUnit: minyak.costPerUnit,
        });
      setFormBatchItems(list.length > 0 ? list : formBatchItems);
      setFormGasCost(1500);
      setFormOverheadNotes('Alokasi gas penggorengan');
    } else if (preset === 'SAMBAL') {
      setFormYieldQty(40);
      setFormYieldUnit('porsi');
      const list: RecipeItem[] = [];
      if (cabe)
        list.push({
          ingredientId: cabe.id,
          ingredientName: cabe.name,
          quantity: 1,
          unit: cabe.unit,
          costPerUnit: cabe.costPerUnit,
        });
      if (bawang)
        list.push({
          ingredientId: bawang.id,
          ingredientName: bawang.name,
          quantity: 0.2,
          unit: bawang.unit,
          costPerUnit: bawang.costPerUnit,
        });
      if (minyak)
        list.push({
          ingredientId: minyak.id,
          ingredientName: minyak.name,
          quantity: 0.25,
          unit: minyak.unit,
          costPerUnit: minyak.costPerUnit,
        });
      setFormBatchItems(list.length > 0 ? list : formBatchItems);
      setFormGasCost(1000);
    } else if (preset === 'NASI') {
      setFormYieldQty(25);
      setFormYieldUnit('porsi');
      const list: RecipeItem[] = [];
      if (beras)
        list.push({
          ingredientId: beras.id,
          ingredientName: beras.name,
          quantity: 2,
          unit: beras.unit,
          costPerUnit: beras.costPerUnit,
        });
      setFormBatchItems(list.length > 0 ? list : formBatchItems);
      setFormElectricityCost(1500);
      setFormOverheadNotes('Listrik Rice Cooker');
    } else if (preset === 'TEH_MANIS') {
      setFormYieldQty(20);
      setFormYieldUnit('cup');
      const list: RecipeItem[] = [];
      if (gula)
        list.push({
          ingredientId: gula.id,
          ingredientName: gula.name,
          quantity: 0.5,
          unit: gula.unit,
          costPerUnit: gula.costPerUnit,
        });
      if (teh)
        list.push({
          ingredientId: teh.id,
          ingredientName: teh.name,
          quantity: 5,
          unit: teh.unit,
          costPerUnit: teh.costPerUnit,
        });
      setFormBatchItems(list.length > 0 ? list : formBatchItems);
      setFormGasCost(500);
    }
  };

  const handleAddIngredientRow = () => {
    const firstIng = ingredients[0];
    setFormBatchItems((prev) => [
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
    setFormBatchItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateIngredientRow = (index: number, field: keyof RecipeItem, value: any) => {
    setFormBatchItems((prev) => {
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

  const handleSubmitRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreatingNewProduct && !formProductId) {
      alert('Silakan pilih Produk Hasil Produksi target.');
      return;
    }
    if (isCreatingNewProduct && !newProductName.trim()) {
      alert('Silakan masukkan nama Produk Hasil Produksi baru.');
      return;
    }
    if (formYieldQty <= 0) {
      alert('Jumlah hasil produksi (yield) harus lebih dari 0.');
      return;
    }
    if (formBatchItems.some((it) => !it.ingredientId || it.quantity < 0)) {
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
        const p = productsMap.get(targetProductId) || targetProduct;
        targetProductName = p?.name || editingRecipe?.productName || 'Produk Hasil Produksi';
      }

      const recipeId = editingRecipe?.id || `rec_${targetProductId}`;
      const validYield = Math.max(1, formYieldQty || 1);

      const perPortionItems: RecipeItem[] = formBatchItems.map((b) => ({
        ingredientId: b.ingredientId,
        ingredientName: b.ingredientName,
        quantity: b.quantity / validYield,
        unit: b.unit,
        costPerUnit: b.costPerUnit,
      }));

      const overheadItems: OverheadItem[] = [];
      if (formGasCost > 0) overheadItems.push({ name: 'Gas LPG', cost: formGasCost });
      if (formElectricityCost > 0)
        overheadItems.push({ name: 'Listrik & Air', cost: formElectricityCost });
      if (formOtherOverheadCost > 0)
        overheadItems.push({ name: 'Operasional Lainnya', cost: formOtherOverheadCost });

      const recipeDoc: Recipe = {
        id: recipeId,
        productId: targetProductId,
        productName: targetProductName,
        recipeMode: 'BATCH',
        yieldQty: validYield,
        yieldUnit: formYieldUnit.trim() || 'pcs',
        batchItems: formBatchItems,
        portionItems: editingRecipe?.portionItems || [],
        items: perPortionItems,
        overheadCostPerUnit: modalOverheadTotal / validYield,
        overheadItems,
        overheadNotes: formOverheadNotes || undefined,
        totalHpp: modalHppPerUnit,
        patokanIngredientId: formPatokanIngredientId || undefined,
        patokanIngredientName:
          formPatokanIngredientId === 'PRODUCT'
            ? targetProductName
            : formPatokanIngredientId
            ? ingredientsMap.get(formPatokanIngredientId)?.name
            : undefined,
        updatedAt: new Date().toISOString(),
      };

      await saveRecipe(recipeDoc);

      const prod = productsMap.get(targetProductId);
      if (prod) {
        await updateProduct(targetProductId, {
          costPerUnit: modalHppPerUnit,
          stockUnit: formYieldUnit.trim() || prod.stockUnit || 'pcs',
          isProduction: true,
          stockSource: 'PRODUCTION',
          recipeId,
        });
      }

      onSaved?.(
        `Resep [${targetProductName}] berhasil disimpan! HPP: ${formatRupiah(modalHppPerUnit)} / ${formYieldUnit}`
      );
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan resep');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <form
        onSubmit={handleSubmitRecipe}
        className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-[#E8ECF2] space-y-4 max-h-[92vh] overflow-y-auto text-[#172033]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E8ECF2] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FF641F]/10 text-[#FF641F]">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#172033]">
                {editingRecipe ? `Atur Resep & HPP: ${editingRecipe.productName}` : 'Buat Resep & HPP Produk Produksi'}
              </h3>
              <p className="text-[11px] text-[#667085]">
                Menyimpan resep hanya memperbarui formula takaran &amp; HPP (tidak mengubah stok fisik)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#98A2B3] hover:text-[#172033] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Template Buttons */}
        <div className="p-3 bg-[#F7F8FA] rounded-2xl border border-[#E8ECF2] space-y-2">
          <span className="text-[11px] font-bold text-[#667085] block">
            Template Cepat Resep Standar:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => applyPresetTemplate('AYAM_CRISPY')}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#E8ECF2] text-[#172033] text-xs font-bold hover:border-[#FF641F] hover:text-[#FF641F] transition cursor-pointer"
            >
              Ayam Crispy (8 pcs)
            </button>
            <button
              type="button"
              onClick={() => applyPresetTemplate('SAMBAL')}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#E8ECF2] text-[#172033] text-xs font-bold hover:border-[#FF641F] hover:text-[#FF641F] transition cursor-pointer"
            >
              Sambal Bawang (40 porsi)
            </button>
            <button
              type="button"
              onClick={() => applyPresetTemplate('NASI')}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#E8ECF2] text-[#172033] text-xs font-bold hover:border-[#FF641F] hover:text-[#FF641F] transition cursor-pointer"
            >
              Nasi Putih (25 porsi)
            </button>
            <button
              type="button"
              onClick={() => applyPresetTemplate('TEH_MANIS')}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#E8ECF2] text-[#172033] text-xs font-bold hover:border-[#FF641F] hover:text-[#FF641F] transition cursor-pointer"
            >
              Teh Manis (20 cup)
            </button>
          </div>
        </div>

        {/* Target Product & Yield */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-[#344054]">
                Produk Hasil Produksi <span className="text-red-500">*</span>
              </label>
              {!editingRecipe && !targetProduct && (
                <button
                  type="button"
                  onClick={() => setIsCreatingNewProduct(!isCreatingNewProduct)}
                  className="text-[11px] font-bold text-[#FF641F] hover:underline cursor-pointer"
                >
                  {isCreatingNewProduct ? 'Pilih Produk Ada' : '+ Produk Baru'}
                </button>
              )}
            </div>

            {isCreatingNewProduct ? (
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Misal: Ayam Crispy / Sambal..."
                required
                className="w-full px-3 py-2 rounded-xl border border-[#FF641F]/50 bg-orange-50/30 font-bold text-[#172033]"
              />
            ) : (
              <select
                value={formProductId}
                onChange={(e) => setFormProductId(e.target.value)}
                disabled={Boolean(editingRecipe || targetProduct)}
                className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-white font-bold text-[#172033] disabled:bg-[#F7F8FA] disabled:text-[#667085]"
              >
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-bold text-[#344054] block mb-1">
                Hasil 1 Batch (Yield) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={formYieldQty}
                onChange={(e) => setFormYieldQty(Math.max(1, parseFloat(e.target.value) || 1))}
                required
                className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-white font-bold text-[#172033]"
              />
            </div>
            <div>
              <label className="font-bold text-[#344054] block mb-1">
                Satuan Hasil <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formYieldUnit}
                onChange={(e) => setFormYieldUnit(e.target.value)}
                placeholder="pcs / porsi / cup"
                required
                className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-white font-bold text-[#172033]"
              />
            </div>
          </div>

          <div className="sm:col-span-2 text-xs">
            <label className="font-bold text-[#344054] block mb-1">
              Bahan Utama Patokan Batch (Basis Skala Saat Produksi)
            </label>
            <select
              value={formPatokanIngredientId}
              onChange={(e) => setFormPatokanIngredientId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E8ECF2] bg-white font-bold text-[#172033]"
            >
              <option value="">-- Gunakan Jumlah Batch Standar --</option>
              <option value="PRODUCT">
                Target Hasil Produksi:{' '}
                {isCreatingNewProduct
                  ? newProductName || 'Produk Baru'
                  : productsMap.get(formProductId)?.name || 'Produk'}{' '}
                ({formYieldUnit})
              </option>
              {formBatchItems
                .filter((it) => it.ingredientId)
                .map((it) => (
                  <option key={it.ingredientId} value={it.ingredientId}>
                    Bahan Baku: {it.ingredientName} ({it.unit})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Bahan Baku List */}
        <div className="space-y-2 pt-2 border-t border-[#E8ECF2]">
          <div className="flex items-center justify-between">
            <label className="font-extrabold text-xs text-[#172033]">
              Komposisi Bahan Baku (Takaran 1 Batch):
            </label>
            <button
              type="button"
              onClick={handleAddIngredientRow}
              className="px-2.5 py-1 rounded-lg bg-[#FF641F]/10 text-[#FF641F] font-bold text-xs flex items-center gap-1 hover:bg-[#FF641F]/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Bahan</span>
            </button>
          </div>

          <div className="space-y-2">
            {formBatchItems.map((item, index) => {
              const ing = ingredientsMap.get(item.ingredientId);
              const currentCost =
                ing && typeof ing.costPerUnit === 'number'
                  ? ing.costPerUnit
                  : item.costPerUnit || 0;
              const subtotal = currentCost * (item.quantity || 0);

              return (
                <div
                  key={index}
                  className="p-2.5 bg-[#F7F8FA] rounded-2xl border border-[#E8ECF2] flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs"
                >
                  <div className="flex-1">
                    <select
                      value={item.ingredientId}
                      onChange={(e) =>
                        handleUpdateIngredientRow(index, 'ingredientId', e.target.value)
                      }
                      required
                      className="w-full px-3 py-1.5 rounded-xl border border-[#E8ECF2] bg-white font-bold text-[#172033]"
                    >
                      <option value="">-- Pilih Bahan Baku --</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (Stok: {i.stock} {i.unit} | Rp{' '}
                          {(i.costPerUnit || 0).toLocaleString('id-ID')}/{i.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <div className="w-28 flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateIngredientRow(
                            index,
                            'quantity',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        required
                        placeholder="Jumlah"
                        className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8ECF2] bg-white font-bold text-center text-[#172033]"
                      />
                      <span className="text-[11px] font-semibold text-[#667085] shrink-0">
                        {item.unit}
                      </span>
                    </div>

                    <div className="w-24 text-right font-black text-[#172033] shrink-0">
                      {formatRupiah(subtotal)}
                    </div>

                    {formBatchItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredientRow(index)}
                        className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overhead Utilities */}
        <div className="p-3.5 bg-orange-50/50 rounded-2xl border border-orange-200/80 space-y-2.5 text-xs">
          <span className="font-extrabold text-[#172033] flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#FF641F]" />
            <span>Alokasi Biaya Utilitas per Batch (Opsional):</span>
          </span>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-[#667085] block mb-1">Gas LPG (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberInput(formGasCost)}
                onChange={(e) => setFormGasCost(parseNumberInput(e.target.value))}
                placeholder="0"
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8ECF2] bg-white font-bold text-[#172033]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#667085] block mb-1">
                Listrik &amp; Air (Rp)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberInput(formElectricityCost)}
                onChange={(e) => setFormElectricityCost(parseNumberInput(e.target.value))}
                placeholder="0"
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8ECF2] bg-white font-bold text-[#172033]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#667085] block mb-1">Lainnya (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberInput(formOtherOverheadCost)}
                onChange={(e) => setFormOtherOverheadCost(parseNumberInput(e.target.value))}
                placeholder="0"
                className="w-full px-2.5 py-1.5 rounded-xl border border-[#E8ECF2] bg-white font-bold text-[#172033]"
              />
            </div>
          </div>
        </div>

        {/* Live HPP Calculation Box */}
        <div className="p-4 rounded-2xl bg-[#172033] text-white space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>
              Bahan: {formatRupiah(modalRawMaterialsCost)} + Utilitas:{' '}
              {formatRupiah(modalOverheadTotal)}
            </span>
            <span>
              Yield: {formYieldQty} {formYieldUnit}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-700">
            <div>
              <span className="text-[11px] font-semibold text-slate-300 block">
                Kalkulasi HPP per Unit:
              </span>
              <span className="text-lg font-black text-[#FF641F]">
                {formatRupiah(modalHppPerUnit)}{' '}
                <span className="text-xs font-normal text-slate-300">/{formYieldUnit}</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Total Biaya 1 Batch:</span>
              <span className="text-sm font-black text-white">
                {formatRupiah(modalTotalBatchCost)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E8ECF2]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E8ECF2] text-[#667085] font-bold text-xs hover:bg-[#F7F8FA] transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-[#FF641F] hover:bg-[#F45116] text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Resep & HPP'}
          </button>
        </div>
      </form>
    </div>
  );
};
