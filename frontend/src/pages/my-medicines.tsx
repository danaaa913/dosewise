import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pill, Plus } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, formatPrice, type Medicine } from "@/lib/api";
import { useLanguage } from "@/i18n/LanguageContext";

type FormData = {
  name: string;
  quantity: string;
  price: string;
  expiryDate: string;
  description: string;
  isAvailable: boolean;
};

const emptyForm: FormData = {
  name: "",
  quantity: "",
  price: "",
  expiryDate: "",
  description: "",
  isAvailable: true,
};

export default function MyMedicinesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const { t } = useLanguage();

  const { data: medicines, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-medicines"],
    queryFn: api.medicines.my,
  });

  const addMut = useMutation({
    mutationFn: (data: FormData) =>
      api.medicines.add({
        name: data.name,
        quantity: Number(data.quantity),
        price: Number(data.price),
        expiryDate: data.expiryDate,
        description: data.description || undefined,
        isAvailable: data.isAvailable,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-medicines"] });
      setShowForm(false);
      setForm(emptyForm);
    },
    onError: (e: any) => setFormError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (data: FormData) =>
      api.medicines.update(editing!.id, {
        name: data.name,
        quantity: Number(data.quantity),
        price: Number(data.price),
        expiryDate: data.expiryDate,
        description: data.description || undefined,
        isAvailable: data.isAvailable,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-medicines"] });
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => setFormError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.medicines.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-medicines"] }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (m: Medicine) => {
    setEditing(m);
    setForm({
      name: m.name,
      quantity: String(m.quantity),
      price: String(m.price),
      expiryDate: m.expiryDate,
      description: m.description ?? "",
      isAvailable: m.isAvailable,
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (editing) {
      updateMut.mutate(form);
    } else {
      addMut.mutate(form);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
  };

  const isSubmitting = addMut.isPending || updateMut.isPending;

  return (
    <Layout title="أدويتي">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">
          {medicines?.length ?? 0} دواء مسجل
        </p>
        <button
          onClick={openAdd}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          إضافة دواء
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                {editing ? "تعديل الدواء" : "إضافة دواء جديد"}
              </h3>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{formError}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">اسم الدواء</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="أموكسيسيلين 500 مجم"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الكمية</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">السعر (JOD)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ انتهاء الصلاحية</label>
                <input
                  required
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات (اختياري)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="text-sm text-slate-700">متاح للتبادل</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {isSubmitting ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "إضافة الدواء"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{["اسم الدواء", "الكمية", "السعر", "انتهاء الصلاحية", "الحالة", "إجراءات"].map((h) => (
                <th key={h} className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-3.5"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <p>{t.errors.query}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>{t.errors.retry}</Button>
        </Alert>
      ) : !medicines?.length ? (
        <Empty>
          <EmptyMedia variant="icon"><Pill className="size-6" /></EmptyMedia>
          <EmptyTitle>{t.empty.myMedicines}</EmptyTitle>
          <EmptyDescription>{t.empty.myMedicinesCta}</EmptyDescription>
          <EmptyContent>
            <Button onClick={openAdd}><Plus className="size-4" /> {t.empty.myMedicinesCta}</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["اسم الدواء", "الكمية", "السعر (JOD)", "انتهاء الصلاحية", "الحالة", "إجراءات"].map((h) => (
                  <th key={h} className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {medicines.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{m.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{m.quantity}</td>
                  <td className="px-5 py-3.5 text-slate-600">{formatPrice(m.price)}</td>
                  <td className="px-5 py-3.5 text-slate-600">{m.expiryDate}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      m.isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {m.isAvailable ? "متاح" : "غير متاح"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(m)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`هل تريد حذف ${m.name}؟`)) deleteMut.mutate(m.id);
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
