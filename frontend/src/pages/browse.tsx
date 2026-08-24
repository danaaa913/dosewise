import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api, type AvailableMedicine } from "@/lib/api";

export default function BrowsePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [requesting, setRequesting] = useState<AvailableMedicine | null>(null);
  const [qty, setQty] = useState("1");
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");

  const { data: medicines, isLoading } = useQuery({
    queryKey: ["available-medicines", search],
    queryFn: () => api.medicines.available(search || undefined),
  });

  const sendMut = useMutation({
    mutationFn: () =>
      api.requests.send({
        medicineId: requesting!.id,
        requestedQuantity: Number(qty),
      }),
    onSuccess: () => {
      setRequestSuccess("تم إرسال الطلب بنجاح");
      setRequesting(null);
      qc.invalidateQueries({ queryKey: ["requests-sent"] });
      setTimeout(() => setRequestSuccess(""), 3000);
    },
    onError: (e: any) => setRequestError(e.message),
  });

  return (
    <Layout title="تصفح الأدوية المتاحة">
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن دواء..."
            className="w-full pr-9 pl-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {requestSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {requestSuccess}
        </div>
      )}

      {/* Request modal */}
      {requesting && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">إرسال طلب</h3>
              <button onClick={() => { setRequesting(null); setRequestError(""); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700 mb-1 font-medium">{requesting.name}</p>
              <p className="text-xs text-slate-500 mb-4">من: {requesting.pharmacyName} — {requesting.pharmacyCity}</p>
              <p className="text-xs text-slate-500 mb-1">متاح: {requesting.quantity} وحدة — السعر: {requesting.price.toFixed(2)} JOD</p>

              {requestError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-3">{requestError}</p>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الكمية المطلوبة</label>
                <input
                  type="number"
                  min="1"
                  max={requesting.quantity}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  dir="ltr"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => sendMut.mutate()}
                  disabled={sendMut.isPending}
                  className="flex-1 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {sendMut.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
                </button>
                <button
                  onClick={() => { setRequesting(null); setRequestError(""); }}
                  className="px-4 border border-slate-300 text-slate-600 py-2.5 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">جاري التحميل...</div>
      ) : !medicines?.length ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-sm">
            {search ? `لا توجد نتائج لـ "${search}"` : "لا توجد أدوية متاحة حالياً"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {medicines.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-slate-800 text-sm leading-snug">{m.name}</h4>
                <span className="text-sm font-bold text-emerald-700 whitespace-nowrap mr-2">
                  {m.price.toFixed(2)} JOD
                </span>
              </div>

              <div className="space-y-1.5 mb-4">
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">الصيدلية:</span> {m.pharmacyName}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">المدينة:</span> {m.pharmacyCity}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">الكمية المتاحة:</span> {m.quantity} وحدة
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">الصلاحية حتى:</span> {m.expiryDate}
                </p>
              </div>

              {m.description && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{m.description}</p>
              )}

              <button
                onClick={() => {
                  setRequesting(m);
                  setQty("1");
                  setRequestError("");
                }}
                className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
              >
                طلب هذا الدواء
              </button>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
